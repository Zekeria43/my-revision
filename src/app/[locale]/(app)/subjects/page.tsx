import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { overallProgress } from '@/lib/progress'
import { SubjectsClient } from './client'

export default async function SubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const [subjects, progress, semesters] = await Promise.all([
    db.subject.findMany({
      where: { userId: user!.id },
      orderBy: [{ archivedAt: 'asc' }, { order: 'asc' }],
      include: {
        semester: { select: { id: true, name: true } },
        _count: {
          select: {
            chapters: { where: { archivedAt: null } },
            lessons: { where: { archivedAt: null } },
          },
        },
      },
    }),
    overallProgress(user!.id),
    db.semester.findMany({
      where: { userId: user!.id },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const progressBySubject = new Map(progress.bySubject.map((p) => [p.subjectId, p]))

  const data = subjects.map((s) => {
    const p = progressBySubject.get(s.id)
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      color: s.color,
      coefficient: s.coefficient,
      importance: s.importance,
      priority: s.priority,
      examDate: s.examDate?.toISOString() ?? null,
      deadline: s.deadline?.toISOString() ?? null,
      estimatedHours: s.estimatedHours,
      notes: s.notes,
      archived: !!s.archivedAt,
      semesterId: s.semesterId,
      semesterName: s.semester?.name ?? null,
      chapterCount: s._count.chapters,
      lessonCount: s._count.lessons,
      completed: p?.completed ?? 0,
      inProgress: p?.inProgress ?? 0,
      needsRevision: p?.needsRevision ?? 0,
      percent: p?.percent ?? 0,
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('subjects.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('subjects.subtitle')}</p>
      </div>

      <SubjectsClient subjects={data} semesters={semesters} locale={locale} />
    </div>
  )
}
