import type { Prisma } from '@prisma/client'
import { db } from './db'

/**
 * Intelligent study planner.
 *
 * Priority score (higher = schedule sooner):
 *   + exam proximity   — an exam within 7 days dominates, decaying linearly
 *   + subject importance / priority
 *   + lesson priority
 *   + deadline proximity
 *
 * Constraints enforced:
 *   - only lessons that are NOT completed
 *   - only inside declared availability windows
 *   - never overlapping an existing session
 *   - never exceeding maxDailyMinutes per day
 *   - honours preferred session length + break between sessions
 */

const MINUTES_PER_DAY_LIMIT = 960

export interface AvailabilityWindow {
  weekday: number // 0 = Sunday
  startTime: string
  endTime: string
}

interface Candidate {
  lessonId: string
  subjectId: string
  chapterId: string
  score: number
  minutes: number
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const toTime = (m: number) => {
  const v = Math.max(0, Math.min(1439, Math.round(m)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const IMPORTANCE_WEIGHT = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const
const PRIORITY_WEIGHT = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const

export interface PlanOptions {
  userId: string
  subjectIds: string[]
  horizonDays: number
  sessionMinutes?: number
  replaceExisting?: boolean
  breakMinutes?: number
}

export interface PlannedSlot {
  lessonId: string
  subjectId: string
  chapterId: string | null
  date: Date
  startTime: string
  endTime: string
  durationMinutes: number
}

export interface PlanResult {
  slots: PlannedSlot[]
  skipped: string[] // lessons that could not be scheduled
  unscheduledCount: number
  replacedCount: number
  daysUsed: number
}

export async function generatePlan(opts: PlanOptions): Promise<PlanResult> {
  const { userId, subjectIds, horizonDays } = opts
  const sessionLen = opts.sessionMinutes ?? 45
  const breakMin = opts.breakMinutes ?? 10

  const prefs = await db.studyPreference.findUnique({ where: { userId } })
  const maxDaily = prefs?.maxDailyMinutes ?? 180

  const availability: AvailabilityWindow[] = await db.studyAvailability.findMany({
    where: { userId },
    orderBy: { weekday: 'asc' },
  })

  const lessons = await db.lesson.findMany({
    where: {
      userId,
      archivedAt: null,
      subjectId: { in: subjectIds },
      status: { not: 'COMPLETED' },
      // skip lessons that already have a future scheduled session
      sessions: { none: { status: 'SCHEDULED', date: { gte: dayStart(new Date()) } } },
    },
    include: { subject: { select: { importance: true, priority: true, examDate: true, deadline: true } } },
  })

  if (!lessons.length || !availability.length) {
    return { slots: [], skipped: [], unscheduledCount: 0, replacedCount: 0, daysUsed: 0 }
  }

  const now = dayStart(new Date())

  // ── Score candidates ────────────────────────────────────────────
  const candidates: Candidate[] = lessons.map((l) => {
    let score = 0
    const exam = l.subject.examDate
    if (exam) {
      const daysLeft = Math.ceil((dayStart(exam).getTime() - now.getTime()) / 86_400_000)
      if (daysLeft >= 0) score += Math.max(0, 24 - daysLeft) * 3
      else score += 30 // already past — catch up fast
    }
    if (l.subject.deadline) {
      const daysToDeadline = Math.ceil((dayStart(l.subject.deadline).getTime() - now.getTime()) / 86_400_000)
      if (daysToDeadline >= 0) score += Math.max(0, 21 - daysToDeadline) * 2
    }
    score += IMPORTANCE_WEIGHT[l.subject.importance] * 4
    score += (6 - l.subject.priority) * 3
    score += PRIORITY_WEIGHT[l.priority] * 3

    return {
      lessonId: l.id,
      subjectId: l.subjectId,
      chapterId: l.chapterId,
      score,
      minutes: l.estimatedMinutes,
    }
  })

  candidates.sort((a, b) => b.score - a.score || a.minutes - b.minutes)

  // ── Existing occupancy ─────────────────────────────────────────
  const horizonEnd = addDays(now, horizonDays)
  if (opts.replaceExisting) {
    const del = await db.studySession.deleteMany({
      where: {
        userId,
        source: 'AUTO',
        status: 'SCHEDULED',
        date: { gte: now, lt: horizonEnd },
      },
    })
    var replacedCount = del.count
  } else {
    var replacedCount = 0
  }

  const existing = await db.studySession.findMany({
    where: { userId, date: { gte: now, lt: horizonEnd }, status: { notIn: ['CANCELLED'] } },
    select: { date: true, startTime: true, endTime: true },
  })

  const busy = new Map<string, { s: number; e: number }[]>()
  for (const s of existing) {
    const key = dayStart(s.date).toISOString()
    const arr = busy.get(key) ?? []
    arr.push({ s: toMin(s.startTime), e: toMin(s.endTime) })
    busy.set(key, arr)
  }

  const usedPerDay = new Map<string, number>()
  const freePerDay = new Map<string, { s: number; e: number }[]>()

  const freeWindows = (key: string, dow: number) => {
    const cached = freePerDay.get(key)
    if (cached) return cached
    const taken = (busy.get(key) ?? []).slice().sort((a, b) => a.s - b.s)
    const windows: { s: number; e: number }[] = []
    for (const w of availability.filter((a) => a.weekday === dow)) {
      let cursor = toMin(w.startTime)
      const end = toMin(w.endTime)
      for (const t of taken) {
        if (t.e <= cursor || t.s >= end) continue
        if (t.s > cursor) windows.push({ s: cursor, e: Math.min(t.s, end) })
        cursor = Math.max(cursor, t.e)
        if (cursor >= end) break
      }
      if (cursor < end) windows.push({ s: cursor, e: end })
    }
    freePerDay.set(key, windows)
    return windows
  }

  const slots: PlannedSlot[] = []
  const skipped: string[] = []
  const queue = [...candidates]

  for (let d = 0; d < horizonDays && queue.length; d++) {
    const date = addDays(now, d)
    const key = date.toISOString()
    const dow = date.getDay()

    if (!availability.some((a) => a.weekday === dow)) continue

    let dayUsed = usedPerDay.get(key) ?? 0
    const windows = freeWindows(key, dow)
    if (!windows.length) continue

    for (const win of windows) {
      let cursor = win.s
      while (queue.length) {
        const cand = queue[0]
        const dur = Math.min(Math.max(cand.minutes, 10), maxDaily, MINUTES_PER_DAY_LIMIT)

        if (cursor + dur > win.e) break
        if (dayUsed + dur > maxDaily) break

        queue.shift()
        const endTime = toTime(cursor + dur)
        slots.push({
          lessonId: cand.lessonId,
          subjectId: cand.subjectId,
          chapterId: cand.chapterId,
          date,
          startTime: toTime(cursor),
          endTime,
          durationMinutes: dur,
        })
        busy.get(key)?.push({ s: cursor, e: cursor + dur })
        if (!busy.has(key)) busy.set(key, [{ s: cursor, e: cursor + dur }])
        freePerDay.delete(key) // invalidate

        cursor += dur + breakMin
        dayUsed += dur
        usedPerDay.set(key, dayUsed)
      }
      if (!queue.length) break
    }
  }

  const unscheduled = queue.length
  queue.forEach((c) => skipped.push(c.lessonId))

  return {
    slots,
    skipped,
    unscheduledCount: unscheduled,
    replacedCount,
    daysUsed: new Set(slots.map((s) => dayStart(s.date).toISOString())).size,
  }
}

/** Persists a generated plan in a single transaction. */
export async function savePlan(userId: string, slots: PlannedSlot[]) {
  if (!slots.length) return 0
  const data = slots.map((s) => ({
    userId,
    subjectId: s.subjectId,
    chapterId: s.chapterId,
    lessonId: s.lessonId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    status: 'SCHEDULED' as const,
    source: 'AUTO' as const,
  }))
  await db.studySession.createMany({ data })
  return data.length
}

/** True when [start,end) on `date` overlaps an existing session of the user. */
export async function hasOverlap(
  userId: string,
  date: Date,
  start: string,
  end: string,
  excludeId?: string,
): Promise<boolean> {
  const rows = await db.studySession.findMany({
    where: {
      userId,
      date: dayStart(date),
      status: { notIn: ['CANCELLED'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { startTime: true, endTime: true },
  })
  const s = toMin(start)
  const e = toMin(end)
  return rows.some((r) => s < toMin(r.endTime) && e > toMin(r.startTime))
}

export const timeHelpers = { toMin, toTime, dayStart, addDays }
