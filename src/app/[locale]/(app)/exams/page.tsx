import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { ExamsClient, type ExamRow } from './client'

export default async function ExamsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const [exams, subjects] = await Promise.all([
    db.exam.findMany({
      where: { userId: user!.id },
      orderBy: { date: 'asc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
      },
    }),
    db.subject.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ])

  // Per-exam revision stats: incomplete lessons of that subject + scheduled sessions.
  const subjectIds = [...new Set(exams.map((e) => e.subjectId))]
  const [lessonStats, sessionStats] = await Promise.all([
    db.lesson.groupBy({
      by: ['subjectId', 'status'],
      where: { userId: user!.id, subjectId: { in: subjectIds }, archivedAt: null },
      _count: { _all: true },
    }),
    db.studySession.groupBy({
      by: ['subjectId'],
      where: {
        userId: user!.id,
        subjectId: { in: subjectIds },
        status: 'SCHEDULED',
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _count: { _all: true },
      _sum: { durationMinutes: true },
    }),
  ])

  const incompleteBySubject = new Map<string, number>()
  const totalBySubject = new Map<string, number>()
  for (const r of lessonStats) {
    totalBySubject.set(r.subjectId, (totalBySubject.get(r.subjectId) ?? 0) + r._count._all)
    if (r.status !== 'COMPLETED') {
      incompleteBySubject.set(r.subjectId, (incompleteBySubject.get(r.subjectId) ?? 0) + r._count._all)
    }
  }
  const scheduledBySubject = new Map(sessionStats.map((r) => [r.subjectId, r._count._all]))

  const rows: ExamRow[] = exams.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date.toISOString(),
    importance: e.importance,
    notes: e.notes,
    subjectId: e.subjectId,
    subjectName: e.subject.name,
    subjectColor: e.subject.color,
    incompleteLessons: incompleteBySubject.get(e.subjectId) ?? 0,
    totalLessons: totalBySubject.get(e.subjectId) ?? 0,
    scheduledSessions: scheduledBySubject.get(e.subjectId) ?? 0,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('exams.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('exams.subtitle')}</p>
      </div>

      <ExamsClient exams={rows} subjects={subjects} locale={locale} />
    </div>
  )
}
