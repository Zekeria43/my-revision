'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { logActivity } from '@/lib/activity'
import {
  chapterSchema,
  lessonSchema,
  lessonStatusSchema,
  semesterSchema,
  specializationSchema,
  subjectSchema,
  yearSchema,
} from '@/lib/validation'
import { overallProgress } from '@/lib/progress'
import type { ActionState } from './auth'

/**
 * Academic structure server actions.
 *
 * Every handler resolves the actor from the session (never from the client)
 * and scopes every query by `userId`. A student can never touch another
 * student's rows even by guessing an id.
 */

const fail = (m: string, errors?: Record<string, string[]>): ActionState => ({
  ok: false,
  messageKey: m,
  errors,
})
const ok = (m?: string): ActionState => ({ ok: true, messageKey: m })

function zodErrors(e: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {}
  for (const i of e.issues) {
    const k = String(i.path[0] ?? 'form')
    ;(errors[k] ??= []).push(i.message)
  }
  return errors
}

function revalidate(locale: string) {
  revalidatePath(`/${locale}/academic`)
  revalidatePath(`/${locale}/subjects`)
  revalidatePath(`/${locale}/dashboard`)
}

/* ───────────────────────── Academic year ───────────────────────── */

export async function createYear(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = yearSchema.safeParse({
    name: fd.get('name'),
    startDate: fd.get('startDate'),
    endDate: fd.get('endDate'),
    description: fd.get('description'),
    isCurrent: fd.get('isCurrent') === 'on',
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const exists = await db.academicYear.findFirst({
    where: { userId: user.id, name: parsed.data.name },
  })
  if (exists) return fail('errors.formInvalid', { name: ['academic.onlyOneCurrent'] })

  try {
    if (parsed.data.isCurrent) {
      await db.academicYear.updateMany({
        where: { userId: user.id, isCurrent: true },
        data: { isCurrent: false },
      })
    }
    await db.academicYear.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        description: parsed.data.description || null,
        isCurrent: parsed.data.isCurrent ?? false,
        status: 'ACTIVE',
      },
    })
    logActivity(user.id, 'YEAR', 'CREATE', undefined, { name: parsed.data.name })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateYear(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = yearSchema.safeParse({
    name: fd.get('name'),
    startDate: fd.get('startDate'),
    endDate: fd.get('endDate'),
    description: fd.get('description'),
    isCurrent: fd.get('isCurrent') === 'on',
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const row = await db.academicYear.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  try {
    if (parsed.data.isCurrent && !row.isCurrent) {
      await db.academicYear.updateMany({
        where: { userId: user.id, isCurrent: true },
        data: { isCurrent: false },
      })
    }
    await db.academicYear.update({
      where: { id },
      data: {
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        description: parsed.data.description || null,
        isCurrent: parsed.data.isCurrent ?? false,
      },
    })
    logActivity(user.id, 'YEAR', 'UPDATE', id)
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteYear(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.academicYear.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  try {
    await db.academicYear.delete({ where: { id } })
    logActivity(user.id, 'YEAR', 'DELETE', id, { name: row.name })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Semester ───────────────────────── */

export async function createSemester(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = semesterSchema.safeParse({
    academicYearId: fd.get('academicYearId'),
    name: fd.get('name'),
    startDate: fd.get('startDate'),
    endDate: fd.get('endDate'),
    isCurrent: fd.get('isCurrent') === 'on',
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const year = await db.academicYear.findFirst({
    where: { id: parsed.data.academicYearId, userId: user.id },
  })
  if (!year) return fail('errors.forbidden')

  try {
    if (parsed.data.isCurrent) {
      await db.semester.updateMany({ where: { userId: user.id, isCurrent: true }, data: { isCurrent: false } })
    }
    const count = await db.semester.count({ where: { userId: user.id, academicYearId: year.id } })
    await db.semester.create({
      data: {
        userId: user.id,
        academicYearId: year.id,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        order: count + 1,
        isCurrent: parsed.data.isCurrent ?? false,
      },
    })
    logActivity(user.id, 'SEMESTER', 'CREATE', undefined, { name: parsed.data.name })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateSemester(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = semesterSchema.safeParse({
    academicYearId: fd.get('academicYearId'),
    name: fd.get('name'),
    startDate: fd.get('startDate'),
    endDate: fd.get('endDate'),
    isCurrent: fd.get('isCurrent') === 'on',
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const row = await db.semester.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  try {
    if (parsed.data.isCurrent && !row.isCurrent) {
      await db.semester.updateMany({ where: { userId: user.id, isCurrent: true }, data: { isCurrent: false } })
    }
    await db.semester.update({
      where: { id },
      data: {
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        isCurrent: parsed.data.isCurrent ?? false,
      },
    })
    logActivity(user.id, 'SEMESTER', 'UPDATE', id)
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteSemester(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.semester.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.semester.delete({ where: { id } })
    logActivity(user.id, 'SEMESTER', 'DELETE', id, { name: row.name })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Specialization ───────────────────────── */

export async function createSpecialization(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = specializationSchema.safeParse({
    academicYearId: fd.get('academicYearId'),
    name: fd.get('name'),
    description: fd.get('description'),
    program: fd.get('program'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const year = await db.academicYear.findFirst({
    where: { id: parsed.data.academicYearId, userId: user.id },
  })
  if (!year) return fail('errors.forbidden')

  try {
    await db.specialization.create({
      data: {
        userId: user.id,
        academicYearId: year.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        program: parsed.data.program || null,
      },
    })
    logActivity(user.id, 'SPECIALIZATION', 'CREATE', undefined, { name: parsed.data.name })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteSpecialization(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.specialization.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.specialization.delete({ where: { id } })
    logActivity(user.id, 'SPECIALIZATION', 'DELETE', id, { name: row.name })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Subject ───────────────────────── */

function nullable(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length ? s : null
}

export async function createSubject(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = subjectSchema.safeParse({
    semesterId: nullable(fd.get('semesterId')),
    specializationId: nullable(fd.get('specializationId')),
    name: fd.get('name'),
    description: fd.get('description'),
    icon: fd.get('icon'),
    color: fd.get('color'),
    coefficient: fd.get('coefficient'),
    importance: fd.get('importance'),
    priority: fd.get('priority'),
    examDate: nullable(fd.get('examDate')),
    deadline: nullable(fd.get('deadline')),
    estimatedHours: fd.get('estimatedHours'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  // Ownership check on the parent semester/specialization.
  if (parsed.data.semesterId) {
    const s = await db.semester.findFirst({
      where: { id: parsed.data.semesterId, userId: user.id },
    })
    if (!s) return fail('errors.forbidden')
  }
  if (parsed.data.specializationId) {
    const s = await db.specialization.findFirst({
      where: { id: parsed.data.specializationId, userId: user.id },
    })
    if (!s) return fail('errors.forbidden')
  }

  try {
    const count = await db.subject.count({ where: { userId: user.id, archivedAt: null } })
    await db.subject.create({
      data: {
        userId: user.id,
        semesterId: parsed.data.semesterId ?? null,
        specializationId: parsed.data.specializationId ?? null,
        name: parsed.data.name,
        description: parsed.data.description || null,
        icon: parsed.data.icon || 'book',
        color: parsed.data.color || '#1b6af5',
        coefficient: parsed.data.coefficient ?? 1,
        importance: parsed.data.importance ?? 'MEDIUM',
        priority: parsed.data.priority ?? 3,
        examDate: parsed.data.examDate ? new Date(parsed.data.examDate) : null,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        estimatedHours: parsed.data.estimatedHours ?? 0,
        notes: parsed.data.notes || null,
        order: count,
      },
    })
    logActivity(user.id, 'SUBJECT', 'CREATE', undefined, { name: parsed.data.name })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateSubject(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const row = await db.subject.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const parsed = subjectSchema.safeParse({
    semesterId: nullable(fd.get('semesterId')),
    specializationId: nullable(fd.get('specializationId')),
    name: fd.get('name'),
    description: fd.get('description'),
    icon: fd.get('icon'),
    color: fd.get('color'),
    coefficient: fd.get('coefficient'),
    importance: fd.get('importance'),
    priority: fd.get('priority'),
    examDate: nullable(fd.get('examDate')),
    deadline: nullable(fd.get('deadline')),
    estimatedHours: fd.get('estimatedHours'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  try {
    await db.subject.update({
      where: { id },
      data: {
        semesterId: parsed.data.semesterId ?? null,
        specializationId: parsed.data.specializationId ?? null,
        name: parsed.data.name,
        description: parsed.data.description || null,
        icon: parsed.data.icon || row.icon,
        color: parsed.data.color || row.color,
        coefficient: parsed.data.coefficient ?? row.coefficient,
        importance: parsed.data.importance ?? row.importance,
        priority: parsed.data.priority ?? row.priority,
        examDate: parsed.data.examDate ? new Date(parsed.data.examDate) : null,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        estimatedHours: parsed.data.estimatedHours ?? row.estimatedHours,
        notes: parsed.data.notes || null,
      },
    })
    logActivity(user.id, 'SUBJECT', 'UPDATE', id, { name: parsed.data.name })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function toggleSubjectArchive(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.subject.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.subject.update({
      where: { id },
      data: { archivedAt: row.archivedAt ? null : new Date() },
    })
    logActivity(user.id, 'SUBJECT', row.archivedAt ? 'UNARCHIVE' : 'ARCHIVE', id)
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteSubject(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.subject.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.subject.delete({ where: { id } })
    logActivity(user.id, 'SUBJECT', 'DELETE', id, { name: row.name })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Chapter ───────────────────────── */

export async function createChapter(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = chapterSchema.safeParse({
    subjectId: fd.get('subjectId'),
    title: fd.get('title'),
    description: fd.get('description'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const subject = await db.subject.findFirst({
    where: { id: parsed.data.subjectId, userId: user.id },
  })
  if (!subject) return fail('errors.forbidden')

  try {
    const count = await db.chapter.count({ where: { userId: user.id, subjectId: subject.id } })
    await db.chapter.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        order: count,
      },
    })
    logActivity(user.id, 'CHAPTER', 'CREATE', undefined, { title: parsed.data.title })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateChapter(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const row = await db.chapter.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const parsed = chapterSchema.safeParse({
    subjectId: row.subjectId,
    title: fd.get('title'),
    description: fd.get('description'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  try {
    await db.chapter.update({
      where: { id },
      data: { title: parsed.data.title, description: parsed.data.description || null },
    })
    logActivity(user.id, 'CHAPTER', 'UPDATE', id)
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteChapter(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.chapter.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.chapter.delete({ where: { id } })
    logActivity(user.id, 'CHAPTER', 'DELETE', id, { title: row.title })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Lesson ───────────────────────── */

export async function createLesson(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = lessonSchema.safeParse({
    chapterId: fd.get('chapterId'),
    subjectId: fd.get('subjectId'),
    title: fd.get('title'),
    description: fd.get('description'),
    estimatedMinutes: fd.get('estimatedMinutes'),
    priority: fd.get('priority'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const chapter = await db.chapter.findFirst({
    where: { id: parsed.data.chapterId, userId: user.id },
  })
  if (!chapter) return fail('errors.forbidden')
  if (chapter.subjectId !== parsed.data.subjectId) return fail('errors.forbidden')

  try {
    const count = await db.lesson.count({ where: { userId: user.id, chapterId: chapter.id } })
    await db.lesson.create({
      data: {
        userId: user.id,
        chapterId: chapter.id,
        subjectId: chapter.subjectId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        estimatedMinutes: parsed.data.estimatedMinutes,
        priority: parsed.data.priority ?? 'MEDIUM',
        notes: parsed.data.notes || null,
        order: count,
      },
    })
    logActivity(user.id, 'LESSON', 'CREATE', undefined, { title: parsed.data.title })
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateLesson(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const row = await db.lesson.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const parsed = lessonSchema.safeParse({
    chapterId: row.chapterId,
    subjectId: row.subjectId,
    title: fd.get('title'),
    description: fd.get('description'),
    estimatedMinutes: fd.get('estimatedMinutes'),
    priority: fd.get('priority'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  try {
    await db.lesson.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        estimatedMinutes: parsed.data.estimatedMinutes,
        priority: parsed.data.priority ?? row.priority,
        notes: parsed.data.notes || null,
      },
    })
    logActivity(user.id, 'LESSON', 'UPDATE', id)
    revalidate(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/**
 * Changes a lesson status and recalculates everything that depends on it:
 * completion date, subject progress, overall progress, dashboard numbers.
 * Reopening a lesson clears completedAt and the recalculation flows from
 * the same single source of truth (the Lesson rows).
 */
export async function setLessonStatus(fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = lessonStatusSchema.safeParse({
    id: fd.get('id'),
    status: fd.get('status'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const row = await db.lesson.findFirst({ where: { id: parsed.data.id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const status = parsed.data.status
  const completedAt =
    status === 'COMPLETED' ? (row.completedAt ?? new Date()) : status === 'NEEDS_REVISION' ? row.completedAt : null

  try {
    await db.lesson.update({
      where: { id: row.id },
      data: {
        status,
        completedAt,
        ...(status === 'NEEDS_REVISION' && !row.completedAt
          ? { completedAt: new Date() }
          : {}),
      },
    })

    logActivity(
      user.id,
      'LESSON',
      status === 'COMPLETED'
        ? row.status === 'COMPLETED'
          ? 'UPDATE'
          : 'COMPLETE'
        : row.status === 'COMPLETED'
          ? 'REOPEN'
          : 'UPDATE',
      row.id,
      { from: row.status, to: status },
    )

    // Force recalculation for anything derived downstream.
    await overallProgress(user.id)

    revalidatePath(`/${locale}/dashboard`)
    revalidatePath(`/${locale}/subjects`)
    revalidatePath(`/${locale}/analytics`)
    revalidatePath(`/${locale}/academic`)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteLesson(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.lesson.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.lesson.delete({ where: { id } })
    logActivity(user.id, 'LESSON', 'DELETE', id, { title: row.title })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/** Reorders a set of lessons/chapters within their parent. */
export async function reorderEntities(
  kind: 'chapter' | 'lesson',
  ids: string[],
  locale = 'ar',
): Promise<ActionState> {
  const user = await requireUser()
  if (!Array.isArray(ids) || !ids.length || ids.length > 200) return fail('errors.formInvalid')

  try {
    if (kind === 'chapter') {
      const rows = await db.chapter.findMany({
        where: { id: { in: ids }, userId: user.id },
        select: { id: true },
      })
      if (rows.length !== ids.length) return fail('errors.forbidden')
      await db.$transaction(
        ids.map((id, i) => db.chapter.update({ where: { id }, data: { order: i } })),
      )
    } else {
      const rows = await db.lesson.findMany({
        where: { id: { in: ids }, userId: user.id },
        select: { id: true },
      })
      if (rows.length !== ids.length) return fail('errors.forbidden')
      await db.$transaction(
        ids.map((id, i) => db.lesson.update({ where: { id }, data: { order: i } })),
      )
    }
    logActivity(user.id, kind === 'chapter' ? 'CHAPTER' : 'LESSON', 'UPDATE', undefined, { reorder: true })
    revalidate(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}
