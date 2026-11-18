'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { logActivity } from '@/lib/activity'
import { hashToken, SESSION_COOKIE } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { profileSchema } from '@/lib/validation'
import type { ActionState } from './auth'

/**
 * Settings / profile server actions.
 * Every handler re-resolves the actor from the session.
 */

const fail = (m: string, errors?: Record<string, string[]>): ActionState => ({
  ok: false,
  messageKey: m,
  errors,
})
const ok = (m?: string): ActionState => ({ ok: true, messageKey: m })

function zodErrors(e: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {}
  for (const i of e.issues) {
    const k = String(i.path[0] ?? 'form')
    ;(errors[k] ??= []).push(i.message)
  }
  return errors
}

/* ───────────────────────── Profile ───────────────────────── */

export async function updateProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const parsed = profileSchema.safeParse({
    name: String(fd.get('name') ?? ''),
    bio: String(fd.get('bio') ?? '').trim(),
    school: String(fd.get('school') ?? '').trim(),
    program: String(fd.get('program') ?? '').trim(),
    timezone: String(fd.get('timezone') ?? '').trim(),
    country: String(fd.get('country') ?? '').trim(),
    city: String(fd.get('city') ?? '').trim(),
    academicLevel: String(fd.get('academicLevel') ?? '').trim(),
    academicYear: String(fd.get('academicYear') ?? '').trim(),
    preferredLanguage: String(fd.get('preferredLanguage') ?? ''),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const { name, bio, school, program, timezone, country, city, academicLevel, academicYear, preferredLanguage } =
    parsed.data
  // empty strings → NULL
  const academic = {
    country: country || null,
    city: city || null,
    academicLevel: academicLevel || null,
    academicYear: academicYear || null,
    preferredLanguage: preferredLanguage || null,
  }

  try {
    await db.user.update({ where: { id: user.id }, data: { name } })
    await db.userProfile.upsert({
      where: { userId: user.id },
      update: { school, program, timezone, bio, ...academic },
      create: { userId: user.id, school, program, timezone, bio, ...academic },
    })
    logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'profile' })
    revalidatePath(`/${locale}/settings`)
    revalidatePath(`/${locale}/dashboard`)
    return ok('settings.profileSaved')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Sessions ───────────────────────── */

export async function revokeSession(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.session.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  try {
    await db.session.delete({ where: { id: row.id } })
    logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'revokeSession' })

    // If the caller revoked their own session, drop the cookie too.
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (token && hashToken(token) === row.tokenHash) {
      store.delete(SESSION_COOKIE)
      redirect(`/${locale}/login`)
    }

    revalidatePath(`/${locale}/settings`)
    return ok('settings.sessionRevoked')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function revokeOtherSessions(locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const keep = token ? hashToken(token) : ''

  if (!rateLimit(`revoke:${user.id}`, 10, 60 * 60_000)) return fail('auth.errRateLimited')

  try {
    await db.session.deleteMany({
      where: { userId: user.id, ...(keep ? { tokenHash: { not: keep } } : {}) },
    })
    logActivity(user.id, 'USER', 'UPDATE', user.id, { field: 'revokeOthers' })
    revalidatePath(`/${locale}/settings`)
    return ok('settings.sessionRevoked')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Preferences ───────────────────────── */

export async function saveUiPreferences(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const notificationsEnabled = fd.get('notificationsEnabled') === 'on'
  const emailEnabled = fd.get('emailEnabled') === 'on'

  try {
    await db.studyPreference.upsert({
      where: { userId: user.id },
      update: { notificationsEnabled, emailEnabled },
      create: { userId: user.id, notificationsEnabled, emailEnabled },
    })
    revalidatePath(`/${locale}/settings`)
    revalidatePath(`/${locale}/notifications`)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}
