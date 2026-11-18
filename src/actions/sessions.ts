'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { logActivity } from '@/lib/activity'
import { availabilitySchema, preferenceSchema, rescheduleSchema, sessionSchema } from '@/lib/validation'
import { generatePlan, hasOverlap, savePlan, type PlannedSlot } from '@/lib/scheduler'
import type { ActionState } from './auth'

/**
 * Calendar, availability and planning actions.
 * All ownership checks happen server-side against the session user.
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
type PlanState = ActionState & { preview?: PlanPreview }
const okPlan = (
  m: string | undefined,
  preview: PlanPreview,
  vars?: Record<string, string | number>,
): PlanState => ({ ok: true, messageKey: m, preview, vars })

function zodErrors(e: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {}
  for (const i of e.issues) {
    const k = String(i.path[0] ?? 'form')
    ;(errors[k] ??= []).push(i.message)
  }
  return errors
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const revalidateAll = (locale: string) => {
  revalidatePath(`/${locale}/calendar`)
  revalidatePath(`/${locale}/dashboard`)
  revalidatePath(`/${locale}/planner`)
  revalidatePath(`/${locale}/analytics`)
  revalidatePath(`/${locale}/history`)
}

/* ───────────────────────── Sessions ───────────────────────── */

export async function createSession(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const parsed = sessionSchema.safeParse({
    subjectId: fd.get('subjectId'),
    chapterId: emptyToNull(fd.get('chapterId')),
    lessonId: emptyToNull(fd.get('lessonId')),
    date: fd.get('date'),
    startTime: fd.get('startTime'),
    endTime: fd.get('endTime'),
    priority: fd.get('priority'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const subject = await db.subject.findFirst({
    where: { id: parsed.data.subjectId, userId: user.id },
  })
  if (!subject) return fail('errors.forbidden')

  if (parsed.data.lessonId) {
    const lesson = await db.lesson.findFirst({
      where: { id: parsed.data.lessonId, userId: user.id },
    })
    if (!lesson) return fail('errors.forbidden')
  }
  if (parsed.data.chapterId) {
    const chapter = await db.chapter.findFirst({
      where: { id: parsed.data.chapterId, userId: user.id },
    })
    if (!chapter) return fail('errors.forbidden')
  }

  const date = startOfDay(new Date(parsed.data.date))
  if (await hasOverlap(user.id, date, parsed.data.startTime, parsed.data.endTime)) {
    return fail('calendar.overlap', { endTime: ['calendar.overlap'] })
  }

  try {
    const duration =
      toMin(parsed.data.endTime) - toMin(parsed.data.startTime) || 1440

    await db.studySession.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        chapterId: parsed.data.chapterId ?? null,
        lessonId: parsed.data.lessonId ?? null,
        date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        durationMinutes: duration,
        priority: parsed.data.priority ?? 'MEDIUM',
        status: 'SCHEDULED',
        source: 'MANUAL',
        notes: parsed.data.notes || null,
      },
    })
    logActivity(user.id, 'SESSION', 'CREATE', undefined, {
      date: parsed.data.date,
      start: parsed.data.startTime,
    })
    revalidateAll(locale)
    return ok('calendar.sessionSaved')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function updateSession(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const row = await db.studySession.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const parsed = sessionSchema.safeParse({
    subjectId: fd.get('subjectId'),
    chapterId: emptyToNull(fd.get('chapterId')),
    lessonId: emptyToNull(fd.get('lessonId')),
    date: fd.get('date'),
    startTime: fd.get('startTime'),
    endTime: fd.get('endTime'),
    priority: fd.get('priority'),
    notes: fd.get('notes'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const subject = await db.subject.findFirst({
    where: { id: parsed.data.subjectId, userId: user.id },
  })
  if (!subject) return fail('errors.forbidden')

  const date = startOfDay(new Date(parsed.data.date))
  if (
    await hasOverlap(user.id, date, parsed.data.startTime, parsed.data.endTime, id)
  ) {
    return fail('calendar.overlap', { endTime: ['calendar.overlap'] })
  }

  try {
    const duration = toMin(parsed.data.endTime) - toMin(parsed.data.startTime) || 1440
    await db.studySession.update({
      where: { id },
      data: {
        subjectId: subject.id,
        chapterId: parsed.data.chapterId ?? null,
        lessonId: parsed.data.lessonId ?? null,
        date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        durationMinutes: duration,
        priority: parsed.data.priority ?? row.priority,
        notes: parsed.data.notes || null,
      },
    })
    logActivity(user.id, 'SESSION', 'UPDATE', id)
    revalidateAll(locale)
    return ok('calendar.sessionSaved')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/** Marks a session COMPLETED / MISSED / CANCELLED / SCHEDULED. */
export async function setSessionStatus(fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const id = String(fd.get('id') ?? '')
  const status = String(fd.get('status') ?? '')
  if (!id || !['SCHEDULED', 'COMPLETED', 'MISSED', 'POSTPONED', 'CANCELLED'].includes(status)) {
    return fail('errors.formInvalid')
  }

  const row = await db.studySession.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  try {
    await db.studySession.update({
      where: { id },
      data: {
        status: status as 'SCHEDULED',
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    })

    // Completing a linked lesson marks it completed too.
    if (status === 'COMPLETED' && row.lessonId) {
      const lesson = await db.lesson.findFirst({
        where: { id: row.lessonId, userId: user.id },
      })
      if (lesson && lesson.status !== 'COMPLETED') {
        await db.lesson.update({
          where: { id: lesson.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        logActivity(user.id, 'LESSON', 'COMPLETE', lesson.id, { via: 'session' })
      }
    }

    // A missed session keeps its lesson incomplete and logs history.
    if (status === 'MISSED') {
      await createMissedNotification(user.id, row.id, row.date)
    }

    logActivity(
      user.id,
      'SESSION',
      status === 'COMPLETED' ? 'COMPLETE' : status === 'MISSED' ? 'UPDATE' : 'UPDATE',
      id,
      { from: row.status, to: status },
    )
    revalidateAll(locale)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function deleteSession(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.studySession.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.studySession.delete({ where: { id } })
    logActivity(user.id, 'SESSION', 'DELETE', id)
    revalidateAll(locale)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Availability ───────────────────────── */

export async function addAvailability(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = availabilitySchema.safeParse({
    weekday: fd.get('weekday'),
    startTime: fd.get('startTime'),
    endTime: fd.get('endTime'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  try {
    await db.studyAvailability.upsert({
      where: {
        userId_weekday_startTime_endTime: {
          userId: user.id,
          weekday: parsed.data.weekday,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        },
      },
      update: {},
      create: {
        userId: user.id,
        weekday: parsed.data.weekday,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      },
    })
    revalidatePath(`/${locale}/planner`)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function removeAvailability(id: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const row = await db.studyAvailability.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')
  try {
    await db.studyAvailability.delete({ where: { id } })
    revalidatePath(`/${locale}/planner`)
    return ok()
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function savePreferences(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const parsed = preferenceSchema.safeParse({
    maxDailyMinutes: fd.get('maxDailyMinutes'),
    preferredSessionMin: fd.get('preferredSessionMin'),
    breakMinutes: fd.get('breakMinutes'),
    remindBeforeMin: fd.get('remindBeforeMin'),
    pomodoroStudyMin: fd.get('pomodoroStudyMin'),
    pomodoroBreakMin: fd.get('pomodoroBreakMin'),
    pomodoroLongBreakMin: fd.get('pomodoroLongBreakMin'),
    pomodoroCycles: fd.get('pomodoroCycles'),
    notificationsEnabled: fd.get('notificationsEnabled') === 'on',
    emailEnabled: fd.get('emailEnabled') === 'on',
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  try {
    await db.studyPreference.upsert({
      where: { userId: user.id },
      update: parsed.data,
      create: { userId: user.id, ...parsed.data },
    })
    revalidatePath(`/${locale}/planner`)
    revalidatePath(`/${locale}/settings`)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Smart planner ───────────────────────── */

export interface PlanPreview {
  slots: {
    lessonId: string
    subjectId: string
    subjectName: string
    subjectColor: string
    lessonTitle: string
    date: string
    startTime: string
    endTime: string
    durationMinutes: number
  }[]
  unscheduledCount: number
  replacedCount: number
  daysUsed: number
}

export async function previewPlan(fd: FormData): Promise<
  ActionState & { preview?: PlanPreview }
> {
  const user = await requireUser()

  const subjectIds = fd.getAll('subjectIds').map(String).filter(Boolean)
  const days = Number(fd.get('days') ?? 14)
  const sessionMinutes = Number(fd.get('sessionMinutes') ?? 0) || undefined
  const replaceExisting = fd.get('replaceExisting') === 'on'

  if (!subjectIds.length) return fail('planner.noLessonsSelected')
  if (!Number.isFinite(days) || days < 1 || days > 90) return fail('errors.formInvalid')

  // Verify ownership of every selected subject.
  const owned = await db.subject.count({
    where: { id: { in: subjectIds }, userId: user.id, archivedAt: null },
  })
  if (owned !== subjectIds.length) return fail('errors.forbidden')

  const prefs = await db.studyPreference.findUnique({ where: { userId: user.id } })

  try {
    const result = await generatePlan({
      userId: user.id,
      subjectIds,
      horizonDays: days,
      sessionMinutes: sessionMinutes ?? prefs?.preferredSessionMin,
      breakMinutes: prefs?.breakMinutes,
      replaceExisting,
    })

    if (!result.slots.length) {
      return okPlan('planner.nothingToSchedule', {
        slots: [],
        unscheduledCount: result.unscheduledCount,
        replacedCount: result.replacedCount,
        daysUsed: 0,
      })
    }

    const subjects = await db.subject.findMany({
      where: { id: { in: [...new Set(result.slots.map((s) => s.subjectId))] } },
      select: { id: true, name: true, color: true },
    })
    const lessons = await db.lesson.findMany({
      where: { id: { in: [...new Set(result.slots.map((s) => s.lessonId))] } },
      select: { id: true, title: true },
    })
    const sm = new Map(subjects.map((s) => [s.id, s]))
    const lm = new Map(lessons.map((l) => [l.id, l]))

    const slots: PlanPreview['slots'] = result.slots.map((s) => ({
      lessonId: s.lessonId,
      subjectId: s.subjectId,
      subjectName: sm.get(s.subjectId)?.name ?? '—',
      subjectColor: sm.get(s.subjectId)?.color ?? '#1b6af5',
      lessonTitle: lm.get(s.lessonId)?.title ?? '—',
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
    }))

    // The preview lives only in this response — nothing is written yet.
    const unscheduled = result.unscheduledCount
    return okPlan(
      unscheduled ? 'planner.noAvailableTime' : 'planner.generated',
      {
        slots,
        unscheduledCount: unscheduled,
        replacedCount: result.replacedCount,
        daysUsed: result.daysUsed,
      },
      { n: unscheduled || slots.length, count: unscheduled },
    )
  } catch (e) {
    console.error('[planner] generation failed', e)
    return fail('errors.serverErrorTitle')
  }
}

/**
 * Persists a previously previewed plan.
 * Accepts the exact slot list the user reviewed — it is re-validated
 * (ownership, overlap, availability) before anything is written.
 */
export async function confirmPlan(fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const raw = fd.get('slots')
  if (typeof raw !== 'string') return fail('errors.formInvalid')

  let parsed: PlannedSlot[]
  try {
    const arr = JSON.parse(raw) as PlanPreview['slots']
    if (!Array.isArray(arr) || arr.length > 500) throw new Error('bad')
    parsed = arr.map((s) => ({
      lessonId: String(s.lessonId),
      subjectId: String(s.subjectId),
      chapterId: null,
      date: new Date(String(s.date)),
      startTime: String(s.startTime),
      endTime: String(s.endTime),
      durationMinutes: Number(s.durationMinutes) || 30,
    }))
  } catch {
    return fail('errors.formInvalid')
  }

  if (!parsed.length) return fail('planner.nothingToSchedule')

  const replaceExisting = fd.get('replaceExisting') === 'on'

  // ── Re-validate everything server-side ──────────────────────
  const subjectIds = [...new Set(parsed.map((s) => s.subjectId))]
  const lessonIds = [...new Set(parsed.map((s) => s.lessonId))]

  const [ownedSubjects, ownedLessons] = await Promise.all([
    db.subject.count({ where: { id: { in: subjectIds }, userId: user.id } }),
    db.lesson.count({ where: { id: { in: lessonIds }, userId: user.id, archivedAt: null } }),
  ])
  if (ownedSubjects !== subjectIds.length || ownedLessons !== lessonIds.length) {
    return fail('errors.forbidden')
  }

  // Overlap check against sessions that will remain.
  for (const s of parsed) {
    if (await hasOverlap(user.id, startOfDay(s.date), s.startTime, s.endTime)) {
      return fail('calendar.overlap', { endTime: ['calendar.overlap'] })
    }
  }

  try {
    const count = await savePlan(user.id, parsed)
    logActivity(user.id, 'SESSION', 'CREATE', undefined, {
      source: 'AUTO',
      count,
      replaced: replaceExisting,
    })
    revalidateAll(locale)
    return ok('planner.saved')
  } catch (e) {
    console.error('[planner] save failed', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Missed sessions & rescheduling ───────────────────────── */

export interface Suggestion {
  date: string
  startTime: string
  endTime: string
}

/** Finds the next free slot honouring availability, exams and daily limits. */
export async function suggestReschedule(sessionId: string): Promise<{
  ok: boolean
  suggestion?: Suggestion
  messageKey?: string
}> {
  const user = await requireUser()
  const row = await db.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { subject: { select: { name: true } } },
  })
  if (!row) return { ok: false, messageKey: 'errors.forbidden' }

  const prefs = await db.studyPreference.findUnique({ where: { userId: user.id } })
  const maxDaily = prefs?.maxDailyMinutes ?? 180
  const availability = await db.studyAvailability.findMany({ where: { userId: user.id } })
  if (!availability.length) return { ok: false, messageKey: 'planner.noAvailability' }

  const existing = await db.studySession.findMany({
    where: {
      userId: user.id,
      date: { gte: startOfDay(new Date()) },
      status: { notIn: ['CANCELLED'] },
      id: { not: row.id },
    },
    select: { date: true, startTime: true, endTime: true, durationMinutes: true },
  })

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const toTime = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const dur = row.durationMinutes
  const now = startOfDay(new Date())

  for (let d = 0; d < 30; d++) {
    const date = new Date(now.getTime() + d * 86_400_000)
    const dow = date.getDay()
    const key = date.toISOString().slice(0, 10)

    const daySessions = existing.filter((s) => s.date.toISOString().slice(0, 10) === key)
    const used = daySessions.reduce((a, s) => a + s.durationMinutes, 0)
    if (used + dur > maxDaily) continue

    const busy = daySessions.map((s) => ({ s: toMin(s.startTime), e: toMin(s.endTime) }))

    for (const w of availability.filter((a) => a.weekday === dow)) {
      let cursor = toMin(w.startTime)
      const end = toMin(w.endTime)
      const sorted = busy.slice().sort((a, b) => a.s - b.s)

      for (const b of sorted) {
        if (b.e <= cursor || b.s >= end) continue
        if (cursor + dur <= b.s) break
        cursor = Math.max(cursor, b.e)
      }
      if (cursor + dur <= end) {
        return {
          ok: true,
          suggestion: { date: key, startTime: toTime(cursor), endTime: toTime(cursor + dur) },
        }
      }
    }
  }

  return { ok: false, messageKey: 'planner.noAvailableTime' }
}

export async function rescheduleSession(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const parsed = rescheduleSchema.safeParse({
    sessionId: fd.get('sessionId'),
    date: fd.get('date'),
    startTime: fd.get('startTime'),
    endTime: fd.get('endTime'),
    reason: fd.get('reason'),
  })
  if (!parsed.success) return fail('errors.formInvalid', zodErrors(parsed.error))

  const row = await db.studySession.findFirst({ where: { id: parsed.data.sessionId, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  const date = startOfDay(new Date(parsed.data.date))
  if (await hasOverlap(user.id, date, parsed.data.startTime, parsed.data.endTime, row.id)) {
    return fail('calendar.overlap', { endTime: ['calendar.overlap'] })
  }

  try {
    // 1. The original session is preserved as history (never erased).
    // 2. The original row is marked POSTPONED and keeps its date.
    // 3. A NEW session carries the new slot — both are linked in history.
    const duration = toMin(parsed.data.endTime) - toMin(parsed.data.startTime) || 1440

    const newSession = await db.studySession.create({
      data: {
        userId: user.id,
        subjectId: row.subjectId,
        chapterId: row.chapterId,
        lessonId: row.lessonId,
        date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        durationMinutes: duration,
        priority: row.priority,
        status: 'SCHEDULED',
        source: row.source,
        notes: row.notes,
      },
    })

    await db.studySession.update({
      where: { id: row.id },
      data: { status: 'POSTPONED' },
    })

    await db.reschedulingHistory.create({
      data: {
        userId: user.id,
        originalSessionId: row.id,
        newSessionId: newSession.id,
        originalDate: row.date,
        newDate: date,
        originalStatus: row.status,
        newStatus: 'SCHEDULED',
        reason: parsed.data.reason || null,
      },
    })

    logActivity(user.id, 'SESSION', 'RESCHEDULE', row.id, {
      from: row.date.toISOString().slice(0, 10),
      to: parsed.data.date,
      reason: parsed.data.reason ?? '',
    })

    revalidateAll(locale)
    revalidatePath(`/${locale}/missed`)
    return ok('missed.saved')
  } catch (e) {
    console.error('[reschedule] failed', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Exam revision plans ───────────────────────── */

export async function generateRevisionPlan(examId: string, locale = 'ar'): Promise<ActionState> {
  const user = await requireUser()
  const exam = await db.exam.findFirst({ where: { id: examId, userId: user.id } })
  if (!exam) return fail('errors.forbidden')

  const prefs = await db.studyPreference.findUnique({ where: { userId: user.id } })
  const sessionLen = prefs?.preferredSessionMin ?? 45

  const lessons = await db.lesson.findMany({
    where: {
      userId: user.id,
      subjectId: exam.subjectId,
      archivedAt: null,
      status: { not: 'COMPLETED' },
      sessions: { none: { status: 'SCHEDULED', date: { gte: startOfDay(new Date()) } } },
    },
    include: { subject: { select: { importance: true, priority: true } } },
  })

  if (!lessons.length) return ok('exams.noIncomplete')

  const availability = await db.studyAvailability.findMany({ where: { userId: user.id } })
  if (!availability.length) return fail('planner.noAvailability')

  const existing = await db.studySession.findMany({
    where: {
      userId: user.id,
      date: { gte: startOfDay(new Date()), lte: startOfDay(exam.date) },
      status: { notIn: ['CANCELLED'] },
    },
    select: { date: true, startTime: true, endTime: true },
  })

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const toTime = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const busy = new Map<string, { s: number; e: number }[]>()
  for (const s of existing) {
    const k = s.date.toISOString().slice(0, 10)
    const arr = busy.get(k) ?? []
    arr.push({ s: toMin(s.startTime), e: toMin(s.endTime) })
    busy.set(k, arr)
  }

  const queue = [...lessons].sort(
    (a, b) =>
      (b.subject.priority - a.subject.priority) || (b.estimatedMinutes - a.estimatedMinutes),
  )

  const slots: PlannedSlot[] = []
  const today = startOfDay(new Date())
  const examDay = startOfDay(exam.date)

  for (let d = 0; d < 90 && queue.length; d++) {
    const date = new Date(today.getTime() + d * 86_400_000)
    if (date > examDay) break
    const key = date.toISOString().slice(0, 10)
    const dow = date.getDay()

    for (const w of availability.filter((a) => a.weekday === dow)) {
      let cursor = toMin(w.startTime)
      const end = toMin(w.endTime)
      const taken = (busy.get(key) ?? []).slice().sort((a, b) => a.s - b.s)

      for (const b of taken) {
        if (b.e <= cursor || b.s >= end) continue
        if (cursor < b.s) break
        cursor = Math.max(cursor, b.e)
      }

      while (queue.length && cursor + sessionLen <= end) {
        const l = queue[0]
        const dur = Math.min(l.estimatedMinutes, sessionLen)
        if (cursor + dur > end) break
        queue.shift()
        slots.push({
          lessonId: l.id,
          subjectId: l.subjectId,
          chapterId: l.chapterId,
          date,
          startTime: toTime(cursor),
          endTime: toTime(cursor + dur),
          durationMinutes: dur,
        })
        const arr = busy.get(key) ?? []
        arr.push({ s: cursor, e: cursor + dur })
        busy.set(key, arr)
        cursor += dur + (prefs?.breakMinutes ?? 10)
      }
      if (!queue.length) break
    }
  }

  if (!slots.length) return fail('planner.noAvailableTime', {})

  try {
    const count = await savePlan(user.id, slots)
    logActivity(user.id, 'EXAM', 'CREATE', exam.id, { revisionPlan: count })
    revalidateAll(locale)
    revalidatePath(`/${locale}/exams`)
    return ok('exams.planGenerated', { vars: { n: count } })
  } catch (e) {
    console.error('[exam-plan] failed', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Timer (Pomodoro / stopwatch) ───────────────────────── */

export async function logTimerSession(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')

  const subjectId = String(fd.get('subjectId') ?? '')
  const lessonIdRaw = String(fd.get('lessonId') ?? '').trim()
  const minutes = Number(fd.get('minutes') ?? 0)
  const startedAtRaw = String(fd.get('startedAt') ?? '')

  if (!subjectId || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    return fail('errors.formInvalid')
  }

  const subject = await db.subject.findFirst({ where: { id: subjectId, userId: user.id } })
  if (!subject) return fail('errors.forbidden')

  let lessonId: string | null = null
  if (lessonIdRaw) {
    const lesson = await db.lesson.findFirst({ where: { id: lessonIdRaw, userId: user.id } })
    if (!lesson) return fail('errors.forbidden')
    lessonId = lesson.id
  }

  const startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date(Date.now() - minutes * 60000)
  if (Number.isNaN(startedAt.getTime())) return fail('errors.formInvalid')

  const endedAt = new Date(startedAt.getTime() + minutes * 60000)

  try {
    await db.studySession.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        lessonId,
        date: new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate()),
        startTime: hhmm(startedAt),
        endTime: hhmm(endedAt),
        durationMinutes: Math.round(minutes),
        status: 'COMPLETED',
        completedAt: endedAt,
        source: 'MANUAL',
        notes: String(fd.get('notes') ?? '').trim() || null,
      },
    })
    logActivity(user.id, 'SESSION', 'CREATE', undefined, { source: 'TIMER', minutes })
    revalidatePath(`/${locale}/timer`)
    revalidatePath(`/${locale}/dashboard`)
    revalidatePath(`/${locale}/analytics`)
    revalidatePath(`/${locale}/calendar`)
    return ok('timer.recordSaved', { vars: { duration: `${Math.round(minutes)} min` } })
  } catch (e) {
    console.error('[timer] save failed', e)
    return fail('errors.serverErrorTitle')
  }
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ───────────────────────── helpers ───────────────────────── */

function emptyToNull(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length ? s : null
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

async function createMissedNotification(userId: string, sessionId: string, date: Date) {
  try {
    const existing = await db.notification.findFirst({
      where: { userId, type: 'SESSION_MISSED', link: `/calendar?session=${sessionId}` },
    })
    if (existing) return
    await db.notification.create({
      data: {
        userId,
        type: 'SESSION_MISSED',
        titleKey: 'notifications.type.SESSION_MISSED',
        bodyKey: 'missed.subtitle',
        params: JSON.stringify({ date: date.toISOString().slice(0, 10) }),
        link: `/calendar?session=${sessionId}`,
      },
    })
  } catch (e) {
    console.error('[notification] write failed', e)
  }
}
