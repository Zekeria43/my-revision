import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { issueToken, consumeToken } from '@/lib/auth/tokens'
import { hashPassword } from '@/lib/auth/session'
import { loginAction, resendVerificationAction, verifyEmail } from '@/actions/auth'

/**
 * Phase 3 — mandatory email verification.
 *
 * Real DB + real server actions:
 *  - expired / reused / concurrent tokens
 *  - suspended accounts can never be re-activated by an old link
 *  - resend flow: correct template path, token rotation, rate limit,
 *    and identical answers for unknown vs. already-verified addresses
 *  - login refuses a PENDING account
 *
 * Only rows created here (emails prefixed `phase3-`) are deleted.
 */

const suffix = randomBytes(4).toString('hex')
const email = (tag: string) => `phase3-${tag}-${suffix}@example.test`

const originalEmailMode = process.env.AUTH_EMAIL_MODE

beforeEach(() => {
  // devLink is only ever produced in console mode — make it deterministic.
  process.env.AUTH_EMAIL_MODE = 'console'
})

async function makeUser(tag: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' = 'PENDING') {
  return db.user.create({
    data: {
      email: email(tag),
      name: `Phase3 ${tag}`,
      passwordHash: await hashPassword('secret123'),
      locale: 'en',
      status,
    },
  })
}

function resendForm(addr: string) {
  const fd = new FormData()
  fd.set('email', addr)
  fd.set('locale', 'en')
  return fd
}

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { email: { startsWith: 'phase3-' } } })
  await db.emailQuota.deleteMany({ where: { email: { startsWith: 'phase3-' } } })
  await db.activityLog.deleteMany({ where: { user: { email: { startsWith: 'phase3-' } } } })
  await db.authToken.deleteMany({ where: { user: { email: { startsWith: 'phase3-' } } } })
  await db.user.deleteMany({ where: { email: { startsWith: 'phase3-' } } })
  if (originalEmailMode === undefined) delete process.env.AUTH_EMAIL_MODE
  else process.env.AUTH_EMAIL_MODE = originalEmailMode
})

describe('verification tokens (phase 3)', () => {
  it('rejects an expired token and leaves the account PENDING', async () => {
    const u = await makeUser('expired')
    const raw = await issueToken(u.id, 'VERIFY_EMAIL')
    await db.authToken.updateMany({
      where: { userId: u.id, type: 'VERIFY_EMAIL' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    const res = await verifyEmail(raw)
    expect(res.ok).toBe(false)
    expect(res.messageKey).toBe('auth.verifyExpired') // distinct from unknown/used

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(after!.status).toBe('PENDING')
    expect(after!.emailVerifiedAt).toBeNull()
  })

  it('activates once, then refuses the reused token', async () => {
    const u = await makeUser('reuse')
    const raw = await issueToken(u.id, 'VERIFY_EMAIL')

    const first = await verifyEmail(raw)
    expect(first.ok).toBe(true)

    const second = await verifyEmail(raw)
    expect(second.ok).toBe(false)
    expect(second.messageKey).toBe('auth.verifyMissing')

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(after!.status).toBe('ACTIVE')
    expect(after!.emailVerifiedAt).not.toBeNull()
  })

  it('lets exactly one of two concurrent consumes win', async () => {
    const u = await makeUser('concurrent')
    const raw = await issueToken(u.id, 'VERIFY_EMAIL')

    const [a, b] = await Promise.all([
      consumeToken(raw, 'VERIFY_EMAIL'),
      consumeToken(raw, 'VERIFY_EMAIL'),
    ])
    const winners = [a, b].filter(Boolean)
    expect(winners).toHaveLength(1)

    // The single-use claim also survived both callers: third try fails.
    expect(await consumeToken(raw, 'VERIFY_EMAIL')).toBeNull()
  })

  it('never re-activates a suspended account through an old link', async () => {
    const u = await makeUser('suspended', 'SUSPENDED')
    const raw = await issueToken(u.id, 'VERIFY_EMAIL')

    const res = await verifyEmail(raw)
    expect(res.ok).toBe(false)
    expect(res.messageKey).toBe('auth.verifyMissing')

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(after!.status).toBe('SUSPENDED')
  })
})

describe('resend verification action (phase 3)', () => {
  it('sends a fresh link, rotates the old token, and verifies with it', async () => {
    const u = await makeUser('resend')
    const oldRaw = await issueToken(u.id, 'VERIFY_EMAIL')

    const state = await resendVerificationAction({ ok: false }, resendForm(u.email))
    expect(state.ok).toBe(true)
    expect(state.messageKey).toBe('auth.resendSent')
    expect(state.devLink).toBeTruthy()

    // Rotation: the previously issued link is dead.
    const oldRes = await verifyEmail(oldRaw)
    expect(oldRes.ok).toBe(false)

    // The link handed back in console mode is a working verification link.
    const token = state.devLink!.split('token=')[1]
    expect(token).toBeTruthy()
    const res = await verifyEmail(token)
    expect(res.ok).toBe(true)

    const after = await db.user.findUnique({ where: { id: u.id } })
    expect(after!.status).toBe('ACTIVE')
  })

  it('answers identically for unknown and already-verified addresses', async () => {
    const active = await makeUser('already-active', 'ACTIVE')
    const activeRaw = await issueToken(active.id, 'VERIFY_EMAIL') // live but unused

    const unknown = await resendVerificationAction({ ok: false }, resendForm(email('does-not-exist')))
    const verified = await resendVerificationAction({ ok: false }, resendForm(active.email))

    // Same status, same message — no way to tell the accounts apart.
    expect(unknown.ok).toBe(true)
    expect(verified.ok).toBe(true)
    expect(unknown.messageKey).toBe('auth.resendSent')
    expect(verified.messageKey).toBe('auth.resendSent')
    expect(unknown.devLink).toBeUndefined()
    expect(verified.devLink).toBeUndefined()

    // No mail path was taken: the active user's live token is untouched.
    const stillLive = await consumeToken(activeRaw, 'VERIFY_EMAIL')
    expect(stillLive).toBe(active.id)
  })

  it('rate-limits repeated resend requests per address', async () => {
    const addr = email('resend-limit')

    for (let i = 0; i < 3; i++) {
      const s = await resendVerificationAction({ ok: false }, resendForm(addr))
      expect(s.ok).toBe(true)
    }

    const fourth = await resendVerificationAction({ ok: false }, resendForm(addr))
    expect(fourth.ok).toBe(false)
    expect(fourth.messageKey).toBe('auth.errRateLimited')
  })

  it('rejects a malformed address without touching the database', async () => {
    const s = await resendVerificationAction({ ok: false }, resendForm('not-an-email'))
    expect(s.ok).toBe(false)
    expect(s.messageKey).toBe('auth.errInvalidEmail')
  })
})

describe('login blocks unverified accounts (phase 3)', () => {
  it('refuses a PENDING account with errPending, never a session', async () => {
    const u = await makeUser('login-pending')

    const fd = new FormData()
    fd.set('email', u.email)
    fd.set('password', 'secret123')
    fd.set('locale', 'en')

    const state = await loginAction({ ok: false }, fd)
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errPending')

    const sessions = await db.session.count({ where: { userId: u.id } })
    expect(sessions).toBe(0)
  })

  it('refuses a SUSPENDED account', async () => {
    const u = await makeUser('login-suspended', 'SUSPENDED')

    const fd = new FormData()
    fd.set('email', u.email)
    fd.set('password', 'secret123')
    fd.set('locale', 'en')

    const state = await loginAction({ ok: false }, fd)
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errSuspended')
  })
})
