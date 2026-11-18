import { z } from 'zod'

const password = z
  .string()
  .min(8, 'auth.errWeakPassword')
  .regex(/[A-Za-z]/, 'auth.errWeakPassword')
  .regex(/[0-9]/, 'auth.errWeakPassword')

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'auth.errNameRequired').max(80),
    email: z.string().trim().toLowerCase().email('auth.errInvalidEmail').max(190),
    password,
    confirmPassword: z.string(),
    locale: z.enum(['ar', 'fr', 'en']).optional(),
    // Academic information — optional
    country: z.string().trim().max(80, 'errors.tooLong').optional().or(z.literal('')),
    city: z.string().trim().max(80, 'errors.tooLong').optional().or(z.literal('')),
    school: z.string().trim().max(120, 'errors.tooLong').optional().or(z.literal('')),
    academicLevel: z.string().trim().max(80, 'errors.tooLong').optional().or(z.literal('')),
    program: z.string().trim().max(120, 'errors.tooLong').optional().or(z.literal('')),
    academicYear: z.string().trim().max(40, 'errors.tooLong').optional().or(z.literal('')),
    preferredLanguage: z.enum(['ar', 'fr', 'en']).optional().or(z.literal('')),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('auth.errInvalidEmail'),
  password: z.string().min(1, 'auth.errInvalidCredentials'),
})

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('auth.errInvalidEmail'),
})

export const resetSchema = z
  .object({
    token: z.string().min(10),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  bio: z.string().max(1000).optional().or(z.literal('')),
  school: z.string().max(120).optional().or(z.literal('')),
  program: z.string().max(120).optional().or(z.literal('')),
  timezone: z.string().max(60).optional().or(z.literal('')),
  // Academic information — optional
  country: z.string().max(80, 'errors.tooLong').optional().or(z.literal('')),
  city: z.string().max(80, 'errors.tooLong').optional().or(z.literal('')),
  academicLevel: z.string().max(80, 'errors.tooLong').optional().or(z.literal('')),
  academicYear: z.string().max(40, 'errors.tooLong').optional().or(z.literal('')),
  preferredLanguage: z.enum(['ar', 'fr', 'en']).optional().or(z.literal('')),
})

export const yearSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    description: z.string().max(400).optional().or(z.literal('')),
    isCurrent: z.boolean().optional(),
  })
  .refine((v) => new Date(v.endDate) > new Date(v.startDate), {
    message: 'academic.endBeforeStart',
    path: ['endDate'],
  })

export const semesterSchema = z
  .object({
    academicYearId: z.string().min(1),
    name: z.string().trim().min(1).max(60),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    isCurrent: z.boolean().optional(),
  })
  .refine((v) => new Date(v.endDate) > new Date(v.startDate), {
    message: 'academic.endBeforeStart',
    path: ['endDate'],
  })

export const specializationSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(400).optional().or(z.literal('')),
  program: z.string().max(120).optional().or(z.literal('')),
})

export const subjectSchema = z.object({
  semesterId: z.string().optional().nullable(),
  specializationId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(600).optional().or(z.literal('')),
  icon: z.string().max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  coefficient: z.coerce.number().min(0).max(20).optional(),
  importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  examDate: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).max(2000).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export const chapterSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(600).optional().or(z.literal('')),
})

export const lessonSchema = z.object({
  chapterId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(140),
  description: z.string().max(1200).optional().or(z.literal('')),
  estimatedMinutes: z.coerce.number().int().min(1).max(1440),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export const lessonStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVISION']),
})

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

export const sessionSchema = z
  .object({
    subjectId: z.string().min(1),
    chapterId: z.string().optional().nullable(),
    lessonId: z.string().optional().nullable(),
    date: z.string().min(1),
    startTime: z.string().regex(timeRe),
    endTime: z.string().regex(timeRe),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    notes: z.string().max(1000).optional().or(z.literal('')),
  })
  .refine((v) => v.endTime > v.startTime, { message: 'calendar.endBeforeStart', path: ['endTime'] })

export const availabilitySchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(timeRe),
    endTime: z.string().regex(timeRe),
  })
  .refine((v) => v.endTime > v.startTime, { message: 'calendar.endBeforeStart', path: ['endTime'] })

export const preferenceSchema = z.object({
  maxDailyMinutes: z.coerce.number().int().min(30).max(960),
  preferredSessionMin: z.coerce.number().int().min(10).max(240),
  breakMinutes: z.coerce.number().int().min(0).max(120),
  remindBeforeMin: z.coerce.number().int().min(0).max(240),
  pomodoroStudyMin: z.coerce.number().int().min(5).max(120),
  pomodoroBreakMin: z.coerce.number().int().min(1).max(60),
  pomodoroLongBreakMin: z.coerce.number().int().min(5).max(120),
  pomodoroCycles: z.coerce.number().int().min(1).max(12),
  notificationsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
})

export const examSchema = z
  .object({
    subjectId: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    date: z.string().min(1),
    importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    notes: z.string().max(1000).optional().or(z.literal('')),
  })

export const noteSchema = z.object({
  kind: z.enum(['TEXT', 'LINK']).default('TEXT'),
  title: z.string().trim().min(1).max(140),
  content: z.string().max(20000).optional().or(z.literal('')),
  subjectId: z.string().optional().nullable(),
  chapterId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  semesterId: z.string().optional().nullable(),
})

export const resourceSchema = z.object({
  name: z.string().trim().min(1).max(140),
  kind: z.enum(['FILE', 'LINK']),
  url: z.string().max(2048).optional().or(z.literal('')),
  subjectId: z.string().optional().nullable(),
  chapterId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
})

export const plannerSchema = z.object({
  subjectIds: z.array(z.string()).min(1),
  days: z.coerce.number().int().min(1).max(90),
  replaceExisting: z.boolean().optional(),
  sessionMinutes: z.coerce.number().int().min(10).max(240).optional(),
})

export const rescheduleSchema = z.object({
  sessionId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
  reason: z.string().max(300).optional().or(z.literal('')),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SubjectInput = z.infer<typeof subjectSchema>
export type LessonInput = z.infer<typeof lessonSchema>
export type SessionInput = z.infer<typeof sessionSchema>
export type ExamInput = z.infer<typeof examSchema>
export type NoteInput = z.infer<typeof noteSchema>
export type PlannerInput = z.infer<typeof plannerSchema>
