import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { CalendarClient, type SessionRow } from './client'

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const fromWindow = new Date(from.getTime() - 45 * 86_400_000)
  const toWindow = new Date(from.getTime() + 120 * 86_400_000)

  const [sessions, subjects, rescheduleHistory] = await Promise.all([
    db.studySession.findMany({
      where: { userId: user!.id, date: { gte: fromWindow, lte: toWindow } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        subject: { select: { id: true, name: true, color: true } },
        chapter: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
      },
    }),
    db.subject.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { name: 'asc' },
      include: {
        chapters: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            lessons: {
              where: { archivedAt: null },
              orderBy: { order: 'asc' },
              select: { id: true, title: true },
            },
          },
        },
      },
    }),
    db.reschedulingHistory.findMany({
      where: { userId: user!.id },
      orderBy: { rescheduledAt: 'desc' },
      take: 40,
      include: {
        originalSession: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            subject: { select: { name: true, color: true } },
            lesson: { select: { title: true } },
          },
        },
        newSession: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            subject: { select: { name: true, color: true } },
            lesson: { select: { title: true } },
          },
        },
      },
    }),
  ])

  const rows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    status: s.status,
    priority: s.priority,
    source: s.source,
    notes: s.notes,
    subjectId: s.subjectId,
    subjectName: s.subject.name,
    subjectColor: s.subject.color,
    chapterId: s.chapterId,
    chapterTitle: s.chapter?.title ?? null,
    lessonId: s.lessonId,
    lessonTitle: s.lesson?.title ?? null,
  }))

  const subjectOptions = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    chapters: s.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      lessons: c.lessons.map((l) => ({ id: l.id, title: l.title })),
    })),
  }))

  const history = rescheduleHistory.map((h) => ({
    id: h.id,
    reason: h.reason,
    rescheduledAt: h.rescheduledAt.toISOString(),
    originalStatus: h.originalStatus,
    newStatus: h.newStatus,
    originalDate: h.originalDate.toISOString().slice(0, 10),
    newDate: h.newDate?.toISOString().slice(0, 10) ?? null,
    original: {
      id: h.originalSession.id,
      startTime: h.originalSession.startTime,
      endTime: h.originalSession.endTime,
      subjectName: h.originalSession.subject.name,
      subjectColor: h.originalSession.subject.color,
      lessonTitle: h.originalSession.lesson?.title ?? null,
    },
    next: h.newSession
      ? {
          id: h.newSession.id,
          startTime: h.newSession.startTime,
          endTime: h.newSession.endTime,
          status: h.newSession.status,
          subjectName: h.newSession.subject.name,
          subjectColor: h.newSession.subject.color,
          lessonTitle: h.newSession.lesson?.title ?? null,
        }
      : null,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('calendar.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('calendar.subtitle')}</p>
      </div>

      <CalendarClient
        sessions={rows}
        subjects={subjectOptions}
        history={history}
        locale={locale}
      />
    </div>
  )
}
