'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { rateLimit, resetRateLimit } from '@/lib/rate-limit'
import {
  createSession,
  destroyAllSessions,
  destroyCurrentSession,
  destroyOtherSessions,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/session'
import { consumeToken, issueToken, peekToken } from '@/lib/auth/tokens'
import { requireActiveUser } from '@/lib/auth/guards'
import { recordEmailEvent, releaseEmailSlot, reserveEmailSlot } from '@/lib/email-quota'
import { registrationOpen } from '@/lib/platform-settings'
import { emailMode, sendMail } from '@/lib/mail'
import { renderEmail } from '@/lib/email-templates'
import { logActivity } from '@/lib/activity'
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from '@/lib/validation'
import { routing } from '@/i18n/routing'

export type ActionState = {
  ok: boolean
  /** i18n message key (translated client-side) */
  messageKey?: string
  /** non-translated value interpolated into messageKey */
  vars?: Record<string, string | number>
  errors?: Record<string, string[]>
  /** development-only link surfaced when AUTH_EMAIL_MODE=console */
  devLink?: string
}

const fail = (m: string, vars?: Record<string, string | number>, errors?: Record<string, string[]>): ActionState => ({
  ok: false,
  messageKey: m,
  vars,
  errors,
})
const ok = (m?: string, extra: Partial<ActionState> = {}): ActionState => ({ ok: true, messageKey: m, ...extra })

function clientIp(): string {
  return '127.0.0.1'
}

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/* ───────────────────────── Register ───────────────────────── */

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = String(formData.get('locale') ?? routing.defaultLocale)
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    locale,
    country: formData.get('country'),
    city: formData.get('city'),
    school: formData.get('school'),
    academicLevel: formData.get('academicLevel'),
    program: formData.get('program'),
    academicYear: formData.get('academicYear'),
    preferredLanguage: formData.get('preferredLanguage'),
  })

  if (!parsed.success) {
    const errors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? 'form')
      ;(errors[k] ??= []).push(issue.message)
    }
    return fail('errors.formInvalid', undefined, errors)
  }

  const { name, email, password } = parsed.data

  if (!rateLimit(`register:${email}`, 5, 15 * 60_000)) return fail('auth.errRateLimited')
  if (!rateLimit(`register:ip:${clientIp()}`, 20, 60 * 60_000)) return fail('auth.errRateLimited')

  // Platform switch: the owner can close registration entirely.
  if (!(await registrationOpen())) return fail('auth.errRegistrationClosed')

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return fail('auth.errEmailTaken', undefined, { email: ['auth.errEmailTaken'] })

  // Optional academic information (empty strings → NULL)
  const academic = {
    country: parsed.data.country || null,
    city: parsed.data.city || null,
    school: parsed.data.school || null,
    academicLevel: parsed.data.academicLevel || null,
    program: parsed.data.program || null,
    academicYear: parsed.data.academicYear || null,
    preferredLanguage: parsed.data.preferredLanguage || null,
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      locale: parsed.data.locale ?? routing.defaultLocale,
      status: 'PENDING',
      profile: { create: academic },
      prefs: { create: {} },
    },
  })

  // Platform switch: the owner can close registration entirely.
  if (!(await registrationOpen())) return fail('auth.errRegistrationClosed')

  logActivity(user.id, 'USER', 'REGISTER', user.id, { email })

  // Rolling 24h quota (shared with resend + recovery). A fresh address has
  // a full budget; only an address that already spent its budget (e.g. was
  // probed before registration) skips the send — honestly surfaced on the
  // success page instead of pretending the mail went out.
  const reservation = await reserveEmailSlot(email)
  if (reservation.ok) {
    const token = await issueToken(user.id, 'VERIFY_EMAIL')
    const link = `${appUrl()}/${user.locale}/verify?token=${token}`
    const mail = renderEmail('verify', { locale: user.locale, name, email, link })
    const sent = await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
    if (sent.delivered) {
      await recordEmailEvent({ email, kind: 'VERIFY', status: 'SENT', userId: user.id })
    } else {
      await releaseEmailSlot(email) // failed sends are never counted
      await recordEmailEvent({ email, kind: 'VERIFY', status: 'FAILED', userId: user.id })
    }
  } else {
    await recordEmailEvent({ email, kind: 'VERIFY', status: 'SKIPPED', userId: user.id })
    redirect(
      `/${parsed.data.locale}/register/success?email=${encodeURIComponent(email)}&limited=1`,
    )
  }

  redirect(`/${parsed.data.locale}/register/success?email=${encodeURIComponent(email)}`)
}

/* ───────────────────────── Verify email ───────────────────────── */

export async function verifyEmail(raw: string): Promise<{ ok: boolean; messageKey: string }> {
  if (!rateLimit(`verify:${raw.slice(0, 16)}`, 20, 10 * 60_000))
    return { ok: false, messageKey: 'auth.errRateLimited' }

  const userId = await consumeToken(raw, 'VERIFY_EMAIL')
  if (!userId) {
    // An expired link gets its own honest message; anything else (unknown,
    // already used, rotated) stays on the generic one.
    const peek = await peekToken(raw, 'VERIFY_EMAIL')
    return { ok: false, messageKey: peek === 'expired' ? 'auth.verifyExpired' : 'auth.verifyMissing' }
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  // A suspended account can never be re-activated through an old link —
  // only an administrator lifts a suspension.
  if (!user || user.status === 'SUSPENDED') return { ok: false, messageKey: 'auth.verifyMissing' }

  // Idempotent: an already-active account (e.g. activated by an admin while
  // the link was still live) reports success without re-writing anything.
  if (user.status !== 'ACTIVE') {
    await db.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    })
    logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'emailVerified' })
  }
  return { ok: true, messageKey: 'auth.verifiedTitle' }
}

/* ───────────────────────── Resend verification ───────────────────────── */

/**
 * Sends a fresh activation link to an unverified account.
 *
 * Non-enumerating: the response is byte-identical whether the address is
 * unknown, already verified, or suspended — only a genuinely PENDING
 * account ever receives mail. Rate-limited per address and per IP.
 */
export async function resendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return fail('auth.errInvalidEmail')

  const email = parsed.data.email
  if (!rateLimit(`resend:${email}`, 3, 15 * 60_000)) return fail('auth.errRateLimited')
  if (!rateLimit(`resend:ip:${clientIp()}`, 20, 60 * 60_000)) return fail('auth.errRateLimited')

  const user = await db.user.findUnique({ where: { email } })

  // Quota applies to EVERY address with the identical answer — running out
  // of budget must not reveal whether the account exists (anti-enumeration).
  const reservation = await reserveEmailSlot(email)
  if (!reservation.ok) return fail('auth.errEmailLimit', { limit: reservation.limit })

  if (user && user.status === 'PENDING') {
    const token = await issueToken(user.id, 'VERIFY_EMAIL')
    const link = `${appUrl()}/${user.locale}/verify?token=${token}`
    const mail = renderEmail('resend', { locale: user.locale, name: user.name, email, link })
    const sent = await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
    if (sent.delivered) {
      await recordEmailEvent({ email, kind: 'RESEND', status: 'SENT', userId: user.id })
      logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'resendVerification' })
      // Dev-only convenience: never surface the link outside console mode.
      if (emailMode() === 'console') return ok('auth.resendSent', { devLink: link })
      return ok('auth.resendSent')
    }
    // Honest failure: refund the slot, keep the event, surface the error.
    await releaseEmailSlot(email)
    await recordEmailEvent({ email, kind: 'RESEND', status: 'FAILED', userId: user.id })
    return fail('errors.serverErrorTitle')
  }

  // Unknown, verified or suspended address: consume the slot (so the budget
  // behaves identically) and record a SKIPPED event instead of a send.
  await recordEmailEvent({ email, kind: 'RESEND', status: 'SKIPPED' })
  return ok('auth.resendSent')
}

/* ───────────────────────── Login ───────────────────────── */

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = String(formData.get('locale') ?? routing.defaultLocale)
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) return fail('auth.errInvalidCredentials')

  const { email, password } = parsed.data
  const key = `login:${email}`

  if (!rateLimit(key, 8, 10 * 60_000)) return fail('auth.errRateLimited')

  const user = await db.user.findUnique({ where: { email } })
  const valid = user ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !valid) {
    // constant-ish work factor to avoid user enumeration timing
    if (!user) await hashPassword('dummy-password-for-timing')
    return fail('auth.errInvalidCredentials', undefined, { password: ['auth.errInvalidCredentials'] })
  }

  if (user.status === 'SUSPENDED') return fail('auth.errSuspended')
  if (user.status === 'PENDING') {
    // Best-effort activation reminder: respects the shared daily quota and
    // silently skips when the budget is spent — the resend form reports it.
    const reservation = await reserveEmailSlot(user.email)
    if (reservation.ok) {
      const token = await issueToken(user.id, 'VERIFY_EMAIL')
      const link = `${appUrl()}/${user.locale}/verify?token=${token}`
      const mail = renderEmail('resend', { locale: user.locale, name: user.name, email: user.email, link })
      const sent = await sendMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html })
      if (sent.delivered) {
        await recordEmailEvent({ email: user.email, kind: 'RESEND', status: 'SENT', userId: user.id })
      } else {
        await releaseEmailSlot(user.email)
        await recordEmailEvent({ email: user.email, kind: 'RESEND', status: 'FAILED', userId: user.id })
      }
    }
    return fail('auth.errPending')
  }

  resetRateLimit(key)
  await createSession(user.id, { userAgent: formData.get('userAgent')?.toString() ?? undefined, ip: clientIp() })
  logActivity(user.id, 'USER', 'LOGIN', user.id)

  // Each role lands on its own panel: /owner (platform owner), /admin,
  // /dashboard (students).
  redirect(`/${locale}/${user.role === 'OWNER' ? 'owner' : user.role === 'ADMIN' ? 'admin' : 'dashboard'}`)
}

/* ───────────────────────── Forgot password ───────────────────────── */

export async function forgotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = String(formData.get('locale') ?? routing.defaultLocale)
  const parsed = forgotSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return fail('auth.errInvalidEmail')

  const email = parsed.data.email
  if (!rateLimit(`forgot:${email}`, 3, 15 * 60_000)) return fail('auth.errRateLimited')

  // Same shared 24h budget as verification emails — known addresses and
  // unknown ones behave identically (no account enumeration).
  const reservation = await reserveEmailSlot(email)
  if (!reservation.ok) return fail('auth.errEmailLimit', { limit: reservation.limit })

  const user = await db.user.findUnique({ where: { email } })
  if (user) {
    const token = await issueToken(user.id, 'RESET_PASSWORD')
    const link = `${appUrl()}/${locale}/reset?token=${token}`
    const mail = renderEmail('reset', { locale, name: user.name, email, link })
    const sent = await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
    if (sent.delivered) {
      await recordEmailEvent({ email, kind: 'RESET', status: 'SENT', userId: user.id })
      // Dev-only convenience: never surface the link outside console mode.
      if (emailMode() === 'console') return ok('auth.forgotSent', { devLink: link })
      return ok('auth.forgotSent')
    }
    await releaseEmailSlot(email) // failed sends are never counted
    await recordEmailEvent({ email, kind: 'RESET', status: 'FAILED', userId: user.id })
    return fail('errors.serverErrorTitle')
  }
  await recordEmailEvent({ email, kind: 'RESET', status: 'SKIPPED' })
  return ok('auth.forgotSent')
}

export async function resetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = ['ar', 'fr', 'en'].includes(String(formData.get('locale')))
    ? String(formData.get('locale'))
    : routing.defaultLocale
  const parsed = resetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    const errors: Record<string, string[]> = {}
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? 'form')
      ;(errors[k] ??= []).push(i.message)
    }
    return fail('errors.formInvalid', undefined, errors)
  }

  const userId = await consumeToken(parsed.data.token, 'RESET_PASSWORD')
  if (!userId) {
    // Distinguish an expired link (ask for a fresh one) from a link that was
    // already used or never existed — both stay non-enumerating.
    const peek = await peekToken(parsed.data.token, 'RESET_PASSWORD')
    return peek === 'expired' ? fail('auth.resetExpired') : fail('auth.resetInvalid')
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  })
  await destroyAllSessions(userId) // password reset kills every session, everywhere
  logActivity(userId, 'USER', 'UPDATE', userId, { field: 'passwordReset' })
  // Redirect to the login page with a success banner. Necessary because
  // destroyAllSessions removes the session cookie, which would otherwise
  // re-render THIS page (token now "used") and bury the success message
  // under an "invalid link" card.
  redirect(`/${locale}/login?reset=done`)
}

/* ───────────────────────── Password change ───────────────────────── */

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Active accounts only — a PENDING (unverified) session may not change
  // credentials until the address is confirmed.
  const user = await requireActiveUser()
  if (!user) return fail('errors.unauthorized')

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    const errors: Record<string, string[]> = {}
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? 'form')
      ;(errors[k] ??= []).push(i.message)
    }
    return fail('errors.formInvalid', undefined, errors)
  }

  if (!rateLimit(`pw:${user.id}`, 5, 15 * 60_000)) return fail('auth.errRateLimited')

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash)))
    return fail('auth.errInvalidCredentials', undefined, { currentPassword: ['auth.errInvalidCredentials'] })

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  })
  // Kill every other signed-in device; the session doing the change survives.
  await destroyOtherSessions(user.id)
  logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'password' })

  // Best-effort security notice — never blocks the password change.
  // Recorded as an event but NOT counted against the recovery quota.
  try {
    const link = `${appUrl()}/${user.locale}/settings`
    const mail = renderEmail('security', {
      locale: user.locale,
      name: user.name,
      email: user.email,
      link,
    })
    const sent = await sendMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html })
    await recordEmailEvent({
      email: user.email,
      kind: 'SECURITY',
      status: sent.delivered ? 'SENT' : 'FAILED',
      userId: user.id,
    })
  } catch (e) {
    console.error('[auth] security notice failed', e)
  }

  return ok('auth.passwordChanged')
}

/* ───────────────────────── Logout ───────────────────────── */

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser()
  if (user) logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'logout' })
  await destroyCurrentSession()
  redirect('/ar')
}

/* ───────────────────────── Delete account ───────────────────────── */

export async function deleteAccountAction(password: string): Promise<ActionState> {
  const user = await requireActiveUser()
  if (!user) return fail('errors.unauthorized')
  if (!rateLimit(`del:${user.id}`, 3, 60 * 60_000)) return fail('auth.errRateLimited')
  if (!(await verifyPassword(password, user.passwordHash)))
    return fail('auth.errInvalidCredentials', undefined, { password: ['auth.errInvalidCredentials'] })

  await db.user.delete({ where: { id: user.id } })
  await destroyCurrentSession()
  return ok('settings.accountDeleted')
}

/* Note: this file is a "use server" module — it may only export async
   functions. Shared types (ActionState) are erased at compile time and safe. */
