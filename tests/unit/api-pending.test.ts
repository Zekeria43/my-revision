import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Phase 3 — a PENDING (unverified) account must be refused by every raw
 * API surface, regardless of what the session cookie says.
 *
 * getCurrentUser is mocked; the route handlers themselves run for real.
 */

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>()
  return { ...actual, getCurrentUser: vi.fn() }
})

import { getCurrentUser } from '@/lib/auth/session'
import { GET as getCsv } from '@/app/api/export/csv/route'
import { GET as getData } from '@/app/api/export/data/route'
import { GET as getFile } from '@/app/api/files/[id]/route'
import { POST as postFile } from '@/app/api/files/route'

const mocked = vi.mocked(getCurrentUser)
type SessionUser = Awaited<ReturnType<typeof getCurrentUser>>

function sessionUser(status: string): SessionUser {
  return {
    id: `phase3-${status.toLowerCase()}`,
    email: `phase3-${status.toLowerCase()}@example.test`,
    name: 'Phase Three',
    role: 'STUDENT',
    status,
    locale: 'en',
    theme: 'dark',
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: null,
    prefs: null,
  } as unknown as SessionUser
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PENDING accounts are refused by every API route (phase 3)', () => {
  it('GET /api/export/csv → 403', async () => {
    mocked.mockResolvedValue(sessionUser('PENDING'))
    const res = await getCsv(new Request('http://localhost/api/export/csv?type=sessions'))
    expect(res.status).toBe(403)
  })

  it('GET /api/export/data → 403', async () => {
    mocked.mockResolvedValue(sessionUser('PENDING'))
    const res = await getData()
    expect(res.status).toBe(403)
  })

  it('GET /api/files/[id] → 403', async () => {
    mocked.mockResolvedValue(sessionUser('PENDING'))
    const res = await getFile(new Request('http://localhost/api/files/abc'), {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /api/files → 403', async () => {
    mocked.mockResolvedValue(sessionUser('PENDING'))
    const res = await postFile(new Request('http://localhost/api/files', { method: 'POST' }))
    expect(res.status).toBe(403)
  })
})

describe('session gate semantics stay intact (phase 3)', () => {
  it('no session → 401 on every route', async () => {
    mocked.mockResolvedValue(null)

    const csv = await getCsv(new Request('http://localhost/api/export/csv'))
    const data = await getData()
    const file = await getFile(new Request('http://localhost/api/files/abc'), {
      params: Promise.resolve({ id: 'abc' }),
    })
    const upload = await postFile(new Request('http://localhost/api/files', { method: 'POST' }))

    expect([csv.status, data.status, file.status, upload.status]).toEqual([401, 401, 401, 401])
  })

  it('an ACTIVE account passes the gate (200 / 404 = auth succeeded)', async () => {
    mocked.mockResolvedValue(sessionUser('ACTIVE'))

    const csv = await getCsv(new Request('http://localhost/api/export/csv?type=sessions'))
    expect(csv.status).toBe(200)

    const data = await getData()
    expect(data.status).toBe(200)

    // Known route, unknown resource: reaching 404 proves auth passed.
    const file = await getFile(new Request('http://localhost/api/files/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(file.status).toBe(404)
  })
})
