import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { subjectProgress } from '@/lib/progress'
import { SubjectDetailClient } from './client'

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)
  const t = await getTranslations()

  // Ownership enforced in the query itself.
  const subject = await db.subject.findFirst({
    where: { id, userId: user.id },
    include: {
      semester: { select: { id: true, name: true } },
      chapters: {
        where: { archivedAt: null },
        orderBy: { order: 'asc' },
        include: {
          lessons: { where: { archivedAt: null }, orderBy: { order: 'asc' } },
        },
      },
    },
  })

  if (!subject) notFound()

  const progress = await subjectProgress(user.id, subject.id)

  const data = {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    color: subject.color,
    coefficient: subject.coefficient,
    importance: subject.importance,
    priority: subject.priority,
    examDate: subject.examDate?.toISOString() ?? null,
    deadline: subject.deadline?.toISOString() ?? null,
    estimatedHours: subject.estimatedHours,
    notes: subject.notes,
    semesterName: subject.semester?.name ?? null,
    progress,
    chapters: subject.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      order: c.order,
      lessons: c.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        order: l.order,
        estimatedMinutes: l.estimatedMinutes,
        priority: l.priority,
        status: l.status,
        completedAt: l.completedAt?.toISOString() ?? null,
        notes: l.notes,
      })),
    })),
  }

  return (
    <div className="animate-fade-in">
      <SubjectDetailClient subject={data} locale={locale} tTitle={t('subjects.title')} />
    </div>
  )
}
