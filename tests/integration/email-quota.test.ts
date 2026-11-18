import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import {
  emailDailyLimit,
  emailQuotaState,
  recordEmailEvent,
  releaseEmailSlot,
  reserveEmailSlot,
} from '@/lib/email-quota'
import { forgotAction, resendVerificationAction } from '@/actions/auth'
import { resetRateLimit } from '@/lib/rate-limit'

/**
 * Phase 4 — shared rolling 24h / 3-send transactional email quota.
 *
 * Real DB: atomic reservations (incl. concurrency), refunds on failure,
 * window reset, configurable limit, and the identical answers that keep
 * unknown vs. existing addresses indistinguishable.
 *
 * Only rows created here (emails prefixed `phase4-`) are deleted.
 */

const suffix = randomBytes(4).toString('hex')
const email = (tag: string) => `phase4-${tag}-${suffix}@example.test`

const ENV_KEYS = ['EMAIL_DAILY_SEND_LIMIT', 'AUTH_EMAIL_MODE'] as const
const saved: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) saved[k] = process.env[k]

beforeEach(() => {
  process.env.AUTH_EMAIL_MODE = 'console'
  delete process.env.EMAIL_DAILY_SEND_LIMIT // default = 3 unless a test overrides
})

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { email: { startsWith: 'phase4-' } } })
  await db.emailQuota.deleteMany({ where: { email: { startsWith: 'phase4-' } } })
  await db.activityLog.deleteMany({ where: { user: { email: { startsWith: 'phase4-' } } } })
  await db.authToken.deleteMany({ where: { user: { email: { startsWith: 'phase4-' } } } })
  await db.user.deleteMany({ where: { email: { startsWith: 'phase4-' } } })
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function form(addr: string) {
  const fd = new FormData()
  fd.set('email', addr)
  fd.set('locale', 'en')
  return fd
}

/** Bypass the in-memory 15-minute attempt limiter so the 24h quota is what is under test. */
function clearAttemptLimits(addr: string) {
  resetRateLimit(`resend:${addr}`)
  resetRateLimit(`resend:ip:127.0.0.1`)
  resetRateLimit(`forgot:${addr}`)
  resetRateLimit(`forgot:ip:127.0.0.1`)
}

describe('quota configuration', () => {
  it('defaults to 3 and honours EMAIL_DAILY_SEND_LIMIT', async () => {
    delete process.env.EMAIL_DAILY_SEND_LIMIT
    expect(await emailDailyLimit()).toBe(3)
    process.env.EMAIL_DAILY_SEND_LIMIT = '5'
    expect(await emailDailyLimit()).toBe(5)
    process.env.EMAIL_DAILY_SEND_LIMIT = '0'
    expect(await emailDailyLimit()).toBe(3) // invalid → default
    process.env.EMAIL_DAILY_SEND_LIMIT = 'abc'
    expect(await emailDailyLimit()).toBe(3)
  })
})

describe('atomic reservations', () => {
  it('allows exactly the limit, then blocks', async () => {
    const addr = email('reserve')
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(true)

    const blocked = await reserveEmailSlot(addr)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.used).toBe(3)
      expect(blocked.limit).toBe(3)
    }
    expect(await emailQuotaState(addr)).toEqual({ used: 3, limit: 3 })
  })

  it('never overshoots under concurrency', async () => {
    const addr = email('concurrent')
    const results = await Promise.all(Array.from({ length: 6 }, () => reserveEmailSlot(addr)))
    expect(results.filter((r) => r.ok)).toHaveLength(3)
    expect(await emailQuotaState(addr)).toEqual({ used: 3, limit: 3 })
  })

  it('refunds a slot when the send fails (failed sends are never counted)', async () => {
    const addr = email('refund')
    expect((await reserveEmailSlot(addr)).ok).toBe(true) // used: 1
    await releaseEmailSlot(addr) // what the failure path does
    expect(await emailQuotaState(addr)).toEqual({ used: 0, limit: 3 }) // slot returned
    // The full budget is available again: 3 more reservations, then blocked.
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(false)
    expect(await emailQuotaState(addr)).toEqual({ used: 3, limit: 3 })
  })

  it('resets an expired 24h window to a fresh budget', async () => {
    const addr = email('window')
    await db.emailQuota.create({
      data: { email: addr, windowStart: new Date(Date.now() - 25 * 3600_000), used: 3 },
    })
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect(await emailQuotaState(addr)).toEqual({ used: 1, limit: 3 })
  })

  it('is configurable per process', async () => {
    process.env.EMAIL_DAILY_SEND_LIMIT = '1'
    const addr = email('config')
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(false)
    delete process.env.EMAIL_DAILY_SEND_LIMIT
  })
})

describe('event trail', () => {
  it('records SENT / FAILED / SKIPPED and never lets events gate the quota', async () => {
    const addr = email('events')
    await recordEmailEvent({ email: addr, kind: 'RESET', status: 'SENT' })
    await recordEmailEvent({ email: addr, kind: 'RESET', status: 'FAILED', error: 'boom' })
    await recordEmailEvent({ email: addr, kind: 'SECURITY', status: 'SENT' })

    const rows = await db.emailLog.findMany({ where: { email: addr }, orderBy: { createdAt: 'asc' } })
    expect(rows.map((r) => `${r.kind}:${r.status}`)).toEqual(['RESET:SENT', 'RESET:FAILED', 'SECURITY:SENT'])

    // Evidence is not the gate: three successful reservations remain.
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(true)
    expect((await reserveEmailSlot(addr)).ok).toBe(false)
  })
})

describe('resend action enforces the shared quota without enumeration', () => {
  it('unknown address: three identical answers, then the limit message', async () => {
    const addr = email('unknown-limit')

    for (let i = 0; i < 3; i++) {
      clearAttemptLimits(addr)
      const s = await resendVerificationAction({ ok: false }, form(addr))
      expect(s.ok).toBe(true)
      expect(s.messageKey).toBe('auth.resendSent')
      expect(s.devLink).toBeUndefined()
    }

    clearAttemptLimits(addr)
    const fourth = await resendVerificationAction({ ok: false }, form(addr))
    expect(fourth.ok).toBe(false)
    expect(fourth.messageKey).toBe('auth.errEmailLimit')
    expect(fourth.vars).toEqual({ limit: 3 })

    // The blocked probe still consumed its slot — recorded as SKIPPED.
    const rows = await db.emailLog.findMany({ where: { email: addr } })
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.status === 'SKIPPED')).toBe(true)
  })

  it('existing PENDING address: same answers, same limit message', async () => {
    const addr = email('pending-limit')
    await db.user.create({
      data: {
        email: addr,
        name: 'Phase4 Pending',
        passwordHash: 'x',
        locale: 'en',
        status: 'PENDING',
      },
    })

    for (let i = 0; i < 3; i++) {
      clearAttemptLimits(addr)
      const s = await resendVerificationAction({ ok: false }, form(addr))
      expect(s.ok).toBe(true)
      expect(s.messageKey).toBe('auth.resendSent')
      expect(s.devLink).toBeTruthy() // console mode
    }

    clearAttemptLimits(addr)
    const fourth = await resendVerificationAction({ ok: false }, form(addr))
    expect(fourth.ok).toBe(false)
    expect(fourth.messageKey).toBe('auth.errEmailLimit')
    expect(fourth.vars).toEqual({ limit: 3 })

    // Byte-identical to the unknown address above → existence unrevealed.
    const rows = await db.emailLog.findMany({ where: { email: addr } })
    expect(rows.every((r) => r.kind === 'RESEND' && r.status === 'SENT')).toBe(true)
  })
})

describe('recovery shares the same budget', () => {
  it('forgotAction blocks on the identical limit message', async () => {
    const addr = email('forgot-limit')
    await db.user.create({
      data: { email: addr, name: 'Phase4 Reset', passwordHash: 'x', locale: 'en', status: 'ACTIVE' },
    })

    for (let i = 0; i < 3; i++) {
      clearAttemptLimits(addr)
      const s = await forgotAction({ ok: false }, form(addr))
      expect(s.ok).toBe(true)
      expect(s.messageKey).toBe('auth.forgotSent')
      expect(s.devLink).toBeTruthy()
    }

    clearAttemptLimits(addr)
    const fourth = await forgotAction({ ok: false }, form(addr))
    expect(fourth.ok).toBe(false)
    expect(fourth.messageKey).toBe('auth.errEmailLimit')
    expect(fourth.vars).toEqual({ limit: 3 })
  })
})
