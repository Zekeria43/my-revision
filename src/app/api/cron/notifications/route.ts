import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailMode, sendMail } from '@/lib/mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/notifications
 *
 * Generates time-based notifications for every active user:
 *   - session reminders   (SESSION_REMINDER, per-user remindBeforeMin)
 *   - upcoming exams      (EXAM_UPCOMING, 3 days / 1 day / today)
 *   - missed sessions     (SESSION_MISSED, past & still SCHEDULED)
 *   - overdue lessons     (LESSON_OVERDUE, planned date passed)
 *   - weekly summary      (PROGRESS_SUMMARY, Mondays)
 *
 * Auth: requires `Authorization: Bearer $CRON_SECRET` (or ?secret= for
 * providers that only support query params). If CRON_SECRET is unset the
 * route is disabled and returns 404 — it is never open by default.
 *
 * Every insert is idempotent: a notification is only created when an
 * equivalent unread one does not already exist.
 */

interface Created {
  userId: string
  type: string
  email?: { to: string; subject: string; text: string }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)
const dayKey = (d: Date) => startOfDay(d).getTime()

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return new NextResponse('Not found', { status: 404 })

  const auth = req.headers.get('authorization') ?? ''
  const url = new URL(req.url)
  const provided =
    auth.startsWith('Bearer ') ? auth.slice(7) : (url.searchParams.get('secret') ?? '')

  if (provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = startOfDay(now)
  const created: Created[] = []

  try {
    const users = await db.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        prefs: { select: { notificationsEnabled: true, emailEnabled: true, remindBeforeMin: true } },
      },
    })

    for (const user of users) {
      const prefs = user.prefs
      if (prefs && !prefs.notificationsEnabled) continue
      const remindBefore = prefs?.remindBeforeMin ?? 15

      /* ── Session reminders ─────────────────────────────── */
      const windowStart = now
      const windowEnd = addDays(now, 1)
      const upcoming = await db.studySession.findMany({
        where: {
          userId: user.id,
          status: 'SCHEDULED',
          date: { gte: today, lte: windowEnd },
        },
        include: {
          subject: { select: { name: true } },
          lesson: { select: { title: true } },
        },
      })

      for (const s of upcoming) {
        const startsAt = new Date(`${s.date.toISOString().slice(0, 10)}T${s.startTime}:00`)
        const diffMin = (startsAt.getTime() - now.getTime()) / 60000
        if (diffMin < -5 || diffMin > remindBefore + 5) continue

        const exists = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'SESSION_REMINDER',
            readAt: null,
            link: `/calendar?session=${s.id}`,
          },
        })
        if (exists) continue

        const params = JSON.stringify({
          subject: s.subject.name,
          lesson: s.lesson?.title ?? '',
          time: s.startTime,
        })
        await db.notification.create({
          data: {
            userId: user.id,
            type: 'SESSION_REMINDER',
            titleKey: 'notifications.type.SESSION_REMINDER',
            bodyKey: 'dashboard.todayPlan',
            params,
            link: `/calendar?session=${s.id}`,
          },
        })
        created.push({
          userId: user.id,
          type: 'SESSION_REMINDER',
          email: {
            to: user.email,
            subject: `مراجعتي — ${s.startTime} · ${s.subject.name}`,
            text: `${s.subject.name}${s.lesson?.title ? ` — ${s.lesson.title}` : ''}\n${s.startTime}–${s.endTime}`,
          },
        })
      }

      /* ── Missed sessions ───────────────────────────────── */
      const cutoff = addDays(today, -1)
      const missed = await db.studySession.findMany({
        where: {
          userId: user.id,
          status: 'SCHEDULED',
          date: { lt: today, gte: cutoff },
          endTime: { lt: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` },
        },
        include: { subject: { select: { name: true } } },
        take: 20,
      })

      for (const s of missed) {
        const link = `/calendar?session=${s.id}`
        const exists = await db.notification.findFirst({
          where: { userId: user.id, type: 'SESSION_MISSED', readAt: null, link },
        })
        if (exists) continue
        await db.notification.create({
          data: {
            userId: user.id,
            type: 'SESSION_MISSED',
            titleKey: 'notifications.type.SESSION_MISSED',
            bodyKey: 'missed.subtitle',
            params: JSON.stringify({ subject: s.subject.name, date: s.date.toISOString().slice(0, 10) }),
            link,
          },
        })
        created.push({ userId: user.id, type: 'SESSION_MISSED' })
      }

      /* ── Upcoming exams ────────────────────────────────── */
      const exams = await db.exam.findMany({
        where: {
          userId: user.id,
          date: { gte: today, lte: addDays(today, 8) },
        },
        include: { subject: { select: { name: true } } },
      })

      for (const e of exams) {
        const daysLeft = Math.round((dayKey(e.date) - dayKey(today)) / 86_400_000)
        if (![0, 1, 3, 7].includes(daysLeft)) continue

        const link = `/exams`
        const exists = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'EXAM_UPCOMING',
            readAt: null,
            link,
            params: { contains: e.id },
          },
        })
        if (exists) continue

        await db.notification.create({
          data: {
            userId: user.id,
            type: 'EXAM_UPCOMING',
            titleKey: 'notifications.type.EXAM_UPCOMING',
            bodyKey: daysLeft === 0 ? 'exams.today' : 'exams.daysLeft',
            params: JSON.stringify({ id: e.id, n: daysLeft, subject: e.subject.name, title: e.title }),
            link,
          },
        })
        created.push({
          userId: user.id,
          type: 'EXAM_UPCOMING',
          email: {
            to: user.email,
            subject: `مراجعتي — ${e.title}`,
            text: daysLeft === 0 ? 'امتحان اليوم' : `باقي ${daysLeft} يوم — ${e.title} (${e.subject.name})`,
          },
        })
      }

      /* ── Overdue lessons ───────────────────────────────── */
      const overdue = await db.lesson.findMany({
        where: {
          userId: user.id,
          archivedAt: null,
          status: { not: 'COMPLETED' },
          sessions: {
            some: { status: 'SCHEDULED', date: { lt: today } },
          },
        },
        include: { subject: { select: { name: true } }, sessions: { select: { date: true }, orderBy: { date: 'asc' }, take: 1 } },
        take: 10,
      })

      for (const l of overdue) {
        const link = `/subjects/${l.subjectId}`
        const exists = await db.notification.findFirst({
          where: { userId: user.id, type: 'LESSON_OVERDUE', readAt: null, link, params: { contains: l.id } },
        })
        if (exists) continue
        await db.notification.create({
          data: {
            userId: user.id,
            type: 'LESSON_OVERDUE',
            titleKey: 'notifications.type.LESSON_OVERDUE',
            bodyKey: 'lessons.empty',
            params: JSON.stringify({
              id: l.id,
              title: l.title,
              subject: l.subject.name,
              date: l.sessions[0]?.date.toISOString().slice(0, 10) ?? '',
            }),
            link,
          },
        })
        created.push({ userId: user.id, type: 'LESSON_OVERDUE' })
      }

      /* ── Weekly progress summary (Monday) ──────────────── */
      if (now.getDay() === 1) {
        const weekAgo = addDays(today, -7)
        const [completed, minutes] = await Promise.all([
          db.lesson.count({
            where: { userId: user.id, status: 'COMPLETED', completedAt: { gte: weekAgo } },
          }),
          db.studySession.aggregate({
            where: { userId: user.id, status: 'COMPLETED', completedAt: { gte: weekAgo } },
            _sum: { durationMinutes: true },
          }),
        ])

        const exists = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'PROGRESS_SUMMARY',
            readAt: null,
            createdAt: { gte: today },
          },
        })
        if (!exists) {
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'PROGRESS_SUMMARY',
              titleKey: 'notifications.type.PROGRESS_SUMMARY',
              bodyKey: 'dashboard.subtitle',
              params: JSON.stringify({ n: completed, minutes: minutes._sum.durationMinutes ?? 0 }),
              link: '/dashboard',
            },
          })
          created.push({ userId: user.id, type: 'PROGRESS_SUMMARY' })
        }
      }
    }

    /* ── Optional email delivery for reminder-type events ── */
    let emailed = 0
    if (emailMode() !== 'console') {
      for (const c of created) {
        if (!c.email) continue
        const prefs = await db.studyPreference.findUnique({ where: { userId: c.userId } })
        if (prefs && !prefs.emailEnabled) continue
        const res = await sendMail(c.email)
        if (res.delivered) emailed++
      }
    }

    return NextResponse.json({
      ok: true,
      created: created.length,
      byType: created.reduce<Record<string, number>>((acc, c) => {
        acc[c.type] = (acc[c.type] ?? 0) + 1
        return acc
      }, {}),
      emailed,
      at: now.toISOString(),
    })
  } catch (e) {
    console.error('[cron/notifications] failed', e)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
