import { db } from './db'
import { formatDateISO } from './utils'

/**
 * Analytics data layer.
 * Every value is aggregated live from the database for the authenticated user.
 */

export type RangeKey = '7d' | '30d' | '90d' | 'year'

export interface AnalyticsData {
  range: RangeKey
  totals: {
    studyMinutes: number
    sessions: number
    completedSessions: number
    missedSessions: number
    cancelledSessions: number
    lessonsCompleted: number
    lessonsTotal: number
    daysStudied: number
    activeDays: number
  }
  kpis: {
    totalStudyTime: number // minutes
    avgDaily: number // minutes per active day
    consistency: number // % of days in range with study activity
    missedRate: number // %
    streak: number // consecutive days ending today/yesterday
  }
  bySubject: {
    name: string
    color: string
    percent: number
    completed: number
    total: number
    minutes: number
  }[]
  overTime: { date: string; completed: number }[]
  weekly: { day: string; minutes: number }[]
  plannedVsActual: { label: string; planned: number; actual: number }[]
  distribution: { name: string; value: number; color: string }[]
  topDays: { date: string; minutes: number; sessions: number }[]
}

const DAY_MS = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function rangeStart(range: RangeKey, now = new Date()): Date {
  const today = startOfDay(now)
  switch (range) {
    case '7d':
      return new Date(today.getTime() - 6 * DAY_MS)
    case '30d':
      return new Date(today.getTime() - 29 * DAY_MS)
    case '90d':
      return new Date(today.getTime() - 89 * DAY_MS)
    case 'year':
      return new Date(today.getFullYear(), 0, 1)
  }
}

export function rangeDays(range: RangeKey, now = new Date()): number {
  return Math.max(1, Math.round((startOfDay(now).getTime() - rangeStart(range, now).getTime()) / DAY_MS) + 1)
}

export async function getAnalytics(
  userId: string,
  range: RangeKey = '30d',
  locale = 'ar',
  subjectId?: string,
): Promise<AnalyticsData> {
  const now = new Date()
  const from = rangeStart(range, now)
  const to = startOfDay(now)
  const days = rangeDays(range, now)
  const dayNames = locale === 'ar' ? AR_DAYS : EN_DAYS

  const sessionWhere = {
    userId,
    date: { gte: from, lte: to },
    ...(subjectId ? { subjectId } : {}),
  }

  const [sessions, lessonStats, subjectMeta, subjectProgressRows, dailyCompleted] =
    await Promise.all([
      db.studySession.findMany({
        where: sessionWhere,
        select: {
          date: true,
          durationMinutes: true,
          status: true,
          subjectId: true,
        },
      }),
      db.lesson.groupBy({
        by: ['subjectId', 'status'],
        where: {
          userId,
          archivedAt: null,
          ...(subjectId ? { subjectId } : {}),
        },
        _count: { _all: true },
      }),
      db.subject.findMany({
        where: { userId, archivedAt: null, ...(subjectId ? { id: subjectId } : {}) },
        select: { id: true, name: true, color: true },
      }),
      db.studySession.groupBy({
        by: ['subjectId'],
        where: { userId, status: 'COMPLETED', date: { gte: from, lte: to }, ...(subjectId ? { subjectId } : {}) },
        _sum: { durationMinutes: true },
      }),
      db.lesson.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { gte: from, lte: new Date(to.getTime() + DAY_MS - 1) },
          ...(subjectId ? { subjectId } : {}),
        },
        select: { completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
    ])

  const metaById = new Map(subjectMeta.map((s) => [s.id, s]))
  const minutesBySubject = new Map(subjectProgressRows.map((r) => [r.subjectId, r._sum.durationMinutes ?? 0]))

  /* ── Session totals ─────────────────────────────────── */
  const completed = sessions.filter((s) => s.status === 'COMPLETED')
  const missed = sessions.filter((s) => s.status === 'MISSED')
  const cancelled = sessions.filter((s) => s.status === 'CANCELLED')
  const studyMinutes = completed.reduce((a, s) => a + s.durationMinutes, 0)
  const plannedMinutes = sessions
    .filter((s) => s.status !== 'CANCELLED')
    .reduce((a, s) => a + s.durationMinutes, 0)

  /* ── Per-day activity map ───────────────────────────── */
  const perDay = new Map<string, { minutes: number; sessions: number }>()
  for (let i = 0; i < days; i++) {
    perDay.set(formatDateISO(new Date(from.getTime() + i * DAY_MS)), { minutes: 0, sessions: 0 })
  }
  for (const s of completed) {
    const k = formatDateISO(startOfDay(s.date))
    const cur = perDay.get(k) ?? { minutes: 0, sessions: 0 }
    cur.minutes += s.durationMinutes
    cur.sessions += 1
    perDay.set(k, cur)
  }

  const activeDays = [...perDay.values()].filter((v) => v.minutes > 0).length

  /* ── Streak ─────────────────────────────────────────── */
  let streak = 0
  {
    const keys = [...perDay.keys()].sort()
    let cursor = keys.length - 1
    // Allow the streak to start yesterday if today has no study yet.
    if (cursor >= 0 && (perDay.get(keys[cursor])?.minutes ?? 0) === 0) cursor -= 1
    while (cursor >= 0 && (perDay.get(keys[cursor])?.minutes ?? 0) > 0) {
      streak++
      cursor--
    }
  }

  /* ── Missed rate ────────────────────────────────────── */
  const decided = completed.length + missed.length
  const missedRate = decided ? Math.round((missed.length / decided) * 100) : 0

  /* ── By subject (progress + time) ───────────────────── */
  const totalBySubject = new Map<string, number>()
  const doneBySubject = new Map<string, number>()
  for (const r of lessonStats) {
    totalBySubject.set(r.subjectId, (totalBySubject.get(r.subjectId) ?? 0) + r._count._all)
    if (r.status === 'COMPLETED') {
      doneBySubject.set(r.subjectId, (doneBySubject.get(r.subjectId) ?? 0) + r._count._all)
    }
  }

  const bySubject = subjectMeta
    .map((s) => {
      const total = totalBySubject.get(s.id) ?? 0
      const done = doneBySubject.get(s.id) ?? 0
      return {
        name: s.name,
        color: s.color,
        percent: total ? Math.round((done / total) * 100) : 0,
        completed: done,
        total,
        minutes: minutesBySubject.get(s.id) ?? 0,
      }
    })
    .filter((r) => r.total > 0 || r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || b.percent - a.percent)

  /* ── Completed lessons over time (cumulative) ───────── */
  const overTime: { date: string; completed: number }[] = []
  {
    let cum = 0
    let idx = 0
    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * DAY_MS)
      const next = new Date(d.getTime() + DAY_MS)
      while (idx < dailyCompleted.length && dailyCompleted[idx].completedAt! < next) {
        cum++
        idx++
      }
      overTime.push({ date: formatDateISO(d), completed: cum })
    }
  }

  /* ── Weekly distribution (minutes by weekday) ───────── */
  const weeklyMap = new Map<number, number>([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 0]))
  for (const s of completed) {
    const dow = s.date.getDay()
    weeklyMap.set(dow, (weeklyMap.get(dow) ?? 0) + s.durationMinutes)
  }
  // Present Sunday-first in both LTR and RTL layouts.
  const weekly = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    day: dayNames[d],
    minutes: weeklyMap.get(d) ?? 0,
  }))

  /* ── Planned vs actual ──────────────────────────────── */
  const plannedVsActual = [
    { label: 'planned', planned: plannedMinutes, actual: studyMinutes },
  ]

  /* ── Distribution ───────────────────────────────────── */
  const distribution = bySubject
    .filter((s) => s.minutes > 0)
    .map((s) => ({ name: s.name, value: s.minutes, color: s.color }))

  /* ── Top study days ─────────────────────────────────── */
  const topDays = [...perDay.entries()]
    .filter(([, v]) => v.minutes > 0)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 7)
    .map(([date, v]) => ({ date, minutes: v.minutes, sessions: v.sessions }))

  return {
    range,
    totals: {
      studyMinutes,
      sessions: sessions.length,
      completedSessions: completed.length,
      missedSessions: missed.length,
      cancelledSessions: cancelled.length,
      lessonsCompleted: lessonStats
        .filter((r) => r.status === 'COMPLETED')
        .reduce((a, r) => a + r._count._all, 0),
      lessonsTotal: lessonStats.reduce((a, r) => a + r._count._all, 0),
      daysStudied: activeDays,
      activeDays: days,
    },
    kpis: {
      totalStudyTime: studyMinutes,
      avgDaily: activeDays ? Math.round(studyMinutes / activeDays) : 0,
      consistency: Math.round((activeDays / days) * 100),
      missedRate,
      streak,
    },
    bySubject,
    overTime,
    weekly,
    plannedVsActual,
    distribution,
    topDays,
  }
}
