import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'crypto'

/**
 * Phase 5 — password recovery, completed and hardened.
 *
 *  - expired RESET link      → honest `auth.resetExpired`, password untouched
 *  - reused RESET link       → refused (`auth.resetInvalid`), single-use holds
 *  - unknown token           → same non-enumerating refusal
 *  - forgot rate limit       → 4th attempt inside 15 min is refused
 *  - password change         → every OTHER session dies, the current one lives
 *  - password reset          → ALL sessions die everywhere
 *
 * `next/headers` is mocked with a mutable cookie jar so the real guards run
 * against real DB rows. Only rows created here (emails prefixed `phase5-`)
 * are deleted.
 */

const jar = vi.hoisted(() => ({ map: new Map<string, string>() }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.map.has(name) ? { name, value: jar.map.get(name)! } : undefined,
    set: (name: string, value: string) => {
      jar.map.set(name, value)
    },
    delete: (name: string) => {
      jar.map.delete(name)
    },
  }),
}))

import { db } from '@/lib/db'
import { changePasswordAction, forgotAction, resetAction } from '@/actions/auth'
import {
  destroyOtherSessions,
  generateToken,
  hashPassword,
  hashToken,
  SESSION_COOKIE,
  verifyPassword,
} from '@/lib/auth/session'
import { issueToken, peekToken } from '@/lib/auth/tokens'

const suffix = randomBytes(4).toString('hex')
const email = (tag: string) => `phase5-${tag}-${suffix}@example.test`

const ENV_KEYS = ['AUTH_EMAIL_MODE'] as const
const saved: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) saved[k] = process.env[k]

beforeEach(() => {
  process.env.AUTH_EMAIL_MODE = 'console'
  jar.map.clear()
})

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { email: { startsWith: 'phase5-' } } })
  await db.emailQuota.deleteMany({ where: { email: { startsWith: 'phase5-' } } })
  await db.session.deleteMany({ where: { user: { email: { startsWith: 'phase5-' } } } })
  await db.activityLog.deleteMany({ where: { user: { email: { startsWith: 'phase5-' } } } })
  await db.authToken.deleteMany({ where: { user: { email: { startsWith: 'phase5-' } } } })
  await db.user.deleteMany({ where: { email: { startsWith: 'phase5-' } } })
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

async function makeUser(tag: string, password = 'Recover123') {
  return db.user.create({
    data: {
      email: email(tag),
      name: 'Phase5 User',
      passwordHash: await hashPassword(password),
      locale: 'en',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  })
}

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function addSession(userId: string, rawToken: string) {
  return db.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
    },
  })
}

describe('reset link lifecycle', () => {
  it('refuses an expired reset link with a distinct message and changes nothing', async () => {
    const u = await makeUser('expired')
    const raw = await issueToken(u.id, 'RESET_PASSWORD')
    await db.authToken.updateMany({
      where: { userId: u.id, type: 'RESET_PASSWORD' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    const state = await resetAction(
      { ok: false },
      form({ token: raw, password: 'Fresh12345', confirmPassword: 'Fresh12345' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.resetExpired')

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(await verifyPassword('Recover123', after!.passwordHash)).toBe(true)
    expect(await verifyPassword('Fresh12345', after!.passwordHash)).toBe(false)
  })

  it('allows exactly one use of a reset link, then refuses it as invalid', async () => {
    const u = await makeUser('reuse')
    const raw = await issueToken(u.id, 'RESET_PASSWORD')
    await addSession(u.id, 'session-before-reset')

    // Success redirects to the login page with a success banner
    // (NEXT_REDIRECT thrown by the server action, like registerAction).
    let redirectTarget = ''
    try {
      await resetAction(
        { ok: false },
        form({ token: raw, password: 'Fresh12345', confirmPassword: 'Fresh12345', locale: 'en' }),
      )
    } catch (e) {
      redirectTarget = String((e as { digest?: string }).digest ?? '')
    }
    expect(redirectTarget).toContain('/en/login?reset=done')

    // A successful reset kills every session, everywhere.
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0)

    const second = await resetAction(
      { ok: false },
      form({ token: raw, password: 'Other12345', confirmPassword: 'Other12345' }),
    )
    expect(second.ok).toBe(false)
    expect(second.messageKey).toBe('auth.resetInvalid')

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(await verifyPassword('Fresh12345', after!.passwordHash)).toBe(true)
    expect(await verifyPassword('Other12345', after!.passwordHash)).toBe(false)
  })

  it('refuses unknown or malformed tokens without revealing anything', async () => {
    const garbage = randomBytes(24).toString('hex')
    const state = await resetAction(
      { ok: false },
      form({ token: garbage, password: 'Fresh12345', confirmPassword: 'Fresh12345' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.resetInvalid')

    // Too-short token is rejected by schema before any lookup.
    const short = await resetAction({ ok: false }, form({ token: 'abc', password: 'Fresh12345', confirmPassword: 'Fresh12345' }))
    expect(short.ok).toBe(false)
    expect(short.messageKey).toBe('errors.formInvalid')
  })

  it('peekToken reports ok / expired / used / unknown without consuming', async () => {
    const u = await makeUser('peek')
    const raw = await issueToken(u.id, 'RESET_PASSWORD')

    expect(await peekToken(raw, 'RESET_PASSWORD')).toBe('ok')
    // Still consumable after a peek — a page render must not burn the link.
    await db.authToken.updateMany({
      where: { userId: u.id, type: 'RESET_PASSWORD' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })
    expect(await peekToken(raw, 'RESET_PASSWORD')).toBe('expired')
    expect(await peekToken(randomBytes(24).toString('hex'), 'RESET_PASSWORD')).toBe('unknown')

    await db.authToken.updateMany({
      where: { userId: u.id, type: 'RESET_PASSWORD' },
      data: { expiresAt: new Date(Date.now() + 3600_000), usedAt: new Date() },
    })
    expect(await peekToken(raw, 'RESET_PASSWORD')).toBe('used')
    // Wrong type never matches.
    expect(await peekToken(raw, 'VERIFY_EMAIL')).toBe('unknown')
  })
})

describe('forgot rate limiting', () => {
  it('refuses the 4th attempt inside the 15-minute window', async () => {
    const u = await makeUser('forgot')
    const addr = u.email

    // No resets anywhere: this address is unique to this run, so all four
    // attempts share one live 15-minute window.
    for (let i = 0; i < 3; i++) {
      const s = await forgotAction({ ok: false }, form({ email: addr, locale: 'en' }))
      expect(s.ok).toBe(true)
      expect(s.messageKey).toBe('auth.forgotSent')
      expect(s.devLink).toBeTruthy()
    }

    // The 4th attempt inside the window is refused by the rate limiter
    // (checked before the quota).
    const fourth = await forgotAction({ ok: false }, form({ email: addr, locale: 'en' }))
    expect(fourth.ok).toBe(false)
    expect(fourth.messageKey).toBe('auth.errRateLimited')
  })
})

describe('password change invalidates other sessions only', () => {
  it('keeps the current session alive and kills every other one', async () => {
    const u = await makeUser('change')
    const current = generateToken()
    const other1 = generateToken()
    const other2 = generateToken()
    await addSession(u.id, current)
    await addSession(u.id, other1)
    await addSession(u.id, other2)
    jar.map.set(SESSION_COOKIE, current)

    const state = await changePasswordAction(
      { ok: false },
      form({
        currentPassword: 'Recover123',
        newPassword: 'BrandNew123',
        confirmPassword: 'BrandNew123',
      }),
    )
    expect(state.ok).toBe(true)
    expect(state.messageKey).toBe('auth.passwordChanged')

    // The device performing the change stays signed in…
    const kept = await db.session.findUnique({ where: { tokenHash: hashToken(current) } })
    expect(kept).not.toBeNull()
    // …everywhere else is logged out immediately.
    expect(await db.session.findUnique({ where: { tokenHash: hashToken(other1) } })).toBeNull()
    expect(await db.session.findUnique({ where: { tokenHash: hashToken(other2) } })).toBeNull()

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(await verifyPassword('BrandNew123', after!.passwordHash)).toBe(true)
    expect(await verifyPassword('Recover123', after!.passwordHash)).toBe(false)

    // The security notice was logged — and never touched the send counter.
    const notice = await db.emailLog.findFirst({ where: { email: u.email, kind: 'SECURITY' } })
    expect(notice).not.toBeNull()
    const quota = await db.emailQuota.findUnique({ where: { email: u.email } })
    expect(quota).toBeNull()
  })

  it('rejects a wrong current password without touching any session', async () => {
    const u = await makeUser('change-wrong')
    const current = generateToken()
    const other = generateToken()
    await addSession(u.id, current)
    await addSession(u.id, other)
    jar.map.set(SESSION_COOKIE, current)

    const state = await changePasswordAction(
      { ok: false },
      form({ currentPassword: 'WrongPass1', newPassword: 'BrandNew123', confirmPassword: 'BrandNew123' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errInvalidCredentials')

    expect(await db.session.count({ where: { userId: u.id } })).toBe(2)
    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(await verifyPassword('Recover123', after!.passwordHash)).toBe(true)
  })

  it('destroyOtherSessions spares the current cookie session', async () => {
    const u = await makeUser('destroy-others')
    const current = generateToken()
    const other = generateToken()
    await addSession(u.id, current)
    await addSession(u.id, other)
    jar.map.set(SESSION_COOKIE, current)

    await destroyOtherSessions(u.id)
    expect(await db.session.count({ where: { userId: u.id } })).toBe(1)
    expect(await db.session.findUnique({ where: { tokenHash: hashToken(current) } })).not.toBeNull()
  })
})
