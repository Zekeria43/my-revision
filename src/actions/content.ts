'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { logActivity } from '@/lib/activity'
import { examSchema, noteSchema, resourceSchema } from '@/lib/validation'
import type { ActionState } from './auth'

/**
 * Exams, notes and resources server actions.
 * Ownership is resolved from the session and enforced in every query.
 */

const fail = (m: string, errors?: Record<string, string[]>): ActionState => ({
  ok: false,
  messageKey: m,
  errors,
})
const ok = (m?: string, extra: Partial<ActionState> = {}): ActionState => ({
  ok: true,
  messageKey: m,
  ...extra,
})

function zodErrors(e: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {}
  for (const i of e.issues) {
    const k = String(i.path[0] ?? 'form')
    ;(errors[k] ??= []).push(i.message)
  }
  return errors
}

const emptyToNull = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length ? s : null
}

const revalidateContent = (locale: string) => {
  revalidatePath(`/${locale}/exams`)
  revalidatePath(`/${locale}/notes`)
  revalidatePath(`/${locale}/dashboard`)
  revalidatePath(`/${locale}/analytics`)
}

/* ───────────────────────── Exams ───────────────────────── */

export async function createExam(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const parsed = examSchema.safeParse({
    subjectId: fd.get('subjectId'),
    title: fd.get('title'),
    date: fd.get('date'),
    importance: fd.get('importance'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const subject = await db.subject.findFirst({
    where: { id: parsed.data.subjectId, userId: user.id },
  })
  if (!subject) return fail('errors.forbidden')

  try {
    await db.exam.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        title: parsed.data.title,
        date: new Date(parsed.data.date),
        importance: parsed.data.importance ?? 'HIGH',
        notes: parsed.data.notes || null,
      },
    })
    logActivity(user.id, 'EXAM', 'CREATE', undefined, { title: parsed.data.title })
    revalidateContent(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateExam(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const row = await db.exam.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const parsed = examSchema.safeParse({
    subjectId: fd.get('subjectId'),
    title: fd.get('title'),
    date: fd.get('date'),
    importance: fd.get('importance'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const subject = await db.subject.findFirst({
    where: { id: parsed.data.subjectId, userId: user.id },
  })
  if (!subject) return fail('errors.forbidden')

  try {
    await db.exam.update({
      where: { id },
      data: {
        subjectId: subject.id,
        title: parsed.data.title,
        date: new Date(parsed.data.date),
        importance: parsed.data.importance ?? row.importance,
        notes: parsed.data.notes || null,
      },
    })
    logActivity(user.id, 'EXAM', 'UPDATE', id)
    revalidateContent(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteExam(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.exam.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.exam.delete({ where: { id } })
    logActivity(user.id, 'EXAM', 'DELETE', id, { title: row.title })
    revalidateContent(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Notes ───────────────────────── */

export async function createNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const parsed = noteSchema.safeParse({
    kind: fd.get('kind') ?? 'TEXT',
    title: fd.get('title'),
    content: fd.get('content'),
    subjectId: emptyToNull(fd.get('subjectId')),
    chapterId: emptyToNull(fd.get('chapterId')),
    lessonId: emptyToNull(fd.get('lessonId')),
    semesterId: emptyToNull(fd.get('semesterId')),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const owned = await verifyLinkage(user.id, parsed.data)
  if (!owned) return fail('errors.forbidden')

  try {
    await db.note.create({
      data: {
        userId: user.id,
        kind: parsed.data.kind,
        title: parsed.data.title,
        content: parsed.data.content || '',
        subjectId: parsed.data.subjectId ?? null,
        chapterId: parsed.data.chapterId ?? null,
        lessonId: parsed.data.lessonId ?? null,
        semesterId: parsed.data.semesterId ?? null,
      },
    })
    logActivity(user.id, 'NOTE', 'CREATE', undefined, { title: parsed.data.title })
    revalidateContent(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateNote(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const row = await db.note.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const parsed = noteSchema.safeParse({
    kind: fd.get('kind') ?? row.kind,
    title: fd.get('title'),
    content: fd.get('content'),
    subjectId: emptyToNull(fd.get('subjectId')),
    chapterId: emptyToNull(fd.get('chapterId')),
    lessonId: emptyToNull(fd.get('lessonId')),
    semesterId: emptyToNull(fd.get('semesterId')),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const owned = await verifyLinkage(user.id, parsed.data)
  if (!owned) return fail('errors.forbidden')

  try {
    await db.note.update({
      where: { id },
      data: {
        kind: parsed.data.kind,
        title: parsed.data.title,
        content: parsed.data.content || '',
        subjectId: parsed.data.subjectId ?? null,
        chapterId: parsed.data.chapterId ?? null,
        lessonId: parsed.data.lessonId ?? null,
        semesterId: parsed.data.semesterId ?? null,
      },
    })
    logActivity(user.id, 'NOTE', 'UPDATE', id)
    revalidateContent(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteNote(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.note.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.note.delete({ where: { id } })
    logActivity(user.id, 'NOTE', 'DELETE', id, { title: row.title })
    revalidateContent(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Resources ───────────────────── */

export async function createResource(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const parsed = resourceSchema.safeParse({
    name: fd.get('name'),
    kind: fd.get('kind') ?? 'LINK',
    url: fd.get('url'),
    subjectId: emptyToNull(fd.get('subjectId')),
    chapterId: emptyToNull(fd.get('chapterId')),
    lessonId: emptyToNull(fd.get('lessonId')),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const owned = await verifyLinkage(user.id, parsed.data)
  if (!owned) return fail('errors.forbidden')

  // Only http(s) links may be stored.
  if (parsed.data.kind === 'LINK') {
    const url = parsed.data.url ?? ''
    if (!/^https?:\/\//i.test(url)) {
      return fail('errors.formInvalid', { url: ['errors.invalidUrl'] })
    }
  }

  try {
    await db.resource.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        kind: parsed.data.kind,
        url: parsed.data.url || '',
        subjectId: parsed.data.subjectId ?? null,
        chapterId: parsed.data.chapterId ?? null,
        lessonId: parsed.data.lessonId ?? null,
      },
    })
    logActivity(user.id, 'RESOURCE', 'CREATE', undefined, { name: parsed.data.name })
    revalidateContent(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteResource(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.resource.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.resource.delete({ where: { id } })
    logActivity(user.id, 'RESOURCE', 'DELETE', id, { name: row.name })
    revalidateContent(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── helpers ─────────────────────── */

/** Confirms every referenced parent row belongs to the actor. */
async function verifyLinkage(
  userId: string,
  data: {
    subjectId?: string | null
    chapterId?: string | null
    lessonId?: string | null
    semesterId?: string | null
  },
): Promise<boolean> {
  const checks: Promise<number>[] = []
  if (data.subjectId)
    checks.push(db.subject.count({ where: { id: data.subjectId, userId } }))
  if (data.chapterId)
    checks.push(db.chapter.count({ where: { id: data.chapterId, userId } }))
  if (data.lessonId)
    checks.push(db.lesson.count({ where: { id: data.lessonId, userId } }))
  if (data.semesterId)
    checks.push(db.semester.count({ where: { id: data.semesterId, userId } }))
  const results = await Promise.all(checks)
  return results.every((n) => n === 1)
}
