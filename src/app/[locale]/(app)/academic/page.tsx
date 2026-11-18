import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { AcademicClient } from './client'

export default async function AcademicPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const [years, semesters, specializations, subjectCounts, lessonCounts] = await Promise.all([
    db.academicYear.findMany({
      where: { userId: user!.id },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      include: { _count: { select: { semesters: true, specializations: true } } },
    }),
    db.semester.findMany({
      where: { userId: user!.id },
      orderBy: [{ isCurrent: 'desc' }, { order: 'asc' }],
      include: { academicYear: { select: { id: true, name: true } } },
    }),
    db.specialization.findMany({
      where: { userId: user!.id },
      orderBy: { name: 'asc' },
      include: { academicYear: { select: { id: true, name: true } } },
    }),
    db.subject.groupBy({
      by: ['semesterId'],
      where: { userId: user!.id, archivedAt: null },
      _count: { _all: true },
    }),
    db.lesson.groupBy({
      by: ['subjectId'],
      where: { userId: user!.id, archivedAt: null },
      _count: { _all: true },
    }),
  ])

  const subjectCountBySemester = new Map(
    subjectCounts.map((r) => [r.semesterId ?? 'none', r._count._all]),
  )
  const lessonCountBySubject = new Map(lessonCounts.map((r) => [r.subjectId, r._count._all]))

  // Lessons per semester, derived from subjects → lessons.
  const subjects = await db.subject.findMany({
    where: { userId: user!.id, archivedAt: null },
    select: { id: true, semesterId: true },
  })
  const lessonsPerSemester = new Map<string, number>()
  for (const s of subjects) {
    const key = s.semesterId ?? 'none'
    lessonsPerSemester.set(key, (lessonsPerSemester.get(key) ?? 0) + (lessonCountBySubject.get(s.id) ?? 0))
  }

  const yearsData = years.map((y) => ({
    id: y.id,
    name: y.name,
    startDate: y.startDate.toISOString(),
    endDate: y.endDate.toISOString(),
    status: y.status,
    description: y.description,
    isCurrent: y.isCurrent,
    semesterCount: y._count.semesters,
    specCount: y._count.specializations,
  }))

  const semestersData = semesters.map((s) => ({
    id: s.id,
    academicYearId: s.academicYearId,
    academicYearName: s.academicYear.name,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    isCurrent: s.isCurrent,
    order: s.order,
    subjectCount: subjectCountBySemester.get(s.id) ?? 0,
    lessonCount: lessonsPerSemester.get(s.id) ?? 0,
  }))

  const specsData = specializations.map((s) => ({
    id: s.id,
    academicYearId: s.academicYearId,
    academicYearName: s.academicYear.name,
    name: s.name,
    description: s.description,
    program: s.program,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('academic.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t('academic.subtitle')}
        </p>
      </div>

      <AcademicClient
        years={yearsData}
        semesters={semestersData}
        specializations={specsData}
        locale={locale}
      />
    </div>
  )
}
