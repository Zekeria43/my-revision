import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Phase 3 — server-side guards.
 *
 * redirect() is replaced with a throwing stub so each expectation reads
 * as "this guard sent the caller to exactly this URL".
 */

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>()
  return { ...actual, getCurrentUser: vi.fn() }
})

import { requireAdmin, requireUser } from '@/lib/auth/guards'
import { getCurrentUser } from '@/lib/auth/session'

const mocked = vi.mocked(getCurrentUser)
type SessionUser = Awaited<ReturnType<typeof getCurrentUser>>

function user(status: string, role: string): SessionUser {
  return {
    id: 'phase3-guard',
    email: 'phase3-guard@example.test',
    name: 'Phase Three',
    role,
    status,
    locale: 'en',
    theme: 'dark',
    emailVerifiedAt: status === 'ACTIVE' ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: null,
    prefs: null,
  } as unknown as SessionUser
}

beforeEach(() => {
  vi.clearAllMocks()
})

const sendsTo = (p: Promise<unknown>, url: string) => expect(p).rejects.toThrow(`REDIRECT:${url}`)

describe('requireUser (phase 3)', () => {
  it('sends anonymous visitors to /login', async () => {
    mocked.mockResolvedValue(null)
    await sendsTo(requireUser(), '/login')
  })

  it('sends a PENDING account to /verify-pending — verification is mandatory', async () => {
    mocked.mockResolvedValue(user('PENDING', 'STUDENT'))
    await sendsTo(requireUser(), '/verify-pending')
  })

  it('returns an ACTIVE account untouched', async () => {
    const u = user('ACTIVE', 'STUDENT')
    mocked.mockResolvedValue(u)
    await expect(requireUser()).resolves.toBe(u)
  })
})

describe('requireAdmin (phase 3)', () => {
  it('sends anonymous visitors to /login', async () => {
    mocked.mockResolvedValue(null)
    await sendsTo(requireAdmin(), '/login')
  })

  it('sends a PENDING admin to /verify-pending BEFORE any role check', async () => {
    mocked.mockResolvedValue(user('PENDING', 'ADMIN'))
    await sendsTo(requireAdmin(), '/verify-pending')
  })

  it('sends an active non-admin to /dashboard', async () => {
    mocked.mockResolvedValue(user('ACTIVE', 'STUDENT'))
    await sendsTo(requireAdmin(), '/dashboard')
  })

  it('returns an ACTIVE admin', async () => {
    const u = user('ACTIVE', 'ADMIN')
    mocked.mockResolvedValue(u)
    await expect(requireAdmin()).resolves.toBe(u)
  })
})
