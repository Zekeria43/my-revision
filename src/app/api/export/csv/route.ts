import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { getAnalytics, rangeStart, type RangeKey } from '@/lib/analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/export/csv?type=sessions|lessons|progress|analytics&range=30d
 *
 * Streams a CSV of the authenticated user's own data only. Columns are
 * machine-generated labels (identifiers + raw values) so the file is
 * locale-neutral and re-importable; user-authored text is exported verbatim
 * and never translated or re-encoded.
 */

const TYPES = new Set(['sessions', 'lessons', 'progress', 'analytics'])
const RANGES = new Set<RangeKey>(['7d', '30d', '90d', 'year'])

/** RFC 4180 escaping + UTF-8 BOM so Excel detects Arabic correctly. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

function response(body: string, filename: string) {
  return new NextResponse('\uFEFF' + body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : '')

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'sessions'
  const rangeRaw = (url.searchParams.get('range') ?? '30d') as RangeKey
  const range = RANGES.has(rangeRaw) ? rangeRaw : '30d'

  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const scope = { userId: user.id }

  try {
    if (type === 'sessions') {
      const rows = await db.studySession.findMany({
        where: { ...scope, date: { gte: rangeStart(range) } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        include: {
          subject: { select: { name: true } },
          chapter: { select: { title: true } },
          lesson: { select: { title: true } },
        },
      })

      const body = csv([
        ['id', 'date', 'start_time', 'end_time', 'duration_min', 'status', 'priority', 'source',
          'subject', 'chapter', 'lesson', 'notes'],
        ...rows.map((s) => [
          s.id,
          iso(s.date).slice(0, 10),
          s.startTime,
          s.endTime,
          s.durationMinutes,
          s.status,
          s.priority,
          s.source,
          s.subject.name,
          s.chapter?.title ?? '',
          s.lesson?.title ?? '',
          s.notes ?? '',
        ]),
      ])
      return response(body, `marevision-sessions-${range}-${stamp}.csv`)
    }

    if (type === 'lessons') {
      const rows = await db.lesson.findMany({
        where: scope,
        orderBy: [{ subjectId: 'asc' }, { order: 'asc' }],
        include: {
          subject: { select: { name: true } },
          chapter: { select: { title: true } },
        },
      })

      const body = csv([
        ['id', 'subject', 'chapter', 'title', 'status', 'priority', 'estimated_minutes',
          'completed_at', 'order', 'notes'],
        ...rows.map((l) => [
          l.id,
          l.subject.name,
          l.chapter?.title ?? '',
          l.title,
          l.status,
          l.priority,
          l.estimatedMinutes,
          iso(l.completedAt),
          l.order,
          l.notes ?? '',
        ]),
      ])
      return response(body, `marevision-lessons-${stamp}.csv`)
    }

    if (type === 'progress') {
      const analytics = await getAnalytics(user.id, range, 'en')
      const body = csv([
        ['subject', 'completed_lessons', 'total_lessons', 'percent', 'study_minutes'],
        ...analytics.bySubject.map((s) => [
          s.name,
          s.completed,
          s.total,
          s.percent,
          s.minutes,
        ]),
      ])
      return response(body, `marevision-progress-${range}-${stamp}.csv`)
    }

    // type === 'analytics' — full daily series
    const analytics = await getAnalytics(user.id, range, 'en')
    const daily = new Map(analytics.overTime.map((o) => [o.date, { completed: o.completed }]))
    const minutesByDate = new Map<string, number>()
    const sessions = await db.studySession.findMany({
      where: { ...scope, status: 'COMPLETED', date: { gte: rangeStart(range) } },
      select: { date: true, durationMinutes: true },
    })
    for (const s of sessions) {
      const k = s.date.toISOString().slice(0, 10)
      minutesByDate.set(k, (minutesByDate.get(k) ?? 0) + s.durationMinutes)
    }

    const dates = [...new Set([...daily.keys(), ...minutesByDate.keys()])].sort()
    const body = csv([
      ['date', 'cumulative_lessons_completed', 'study_minutes'],
      ...dates.map((d) => [
        d,
        daily.get(d)?.completed ?? 0,
        minutesByDate.get(d) ?? 0,
      ]),
      [],
      ['metric', 'value'],
      ['total_study_minutes', analytics.kpis.totalStudyTime],
      ['avg_daily_minutes', analytics.kpis.avgDaily],
      ['consistency_percent', analytics.kpis.consistency],
      ['missed_rate_percent', analytics.kpis.missedRate],
      ['day_streak', analytics.kpis.streak],
      ['sessions_total', analytics.totals.sessions],
      ['sessions_completed', analytics.totals.completedSessions],
      ['sessions_missed', analytics.totals.missedSessions],
      ['days_studied', analytics.totals.daysStudied],
    ])
    return response(body, `marevision-analytics-${range}-${stamp}.csv`)
  } catch (e) {
    console.error('[export/csv] failed', e)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
