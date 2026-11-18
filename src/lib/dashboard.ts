import { db } from './db'
import { overallProgress, progressSummary, type OverallProgress } from './progress'
import { formatDateISO } from './utils'

/**
 * Dashboard data layer.
 * Every number returned here is computed live from the database.
 * No cached aggregates, no client-side guesswork, no placeholder values.
 */

export interface DashboardData {
  currentYear: { id: string; name: string } | null
  currentSemester: { id: string; name: string } | null
  subjectCount: number
  progress: OverallProgress
  todaySessions: TodaySession[]
  upcomingSessions: UpcomingSession[]
  missedCount: number
  weeklyMinutes: number
  monthlyMinutes: number
  upcomingExams: UpcomingExam[]
  lastActivity: { action: string; entityType: string; createdAt: Date } | null
  charts: {
    bySubject: { name: string; color: string; percent: number; completed: number; total: number }[]
    overTime: { date: string; completed: number }[]
    weeklyActivity: { day: string; minutes: number }[]
    plannedVsActual: { label: string; planned: number; actual: number }[]
    timeDistribution: { name: string; value: number; color: string }[]
  }
  isEmpty: boolean
}

export interface TodaySession {
  id: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: string
  priority: string
  subjectName: string
  subjectColor: string
  lessonTitle: string | null
}

export interface UpcomingSession {
  id: string
  date: Date
  startTime: string
  endTime: string
  status: string
  subjectName: string
  subjectColor: string
  lessonTitle: string | null
}

export interface UpcomingExam {
  id: string
  title: string
  date: Date
  importance: string
  subjectName: string
  subjectColor: string
  daysLeft: number
}

const DAY_MS = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function getDashboardData(
  userId: string,
  locale: string = 'ar',
): Promise<DashboardData> {
  const now = new Date()
  const today = startOfDay(now)
  const dayNames = locale === 'ar' ? AR_DAYS : EN_DAYS

  const [
    currentYear,
    currentSemester,
    subjectCount,
    progress,
    summary,
    todayRows,
    upcomingRows,
    missedCount,
    weeklyRows,
    examsRaw,
    lastActivity,
    subjectMeta,
  ] = await Promise.all([
    db.academicYear.findFirst({
      where: { userId, isCurrent: true, status: 'ACTIVE' },
      select: { id: true, name: true },
    }),
    db.semester.findFirst({
      where: { userId, isCurrent: true },
      select: { id: true, name: true },
    }),
    db.subject.count({ where: { userId, archivedAt: null } }),
    overallProgress(userId),
    progressSummary(userId),
    db.studySession.findMany({
      where: { userId, date: today, status: { notIn: ['CANCELLED'] } },
      orderBy: { startTime: 'asc' },
      include: { subject: { select: { name: true, color: true } }, lesson: { select: { title: true } } },
    }),
    db.studySession.findMany({
      where: { userId, date: { gt: today }, status: 'SCHEDULED' },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 8,
      include: { subject: { select: { name: true, color: true } }, lesson: { select: { title: true } } },
    }),
    db.studySession.count({ where: { userId, status: 'MISSED' } }),
    db.studySession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: { gte: new Date(today.getTime() - 7 * DAY_MS) },
      },
      select: { completedAt: true, durationMinutes: true },
    }),
    db.exam.findMany({
      where: { userId, date: { gte: now } },
      orderBy: { date: 'asc' },
      take: 5,
      include: { subject: { select: { name: true, color: true } } },
    }),
    db.activityLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { action: true, entityType: true, createdAt: true },
    }),
    db.subject.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, color: true },
    }),
  ])

  // ── Today / upcoming sessions ──────────────────────────────────
  const todaySessions: TodaySession[] = todayRows.map((s) => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    status: s.status,
    priority: s.priority,
    subjectName: s.subject.name,
    subjectColor: s.subject.color,
    lessonTitle: s.lesson?.title ?? null,
  }))

  const upcomingSessions: UpcomingSession[] = upcomingRows.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    subjectName: s.subject.name,
    subjectColor: s.subject.color,
    lessonTitle: s.lesson?.title ?? null,
  }))

  // ── Exams ──────────────────────────────────────────────────────
  const upcomingExams: UpcomingExam[] = upcomingExamsRaw(examsRaw, today)

  // ── Study minutes ──────────────────────────────────────────────
  const weeklyMinutes = weeklyRows.reduce((a, r) => a + r.durationMinutes, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthMinutes = (
    await db.studySession.findMany({
      where: { userId, status: 'COMPLETED', completedAt: { gte: monthStart } },
      select: { durationMinutes: true },
    })
  ).reduce((a, r) => a + r.durationMinutes, 0)

  // ── Charts ─────────────────────────────────────────────────────
  const metaById = new Map(subjectMeta.map((s) => [s.id, s]))

  const bySubject = progress.bySubject
    .map((p) => {
      const m = metaById.get(p.subjectId)
      return {
        name: m?.name ?? '—',
        color: m?.color ?? '#1b6af5',
        percent: p.percent,
        completed: p.completed,
        total: p.total,
      }
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.percent - a.percent)

  // Completed lessons over the last 30 days (cumulative)
  const completedRows = await db.lesson.findMany({
    where: { userId, status: 'COMPLETED', completedAt: { not: null } },
    select: { completedAt: true },
    orderBy: { completedAt: 'asc' },
  })
  const overTime: { date: string; completed: number }[] = []
  {
    let cum = 0
    let idx = 0
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(new Date(today.getTime() - i * DAY_MS))
      const next = new Date(d.getTime() + DAY_MS)
      while (idx < completedRows.length && completedRows[idx].completedAt! < next) {
        cum++
        idx++
      }
      overTime.push({ date: formatDateISO(d), completed: cum })
    }
  }

  // Weekly study activity (last 7 days, minutes per weekday)
  const weeklyMap = new Map<string, number>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS)
    weeklyMap.set(formatDateISO(d), 0)
  }
  const weekStart = new Date(today.getTime() - 6 * DAY_MS)
  const weekRows = await db.studySession.findMany({
    where: { userId, status: 'COMPLETED', completedAt: { gte: weekStart } },
    select: { completedAt: true, durationMinutes: true },
  })
  for (const r of weekRows) {
    const k = formatDateISO(startOfDay(r.completedAt!))
    weeklyMap.set(k, (weeklyMap.get(k) ?? 0) + r.durationMinutes)
  }
  const weeklyActivity = [...weeklyMap.entries()].map(([date, minutes]) => ({
    day: dayNames[new Date(date + 'T00:00:00').getDay()],
    minutes,
  }))

  // Planned (scheduled) vs actual (completed) minutes for the current week
  const plannedRows = await db.studySession.findMany({
    where: { userId, date: { gte: weekStart, lte: today }, status: { notIn: ['CANCELLED'] } },
    select: { durationMinutes: true, status: true },
  })
  const plannedMinutes = plannedRows.reduce((a, r) => a + r.durationMinutes, 0)
  const actualMinutes = plannedRows
    .filter((r) => r.status === 'COMPLETED')
    .reduce((a, r) => a + r.durationMinutes, 0)

  // Time distribution across subjects (completed session minutes)
  const distRows = await db.studySession.groupBy({
    by: ['subjectId'],
    where: { userId, status: 'COMPLETED' },
    _sum: { durationMinutes: true },
  })
  const timeDistribution = distRows
    .map((r) => ({
      name: metaById.get(r.subjectId)?.name ?? '—',
      value: r._sum.durationMinutes ?? 0,
      color: metaById.get(r.subjectId)?.color ?? '#1b6af5',
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const isEmpty = subjectCount === 0 && progress.total === 0

  return {
    currentYear,
    currentSemester,
    subjectCount,
    progress,
    todaySessions,
    upcomingSessions,
    missedCount,
    weeklyMinutes,
    monthlyMinutes: monthMinutes,
    upcomingExams,
    lastActivity,
    charts: {
      bySubject,
      overTime,
      weeklyActivity,
      plannedVsActual: [
        { label: 'planned', planned: plannedMinutes, actual: actualMinutes },
      ],
      timeDistribution,
    },
    isEmpty,
  }
}

function upcomingExamsRaw(
  rows: {
    id: string
    title: string
    date: Date
    importance: string
    subject: { name: string; color: string }
  }[],
  today: Date,
): UpcomingExam[] {
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    importance: e.importance,
    subjectName: e.subject.name,
    subjectColor: e.subject.color,
    daysLeft: Math.ceil((startOfDay(e.date).getTime() - today.getTime()) / DAY_MS),
  }))
}
