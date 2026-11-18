import { describe, expect, it } from 'vitest'
import {
  availabilitySchema,
  changePasswordSchema,
  examSchema,
  lessonSchema,
  loginSchema,
  noteSchema,
  profileSchema,
  registerSchema,
  resourceSchema,
} from '@/lib/validation'

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const r = registerSchema.safeParse({
      name: 'Sara Ahmed',
      email: 'Sara@Example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      locale: 'ar',
    })
    expect(r.success).toBe(true)
    // email is normalised to lowercase
    if (r.success) expect(r.data.email).toBe('sara@example.com')
  })

  it('rejects a weak password (no digit)', () => {
    const r = registerSchema.safeParse({
      name: 'Sara',
      email: 'sara@example.com',
      password: 'secretabc',
      confirmPassword: 'secretabc',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'auth.errWeakPassword')).toBe(true)
    }
  })

  it('rejects a mismatched confirmation', () => {
    const r = registerSchema.safeParse({
      name: 'Sara',
      email: 'sara@example.com',
      password: 'secret123',
      confirmPassword: 'secret124',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'auth.passwordMismatch')).toBe(true)
    }
  })

  it('rejects an invalid email', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: 'x' })
    expect(r.success).toBe(false)
  })

  it('accepts a registration with optional academic fields', () => {
    const r = registerSchema.safeParse({
      name: 'Sara Ahmed',
      email: 'sara@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      locale: 'ar',
      country: 'Mauritania',
      city: 'Nouakchott',
      school: 'University of Nouakchott',
      academicLevel: 'Bachelor',
      program: 'Computer Science',
      academicYear: '2026/2027',
      preferredLanguage: 'fr',
    })
    expect(r.success).toBe(true)
  })

  it('accepts a registration without any academic fields', () => {
    const r = registerSchema.safeParse({
      name: 'Sara Ahmed',
      email: 'sara@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unsupported preferredLanguage', () => {
    const r = registerSchema.safeParse({
      name: 'Sara Ahmed',
      email: 'sara@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      preferredLanguage: 'de',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an over-long country', () => {
    const r = registerSchema.safeParse({
      name: 'Sara Ahmed',
      email: 'sara@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      country: 'x'.repeat(81),
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'errors.tooLong')).toBe(true)
    }
  })
})

describe('profileSchema (settings — phase 1)', () => {
  const base = { name: 'Sara Ahmed', bio: '', school: 'UO', program: 'CS', timezone: 'Africa/Nouakchott' }

  it('accepts empty optional academic fields', () => {
    const r = profileSchema.safeParse({
      ...base,
      country: '',
      city: '',
      academicLevel: '',
      academicYear: '',
      preferredLanguage: '',
    })
    expect(r.success).toBe(true)
  })

  it('accepts filled academic fields', () => {
    const r = profileSchema.safeParse({
      ...base,
      country: 'Mauritania',
      city: 'Nouakchott',
      academicLevel: 'Master',
      academicYear: '2026/2027',
      preferredLanguage: 'en',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unsupported preferredLanguage', () => {
    const r = profileSchema.safeParse({ ...base, preferredLanguage: 'de' })
    expect(r.success).toBe(false)
  })

  it('rejects an over-long academicYear', () => {
    const r = profileSchema.safeParse({ ...base, academicYear: 'x'.repeat(41) })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'errors.tooLong')).toBe(true)
    }
  })

  it('rejects a too-long name', () => {
    const r = profileSchema.safeParse({ ...base, name: 'x'.repeat(121) })
    expect(r.success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('requires the confirmation to match', () => {
    const ok = changePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'newpass12',
      confirmPassword: 'newpass12',
    })
    expect(ok.success).toBe(true)

    const bad = changePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'newpass12',
      confirmPassword: 'newpass99',
    })
    expect(bad.success).toBe(false)
  })
})

describe('examSchema', () => {
  it('accepts a valid exam and defaults are optional', () => {
    const r = examSchema.safeParse({
      subjectId: 's1',
      title: 'Final exam',
      date: '2026-06-01T09:00',
      importance: 'CRITICAL',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const r = examSchema.safeParse({
      subjectId: 's1',
      title: '   ',
      date: '2026-06-01T09:00',
    })
    expect(r.success).toBe(false)
  })
})

describe('noteSchema / resourceSchema', () => {
  it('accepts a minimal text note', () => {
    expect(noteSchema.safeParse({ kind: 'TEXT', title: 'My note' }).success).toBe(true)
  })

  it('rejects an over-long title', () => {
    expect(
      noteSchema.safeParse({ kind: 'TEXT', title: 'x'.repeat(200) }).success,
    ).toBe(false)
  })

  it('accepts a link resource', () => {
    const r = resourceSchema.safeParse({ name: 'Slides', kind: 'LINK', url: 'https://example.com' })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown resource kind', () => {
    expect(resourceSchema.safeParse({ name: 'x', kind: 'EXE' }).success).toBe(false)
  })
})

describe('lessonSchema / availabilitySchema', () => {
  it('accepts a lesson with an estimated duration', () => {
    const r = lessonSchema.safeParse({
      chapterId: 'c1',
      subjectId: 's1',
      title: 'Ch.1 — Limits',
      estimatedMinutes: 45,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a lesson without a chapter', () => {
    const r = lessonSchema.safeParse({ subjectId: 's1', title: 'Orphan', estimatedMinutes: 30 })
    expect(r.success).toBe(false)
  })

  it('accepts an availability window in HH:MM', () => {
    const r = availabilitySchema.safeParse({ weekday: 3, startTime: '18:00', endTime: '21:30' })
    expect(r.success).toBe(true)
  })
})
