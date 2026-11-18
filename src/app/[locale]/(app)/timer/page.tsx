import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { TimerClient, type TimerHistoryRow } from './client'

export default async function TimerPage({
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
  from.setDate(from.getDate() - 30)

  const [prefs, subjects, historyRows, totals] = await Promise.all([
    db.studyPreference.findUnique({ where: { userId: user!.id } }),
    db.subject.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
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
    db.studySession.findMany({
      where: { userId: user!.id, status: 'COMPLETED', completedAt: { gte: from } },
      orderBy: { completedAt: 'desc' },
      take: 30,
      include: {
        subject: { select: { name: true, color: true } },
        lesson: { select: { title: true } },
      },
    }),
    db.studySession.aggregate({
      where: { userId: user!.id, status: 'COMPLETED', completedAt: { gte: from } },
      _sum: { durationMinutes: true },
      _count: true,
    }),
  ])

  const history: TimerHistoryRow[] = historyRows.map((s) => ({
    id: s.id,
    date: s.completedAt?.toISOString() ?? s.date.toISOString(),
    durationMinutes: s.durationMinutes,
    subjectName: s.subject.name,
    subjectColor: s.subject.color,
    lessonTitle: s.lesson?.title ?? null,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('timer.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('timer.subtitle')}</p>
      </div>

      <TimerClient
        subjects={subjects.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          chapters: s.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            lessons: c.lessons.map((l) => ({ id: l.id, title: l.title })),
          })),
        }))}
        defaults={{
          focus: prefs?.pomodoroStudyMin ?? 25,
          break: prefs?.pomodoroBreakMin ?? 5,
          longBreak: prefs?.pomodoroLongBreakMin ?? 15,
          cycles: prefs?.pomodoroCycles ?? 4,
        }}
        history={history}
        totalFocused={totals._sum.durationMinutes ?? 0}
        sessionCount={totals._count}
        locale={locale}
      />
    </div>
  )
}
