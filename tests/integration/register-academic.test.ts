import { afterAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { registerAction } from '@/actions/auth'

/**
 * Phase 1 — academic profile at registration.
 *
 * Calls the real server action with a real FormData, asserts the optional
 * academic fields are validated and persisted, then deletes ONLY the
 * throwaway user created here (teardown).
 */

const suffix = randomBytes(4).toString('hex')
const email = `phase1-${suffix}@example.test`

function buildForm(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('name', 'Phase One Student')
  fd.set('email', email)
  fd.set('password', 'secret123')
  fd.set('confirmPassword', 'secret123')
  fd.set('locale', 'fr')
  fd.set('country', 'Mauritania')
  fd.set('city', 'Nouakchott')
  fd.set('school', 'University of Nouakchott')
  fd.set('academicLevel', 'Bachelor')
  fd.set('program', 'Computer Science')
  fd.set('academicYear', '2026/2027')
  fd.set('preferredLanguage', 'ar')
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

afterAll(async () => {
  // activityLog first (fire-and-forget writes may still be in flight), then the user.
  await db.emailLog.deleteMany({ where: { email: { startsWith: 'phase1-' } } })
  await db.emailQuota.deleteMany({ where: { email: { startsWith: 'phase1-' } } })
  await db.activityLog.deleteMany({ where: { user: { email: { startsWith: 'phase1-' } } } })
  await db.user.deleteMany({ where: { email: { startsWith: 'phase1-' } } })
})

describe('registration with academic profile (phase 1)', () => {
  it('persists the optional academic fields on the profile', async () => {
    // registerAction ends in redirect() which throws NEXT_REDIRECT in tests.
    await expect(registerAction({ ok: false }, buildForm())).rejects.toThrow()

    const user = await db.user.findUnique({
      where: { email },
      include: { profile: true },
    })
    expect(user).not.toBeNull()
    expect(user!.status).toBe('PENDING')

    const p = user!.profile!
    expect(p.country).toBe('Mauritania')
    expect(p.city).toBe('Nouakchott')
    expect(p.school).toBe('University of Nouakchott')
    expect(p.academicLevel).toBe('Bachelor')
    expect(p.program).toBe('Computer Science')
    expect(p.academicYear).toBe('2026/2027')
    expect(p.preferredLanguage).toBe('ar')
  })

  it('stores empty academic fields as null, not empty strings', async () => {
    // A second registration without academic info (different email).
    const email2 = `phase1-empty-${suffix}@example.test`
    const fd = buildForm({ country: '', city: '', school: '', academicLevel: '', program: '', academicYear: '', preferredLanguage: '' })
    fd.set('email', email2)

    await expect(registerAction({ ok: false }, fd)).rejects.toThrow()

    const user = await db.user.findUnique({ where: { email: email2 }, include: { profile: true } })
    expect(user).not.toBeNull()
    expect(user!.profile!.country).toBeNull()
    expect(user!.profile!.preferredLanguage).toBeNull()

    await db.user.deleteMany({ where: { email: email2 } })
  })

  it('rejects an unsupported preferredLanguage before creating anything', async () => {
    const email3 = `phase1-badlang-${suffix}@example.test`
    const fd = buildForm({ preferredLanguage: 'de' })
    fd.set('email', email3)

    const r = await registerAction({ ok: false }, fd)
    expect(r.ok).toBe(false)
    expect(r.errors?.preferredLanguage).toBeTruthy()

    const count = await db.user.count({ where: { email: email3 } })
    expect(count).toBe(0)
  })})
