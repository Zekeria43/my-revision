import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'crypto'

/**
 * Phase 6 — the /owner console.
 *
 *  - requireOwner routes every non-owner somewhere safe (real DB sessions)
 *  - owner actions work for the owner and fail closed for everyone else
 *  - OWNER accounts are untouchable — by owner actions AND admin actions
 *  - self-lockout protection (an owner cannot demote/suspend/delete self)
 *  - destructive delete requires typing the target's email
 *  - REGISTRATION_OPEN=true/false is enforced by registerAction
 *  - EMAIL_DAILY_SEND_LIMIT DB setting overrides the environment value
 *  - login lands each role on its own panel (/owner | /admin | /dashboard)
 *
 * `next/headers` is mocked with a mutable cookie jar so the real guards run
 * against real DB rows. Only rows created here (emails prefixed `phase6-`)
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { db } from '@/lib/db'
import { loginAction, registerAction } from '@/actions/auth'
import {
  ownerDeleteUser,
  ownerSetUserRole,
  ownerSetUserStatus,
  ownerVerifyUser,
  saveOwnerSetting,
} from '@/actions/owner'
import { setUserRole, setUserStatus } from '@/actions/admin'
import { requireOwner } from '@/lib/auth/guards'
import { emailDailyLimit } from '@/lib/email-quota'
import { setPlatformSetting } from '@/lib/platform-settings'
import { SESSION_COOKIE, createSession, hashPassword } from '@/lib/auth/session'

const suffix = randomBytes(4).toString('hex')
const email = (tag: string) => `phase6-${tag}-${suffix}@example.test`

const ENV_KEYS = ['AUTH_EMAIL_MODE', 'EMAIL_DAILY_SEND_LIMIT'] as const
const saved: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) saved[k] = process.env[k]

beforeEach(() => {
  process.env.AUTH_EMAIL_MODE = 'console'
  delete process.env.EMAIL_DAILY_SEND_LIMIT
  jar.map.clear()
})

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { email: { startsWith: 'phase6-' } } })
  await db.emailQuota.deleteMany({ where: { email: { startsWith: 'phase6-' } } })
  await db.session.deleteMany({ where: { user: { email: { startsWith: 'phase6-' } } } })
  await db.activityLog.deleteMany({ where: { user: { email: { startsWith: 'phase6-' } } } })
  await db.authToken.deleteMany({ where: { user: { email: { startsWith: 'phase6-' } } } })
  await db.adminAuditLog.deleteMany({
    where: { OR: [{ admin: { email: { startsWith: 'phase6-' } } }, { target: { email: { startsWith: 'phase6-' } } }] },
  })
  await db.user.deleteMany({ where: { email: { startsWith: 'phase6-' } } })
  await db.platformSetting.deleteMany({ where: { key: { in: ['REGISTRATION_OPEN', 'EMAIL_DAILY_SEND_LIMIT'] } } })
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

async function makeUser(tag: string, opts: { role?: 'STUDENT' | 'ADMIN' | 'OWNER'; status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED'; password?: string } = {}) {
  return db.user.create({
    data: {
      email: email(tag),
      name: `Phase6 ${tag}`,
      passwordHash: await hashPassword(opts.password ?? 'Testing123'),
      role: opts.role ?? 'STUDENT',
      status: opts.status ?? 'ACTIVE',
      locale: 'en',
      ...(opts.status === undefined || opts.status === 'ACTIVE' ? { emailVerifiedAt: new Date() } : {}),
    },
  })
}

/** Log a user in through the real session machinery (sets the mocked cookie). */
async function logIn(userId: string) {
  await createSession(userId)
  // createSession sets the cookie through the mocked jar already.
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

/* ───────────────────────── Guard routing ───────────────────────── */

describe('requireOwner routing', () => {
  it('sends anonymous visitors to /login', async () => {
    const digest = await catchRedirect(requireOwner())
    expect(digest).toContain('/login')
  })

  it('sends students to /dashboard', async () => {
    const u = await makeUser('guard-student')
    await logIn(u.id)
    const digest = await catchRedirect(requireOwner())
    expect(digest).toContain('/dashboard')
  })

  it('sends admins to /admin', async () => {
    const u = await makeUser('guard-admin', { role: 'ADMIN' })
    await logIn(u.id)
    const digest = await catchRedirect(requireOwner())
    expect(digest).toContain('/admin')
  })

  it('lets the owner through', async () => {
    const u = await makeUser('guard-owner', { role: 'OWNER' })
    await logIn(u.id)
    const owner = await requireOwner()
    expect(owner.id).toBe(u.id)
  })
})

/* ───────────────────────── Owner actions happy path ───────────────────────── */

describe('owner actions (owner session)', () => {
  it('promotes and demotes between STUDENT and ADMIN, with an audit trail', async () => {
    const owner = await makeUser('act-owner', { role: 'OWNER' })
    const target = await makeUser('act-student')
    await logIn(owner.id)

    const promote = await ownerSetUserRole({ ok: false }, fd({ targetId: target.id, role: 'ADMIN', locale: 'en' }))
    expect(promote.ok).toBe(true)
    expect(promote.messageKey).toBe('owner.userUpdated')
    expect((await db.user.findUnique({ where: { id: target.id } }))!.role).toBe('ADMIN')

    const demote = await ownerSetUserRole({ ok: false }, fd({ targetId: target.id, role: 'STUDENT', locale: 'en' }))
    expect(demote.ok).toBe(true)
    expect((await db.user.findUnique({ where: { id: target.id } }))!.role).toBe('STUDENT')

    const audits = await db.adminAuditLog.findMany({ where: { adminId: owner.id, action: 'SET_ROLE' } })
    expect(audits).toHaveLength(2)
  })

  it('suspends and kills every live session, then reactivates', async () => {
    const owner = await makeUser('susp-owner', { role: 'OWNER' })
    const target = await makeUser('susp-target')
    await db.session.create({
      data: {
        userId: target.id,
        tokenHash: `phase6-stale-${suffix}`,
        userAgent: 'test',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    })
    await logIn(owner.id)

    const suspend = await ownerSetUserStatus({ ok: false }, fd({ targetId: target.id, status: 'SUSPENDED', locale: 'en' }))
    expect(suspend.ok).toBe(true)
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0)
    expect((await db.user.findUnique({ where: { id: target.id } }))!.status).toBe('SUSPENDED')

    const reactivate = await ownerSetUserStatus({ ok: false }, fd({ targetId: target.id, status: 'ACTIVE', locale: 'en' }))
    expect(reactivate.ok).toBe(true)
  })

  it('manually verifies a PENDING account and clears verify tokens', async () => {
    const owner = await makeUser('ver-owner', { role: 'OWNER' })
    const target = await makeUser('ver-target', { status: 'PENDING' })
    await db.authToken.create({
      data: { userId: target.id, type: 'VERIFY_EMAIL', tokenHash: 'phase6-vtok', expiresAt: new Date(Date.now() + 86_400_000) },
    })
    await logIn(owner.id)

    const r = await ownerVerifyUser(target.id, 'en')
    expect(r.ok).toBe(true)
    const after = await db.user.findUnique({ where: { id: target.id } })
    expect(after!.status).toBe('ACTIVE')
    expect(after!.emailVerifiedAt).not.toBeNull()
    expect(await db.authToken.count({ where: { userId: target.id, type: 'VERIFY_EMAIL' } })).toBe(0)
  })

  it('requires typing the exact email to delete, then deletes with data', async () => {
    const owner = await makeUser('del-owner', { role: 'OWNER' })
    const target = await makeUser('del-target')
    await db.subject.create({
      data: { userId: target.id, name: 'Math', coefficient: 2, order: 0 },
    })
    await logIn(owner.id)

    const wrong = await ownerDeleteUser({ ok: false }, fd({ targetId: target.id, confirmEmail: 'WRONG@x.test', locale: 'en' }))
    expect(wrong.ok).toBe(false)
    expect(wrong.messageKey).toBe('owner.deleteMismatch')
    expect(await db.user.findUnique({ where: { id: target.id } })).not.toBeNull()

    const right = await ownerDeleteUser({ ok: false }, fd({ targetId: target.id, confirmEmail: target.email.toUpperCase(), locale: 'en' }))
    expect(right.ok).toBe(true)
    expect(right.messageKey).toBe('owner.userDeleted')
    expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull()
    expect(await db.subject.count({ where: { userId: target.id } })).toBe(0)

    // The audit row survives with the target unlinked (SetNull).
    const audit = await db.adminAuditLog.findFirst({ where: { adminId: owner.id, action: 'DELETE_USER' } })
    expect(audit).not.toBeNull()
    expect(audit!.targetId).toBeNull()
  })

  it('saves platform settings and writes an audit entry', async () => {
    const owner = await makeUser('set-owner', { role: 'OWNER' })
    await logIn(owner.id)

    const bad = await saveOwnerSetting({ ok: false }, fd({ key: 'EMAIL_DAILY_SEND_LIMIT', value: '0', locale: 'en' }))
    expect(bad.ok).toBe(false)

    const r = await saveOwnerSetting({ ok: false }, fd({ key: 'EMAIL_DAILY_SEND_LIMIT', value: '7', locale: 'en' }))
    expect(r.ok).toBe(true)
    expect(r.messageKey).toBe('owner.settingSaved')
    expect(await db.platformSetting.findUnique({ where: { key: 'EMAIL_DAILY_SEND_LIMIT' } })).toMatchObject({
      value: '7',
      updatedBy: owner.id,
    })
    expect((await db.adminAuditLog.findMany({ where: { adminId: owner.id, action: 'SET_SETTING' } }))).toHaveLength(1)
  })
})

/* ───────────────────────── Permission matrix ───────────────────────── */

describe('owner actions fail closed', () => {
  it('rejects an admin session with a redirect to /admin', async () => {
    const admin = await makeUser('px-admin', { role: 'ADMIN' })
    const target = await makeUser('px-target')
    await logIn(admin.id)

    const digest = await catchRedirect(ownerSetUserRole({ ok: false }, fd({ targetId: target.id, role: 'ADMIN', locale: 'en' })))
    expect(digest).toContain('/admin')
    expect((await db.user.findUnique({ where: { id: target.id } }))!.role).toBe('STUDENT')
  })

  it('rejects a student session with a redirect to /dashboard', async () => {
    const student = await makeUser('px-student')
    await logIn(student.id)
    const digest = await catchRedirect(saveOwnerSetting({ ok: false }, fd({ key: 'REGISTRATION_OPEN', value: 'false', locale: 'en' })))
    expect(digest).toContain('/dashboard')
    expect(await db.platformSetting.findUnique({ where: { key: 'REGISTRATION_OPEN' } })).toBeNull()
  })

  it('rejects an anonymous caller with a redirect to /login', async () => {
    const digest = await catchRedirect(ownerVerifyUser('whatever'))
    expect(digest).toContain('/login')
  })

  it('protects OWNER accounts from owner actions', async () => {
    const owner = await makeUser('px-owner1', { role: 'OWNER' })
    const owner2 = await makeUser('px-owner2', { role: 'OWNER' })
    await logIn(owner.id)

    expect((await ownerSetUserRole({ ok: false }, fd({ targetId: owner2.id, role: 'STUDENT', locale: 'en' }))).messageKey).toBe(
      'errors.forbidden',
    )
    expect((await ownerSetUserStatus({ ok: false }, fd({ targetId: owner2.id, status: 'SUSPENDED', locale: 'en' }))).messageKey).toBe(
      'errors.forbidden',
    )
    expect((await ownerVerifyUser(owner2.id, 'en')).messageKey).toBe('errors.forbidden')
    expect(
      (await ownerDeleteUser({ ok: false }, fd({ targetId: owner2.id, confirmEmail: owner2.email, locale: 'en' }))).messageKey,
    ).toBe('errors.forbidden')
  })

  it('protects OWNER accounts from admin actions', async () => {
    const admin = await makeUser('px-admin2', { role: 'ADMIN' })
    const owner2 = await makeUser('px-owner3', { role: 'OWNER' })
    await logIn(admin.id)

    expect((await setUserStatus({ ok: false }, fd({ targetId: owner2.id, status: 'SUSPENDED', locale: 'en' }))).messageKey).toBe(
      'errors.forbidden',
    )
    expect((await setUserRole({ ok: false }, fd({ targetId: owner2.id, role: 'STUDENT', locale: 'en' }))).messageKey).toBe(
      'errors.forbidden',
    )
  })

  it('blocks self-lockout: an owner cannot demote, suspend or delete themselves', async () => {
    const owner = await makeUser('px-owner4', { role: 'OWNER' })
    await logIn(owner.id)

    expect((await ownerSetUserRole({ ok: false }, fd({ targetId: owner.id, role: 'STUDENT', locale: 'en' }))).messageKey).toBe(
      'errors.forbidden',
    )
    expect((await ownerSetUserStatus({ ok: false }, fd({ targetId: owner.id, status: 'SUSPENDED', locale: 'en' }))).messageKey).toBe(
      'errors.forbidden',
    )
    expect(
      (await ownerDeleteUser({ ok: false }, fd({ targetId: owner.id, confirmEmail: owner.email, locale: 'en' }))).messageKey,
    ).toBe('errors.forbidden')
  })
})

/* ───────────────────────── Platform settings enforcement ───────────────────────── */

describe('settings enforcement', () => {
  it('registerAction refuses when REGISTRATION_OPEN=false', async () => {
    await setPlatformSetting('REGISTRATION_OPEN', 'false', null)
    const fdForm = fd({
      name: 'Phase6 Closed',
      email: email('reg-closed'),
      password: 'secret123',
      confirmPassword: 'secret123',
      locale: 'en',
      country: 'Mauritania',
      city: 'Nouakchott',
      school: 'University of Nouakchott',
      academicLevel: 'Bachelor',
      program: 'Computer Science',
      academicYear: '2026/2027',
      preferredLanguage: 'ar',
    })
    const r = await registerAction({ ok: false }, fdForm)
    expect(r.ok).toBe(false)
    expect(r.messageKey).toBe('auth.errRegistrationClosed')
    expect(await db.user.findUnique({ where: { email: email('reg-closed') } })).toBeNull()
  })

  it('registerAction works again once registration reopens', async () => {
    await setPlatformSetting('REGISTRATION_OPEN', 'true', null)
    const addr = email('reg-open')
    await expect(
      registerAction(
        { ok: false },
        fd({
          name: 'Phase6 Open',
          email: addr,
          password: 'secret123',
          confirmPassword: 'secret123',
          locale: 'en',
          country: 'Mauritania',
          city: 'Nouakchott',
          school: 'University of Nouakchott',
          academicLevel: 'Bachelor',
          program: 'Computer Science',
          academicYear: '2026/2027',
          preferredLanguage: 'ar',
        }),
      ),
    ).rejects.toThrow() // ends in redirect → account created
    expect((await db.user.findUnique({ where: { email: addr } }))!.status).toBe('PENDING')
  })

  it('EMAIL_DAILY_SEND_LIMIT in the DB overrides the environment value', async () => {
    await db.platformSetting.deleteMany({ where: { key: 'EMAIL_DAILY_SEND_LIMIT' } })
    process.env.EMAIL_DAILY_SEND_LIMIT = '5'
    expect(await emailDailyLimit()).toBe(5) // env wins while no DB row exists
    await setPlatformSetting('EMAIL_DAILY_SEND_LIMIT', '9', null)
    expect(await emailDailyLimit()).toBe(9) // DB row wins over env
    await db.platformSetting.delete({ where: { key: 'EMAIL_DAILY_SEND_LIMIT' } })
    expect(await emailDailyLimit()).toBe(5) // back to env
    delete process.env.EMAIL_DAILY_SEND_LIMIT
    expect(await emailDailyLimit()).toBe(3) // back to default
  })
})

/* ───────────────────────── Login redirect by role ───────────────────────── */

describe('login lands each role on its own panel', () => {
  it('OWNER → /owner', async () => {
    const u = await makeUser('login-owner', { role: 'OWNER', password: 'OwnerPass1' })
    const digest = await catchRedirect(
      loginAction({ ok: false }, fd({ email: u.email, password: 'OwnerPass1', locale: 'en' })),
    )
    expect(digest).toContain('/en/owner')
  })

  it('ADMIN → /admin', async () => {
    const u = await makeUser('login-admin', { role: 'ADMIN', password: 'AdminPass1' })
    const digest = await catchRedirect(
      loginAction({ ok: false }, fd({ email: u.email, password: 'AdminPass1', locale: 'en' })),
    )
    expect(digest).toContain('/en/admin')
  })

  it('STUDENT → /dashboard', async () => {
    const u = await makeUser('login-student', { password: 'StudentPass1' })
    const digest = await catchRedirect(
      loginAction({ ok: false }, fd({ email: u.email, password: 'StudentPass1', locale: 'en' })),
    )
    expect(digest).toContain('/en/dashboard')
  })
})
