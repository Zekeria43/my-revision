import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'crypto'

/**
 * Portal separation — dedicated sign-in links so staff and students never
 * share a form:
 *
 *   /admin-login    → ADMIN + OWNER only
 *   /student-login  → STUDENT only
 *   /login          → general (every role, unchanged)
 *
 * The `portal` field is read from the form but validated SERVER-SIDE in
 * `loginAction`, AFTER password verification (so it can never be used to
 * enumerate accounts) and BEFORE any session row exists (so a mismatch never
 * leaves a usable session behind).
 *
 * Only rows created here (emails prefixed `portals-`) are deleted.
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { db } from '@/lib/db'
import { loginAction } from '@/actions/auth'
import { hashPassword } from '@/lib/auth/session'

const suffix = randomBytes(4).toString('hex')
const email = (tag: string) => `portals-${tag}-${suffix}@example.test`

beforeEach(() => {
  process.env.AUTH_EMAIL_MODE = 'console'
  jar.map.clear()
})

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { email: { startsWith: 'portals-' } } })
  await db.emailQuota.deleteMany({ where: { email: { startsWith: 'portals-' } } })
  await db.session.deleteMany({ where: { user: { email: { startsWith: 'portals-' } } } })
  await db.activityLog.deleteMany({ where: { user: { email: { startsWith: 'portals-' } } } })
  await db.authToken.deleteMany({ where: { user: { email: { startsWith: 'portals-' } } } })
  await db.user.deleteMany({ where: { email: { startsWith: 'portals-' } } })
})

async function makeUser(
  tag: string,
  opts: { role?: 'STUDENT' | 'ADMIN' | 'OWNER'; status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED'; password?: string } = {},
) {
  return db.user.create({
    data: {
      email: email(tag),
      name: `Portals ${tag}`,
      passwordHash: await hashPassword(opts.password ?? 'Testing123'),
      role: opts.role ?? 'STUDENT',
      status: opts.status ?? 'ACTIVE',
      locale: 'en',
      ...(opts.status === undefined || opts.status === 'ACTIVE' ? { emailVerifiedAt: new Date() } : {}),
    },
  })
}

function fd(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

/** Captures the NEXT_REDIRECT thrown by redirect() and returns its digest. */
async function catchRedirect(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return '' // no redirect happened
  } catch (e) {
    return String((e as { digest?: string; message?: string }).digest ?? (e as Error).message ?? '')
  }
}

const sessionsOf = (userId: string) => db.session.count({ where: { userId } })

/* ───────────────────────── Wrong portal fails closed ───────────────────────── */

describe('portal mismatch is rejected server-side', () => {
  it('a student cannot sign in through the staff portal', async () => {
    const u = await makeUser('stud-on-admin', { password: 'StudentPass1' })
    const state = await loginAction(
      { ok: false },
      fd({ email: u.email, password: 'StudentPass1', locale: 'en', portal: 'admin' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errWrongPortal')
    expect(await sessionsOf(u.id)).toBe(0)
  })

  it('an admin cannot sign in through the student portal', async () => {
    const u = await makeUser('admin-on-student', { role: 'ADMIN', password: 'AdminPass1' })
    const state = await loginAction(
      { ok: false },
      fd({ email: u.email, password: 'AdminPass1', locale: 'en', portal: 'student' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errWrongPortal')
    expect(await sessionsOf(u.id)).toBe(0)
  })

  it('the owner cannot sign in through the student portal', async () => {
    const u = await makeUser('owner-on-student', { role: 'OWNER', password: 'OwnerPass1' })
    const state = await loginAction(
      { ok: false },
      fd({ email: u.email, password: 'OwnerPass1', locale: 'en', portal: 'student' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errWrongPortal')
    expect(await sessionsOf(u.id)).toBe(0)
  })

  it('keeps reporting bad credentials as bad credentials (no enumeration)', async () => {
    const u = await makeUser('wrong-pass', { role: 'ADMIN', password: 'RightPass1' })
    const state = await loginAction(
      { ok: false },
      fd({ email: u.email, password: 'Totally-Wrong', locale: 'en', portal: 'admin' }),
    )
    expect(state.ok).toBe(false)
    // Must NOT reveal that the account exists on this portal.
    expect(state.messageKey).toBe('auth.errInvalidCredentials')
    expect(await sessionsOf(u.id)).toBe(0)
  })

  it('status checks still run before the portal check (PENDING stays PENDING)', async () => {
    const u = await makeUser('pending-on-student', { status: 'PENDING', password: 'PendingPass1' })
    const state = await loginAction(
      { ok: false },
      fd({ email: u.email, password: 'PendingPass1', locale: 'en', portal: 'student' }),
    )
    expect(state.ok).toBe(false)
    expect(state.messageKey).toBe('auth.errPending')
    expect(await sessionsOf(u.id)).toBe(0)
  })
})

/* ───────────────────────── Right portal succeeds ───────────────────────── */

describe('each portal accepts its own audience', () => {
  it('staff portal → ADMIN lands on /admin', async () => {
    const u = await makeUser('admin-ok', { role: 'ADMIN', password: 'AdminPass1' })
    const digest = await catchRedirect(
      loginAction(
        { ok: false },
        fd({ email: u.email, password: 'AdminPass1', locale: 'en', portal: 'admin' }),
      ),
    )
    expect(digest).toContain('/en/admin')
    expect(await sessionsOf(u.id)).toBe(1)
  })

  it('staff portal → OWNER lands on /owner (owner counts as staff)', async () => {
    const u = await makeUser('owner-ok', { role: 'OWNER', password: 'OwnerPass1' })
    const digest = await catchRedirect(
      loginAction(
        { ok: false },
        fd({ email: u.email, password: 'OwnerPass1', locale: 'en', portal: 'admin' }),
      ),
    )
    expect(digest).toContain('/en/owner')
    expect(await sessionsOf(u.id)).toBe(1)
  })

  it('student portal → STUDENT lands on /dashboard', async () => {
    const u = await makeUser('stud-ok', { password: 'StudentPass1' })
    const digest = await catchRedirect(
      loginAction(
        { ok: false },
        fd({ email: u.email, password: 'StudentPass1', locale: 'en', portal: 'student' }),
      ),
    )
    expect(digest).toContain('/en/dashboard')
    expect(await sessionsOf(u.id)).toBe(1)
  })

  it('general /login (no portal) still accepts every role', async () => {
    const student = await makeUser('gen-stud', { password: 'StudentPass1' })
    const admin = await makeUser('gen-admin', { role: 'ADMIN', password: 'AdminPass1' })

    const s = await catchRedirect(
      loginAction({ ok: false }, fd({ email: student.email, password: 'StudentPass1', locale: 'en' })),
    )
    const a = await catchRedirect(
      loginAction({ ok: false }, fd({ email: admin.email, password: 'AdminPass1', locale: 'en' })),
    )
    expect(s).toContain('/en/dashboard')
    expect(a).toContain('/en/admin')
  })

  it('an unknown/garbage portal value behaves like the general login', async () => {
    const u = await makeUser('garbage-portal', { password: 'StudentPass1' })
    const digest = await catchRedirect(
      loginAction(
        { ok: false },
        fd({ email: u.email, password: 'StudentPass1', locale: 'en', portal: 'nonsense' }),
      ),
    )
    expect(digest).toContain('/en/dashboard')
  })
})
