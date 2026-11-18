import { db } from '@/lib/db'
import { effectiveEmailDailyLimit } from '@/lib/platform-settings'

/**
 * Rolling 24-hour transactional-email quota.
 *
 * Spec: at most EMAIL_DAILY_SEND_LIMIT (default 3) successfully sent
 * verification / resend / recovery emails per address per rolling 24h,
 * shared across all three kinds, server-enforced, concurrency-safe,
 * failed sends refunded, configurable.
 *
 * Two tables with distinct jobs:
 *  - EmailQuota — a single counter row per address. Slots are reserved with
 *    a conditional UPDATE (`used < limit` → increment), which the database
 *    serialises per row, so N concurrent requests can never overshoot.
 *    A window older than 24h resets atomically to slot #1.
 *  - EmailLog   — the durable event trail (SENT / FAILED / SKIPPED) used by
 *    the owner dashboard and by audits. Events are evidence; the counter is
 *    the gate.
 *
 * Anti-enumeration: addresses WITHOUT an account also consume a slot, but
 * the event is recorded as SKIPPED instead of SENT. The caller therefore
 * receives the exact same sequence of answers (ok → ok → ok → limit) whether
 * or not the account exists.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000

/** Kinds that count against the quota. SECURITY notices do not. */
export const COUNTED_KINDS = ['VERIFY', 'RESEND', 'RESET'] as const
export type CountedKind = (typeof COUNTED_KINDS)[number]
export type EmailEventKind = CountedKind | 'SECURITY'

export type ReserveOk = { ok: true }
export type ReserveBlocked = { ok: false; used: number; limit: number }
export type ReserveResult = ReserveOk | ReserveBlocked

/**
 * Configurable limit — PlatformSetting (owner-editable) wins, then the
 * EMAIL_DAILY_SEND_LIMIT env var, then the default 3.
 */
export async function emailDailyLimit(): Promise<number> {
  return effectiveEmailDailyLimit()
}

const norm = (email: string) => email.trim().toLowerCase()

/**
 * Atomically consume one slot for `email` inside the rolling window.
 * Returns `{ ok: false }` when the address already used its daily budget.
 */
export async function reserveEmailSlot(email: string): Promise<ReserveResult> {
  const key = norm(email)
  const limit = await emailDailyLimit()
  const now = new Date()
  const cutoff = new Date(now.getTime() - WINDOW_MS)

  // 1) An expired window resets to exactly slot #1 (conditional, atomic).
  const reset = await db.emailQuota.updateMany({
    where: { email: key, windowStart: { lt: cutoff } },
    data: { windowStart: now, used: 1 },
  })
  if (reset.count === 1) return { ok: true }

  // 2) First-ever request for this address.
  const existing = await db.emailQuota.findUnique({ where: { email: key } })
  if (!existing) {
    try {
      await db.emailQuota.create({ data: { email: key, windowStart: now, used: 1 } })
      return { ok: true }
    } catch {
      // Lost the creation race against a concurrent caller — fall through
      // to the compare-and-set below.
    }
  }

  // 3) Compare-and-set: only succeeds while used < limit. Row-level updates
  //    are serialised by the database, so concurrent callers cannot pass.
  const inc = await db.emailQuota.updateMany({
    where: { email: key, used: { lt: limit } },
    data: { used: { increment: 1 } },
  })
  if (inc.count === 1) return { ok: true }

  const row = await db.emailQuota.findUnique({ where: { email: key } })
  return { ok: false, used: row?.used ?? limit, limit }
}

/** Refund a slot after a failed send — failed sends are never counted. */
export async function releaseEmailSlot(email: string): Promise<void> {
  await db.emailQuota.updateMany({
    where: { email: norm(email), used: { gt: 0 } },
    data: { used: { decrement: 1 } },
  })
}

export async function recordEmailEvent(input: {
  email: string
  kind: EmailEventKind
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  userId?: string | null
  error?: string | null
}): Promise<void> {
  try {
    await db.emailLog.create({
      data: {
        email: norm(input.email),
        kind: input.kind,
        status: input.status,
        userId: input.userId ?? null,
        error: input.error?.slice(0, 500) ?? null,
      },
    })
  } catch (e) {
    // The event trail must never break the user-facing action.
    console.error('[email-log] write failed', e)
  }
}

/** Current usage for an address (for dashboards and tests). */
export async function emailQuotaState(email: string): Promise<{ used: number; limit: number }> {
  const row = await db.emailQuota.findUnique({ where: { email: norm(email) } })
  const limit = await emailDailyLimit()
  const fresh = row && row.windowStart.getTime() > Date.now() - WINDOW_MS
  return { used: fresh ? row.used : 0, limit }
}
