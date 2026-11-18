import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'mv_session'

const days = Number(process.env.SESSION_DAYS ?? 30)
const maxAge = Math.max(1, days) * 24 * 60 * 60

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS ?? 12))
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Creates a server-side session row and sets the httpOnly cookie. */
export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = generateToken()
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
      ip: meta?.ip ?? null,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  })

  return token
}

/** Reads the current session user. Cached per request. */
export const getCurrentUser = cache(async () => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { profile: true, prefs: true } } },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (session.user.status === 'SUSPENDED') return null

  // lazy refresh of lastSeen (fire and forget, at most once a minute)
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    void db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined)
  }

  return session.user
})

export async function destroyCurrentSession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => undefined)
  }
  store.delete(SESSION_COOKIE)
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } }).catch(() => undefined)
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * Invalidates every session of `userId` EXCEPT the one bound to the current
 * cookie — used after a password change so the user stays signed in here
 * while any stolen/old session elsewhere dies immediately.
 */
export async function destroyOtherSessions(userId: string) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  await db.session
    .deleteMany({
      where: { userId, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) },
    })
    .catch(() => undefined)
}
