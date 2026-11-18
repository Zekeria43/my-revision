import { createHash } from 'crypto'
import { db } from '@/lib/db'

const TTL_VERIFY_MS = 24 * 60 * 60 * 1000
const TTL_RESET_MS = 60 * 60 * 1000

function h(v: string) {
  return createHash('sha256').update(v).digest('hex')
}

export async function issueToken(userId: string, type: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
  const raw = createHash('sha256')
    .update(`${userId}:${type}:${Date.now()}:${Math.random()}`)
    .digest('hex')

  // one live token per type
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } })
  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: h(raw),
      expiresAt: new Date(Date.now() + (type === 'VERIFY_EMAIL' ? TTL_VERIFY_MS : TTL_RESET_MS)),
    },
  })
  return raw
}

export async function consumeToken(raw: string, type: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
  const token = await db.authToken.findUnique({ where: { tokenHash: h(raw) } })
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) return null

  // Atomic single-use claim: of N concurrent callers only the one whose
  // UPDATE actually flips usedAt from NULL gets the userId back.
  const claimed = await db.authToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) return null
  return token.userId
}

/**
 * Read-only token check (never consumes) so pages can show an accurate
 * "expired" vs "invalid" message before the user types a new password.
 */
export async function peekToken(
  raw: string,
  type: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
): Promise<'ok' | 'expired' | 'used' | 'unknown'> {
  const token = await db.authToken.findUnique({ where: { tokenHash: h(raw) } })
  if (!token || token.type !== type) return 'unknown'
  if (token.usedAt) return 'used'
  if (token.expiresAt < new Date()) return 'expired'
  return 'ok'
}
