import { describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'crypto'

/**
 * Session token + password hashing.
 * `next/headers` is mocked — these are pure crypto checks.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined })),
}))

vi.mock('@/lib/db', () => ({ db: {} }))

import {
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '@/lib/auth/session'

describe('hashToken', () => {
  it('is deterministic and hex-encoded', () => {
    const h = hashToken('abc')
    expect(h).toBe(hashToken('abc'))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs for different tokens', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('never returns the raw token (one-way digest)', () => {
    const token = randomBytes(32).toString('base64url')
    const h = hashToken(token)
    expect(h).not.toContain(token)
    expect(h).toHaveLength(64)
  })
})

describe('generateToken', () => {
  it('produces distinct high-entropy tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()))
    expect(tokens.size).toBe(200)
    for (const t of tokens) expect(t.length).toBeGreaterThanOrEqual(40)
  })
})

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('Student12345')
    expect(hash).not.toBe('Student12345')
    expect(await verifyPassword('Student12345', hash)).toBe(true)
    expect(await verifyPassword('Student12346', hash)).toBe(false)
  })

  it('salts each hash (same input → different digests)', async () => {
    const a = await hashPassword('Student12345')
    const b = await hashPassword('Student12345')
    expect(a).not.toBe(b)
    expect(await verifyPassword('Student12345', a)).toBe(true)
    expect(await verifyPassword('Student12345', b)).toBe(true)
  })
})
