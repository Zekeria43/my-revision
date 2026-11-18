import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { PlannerClient, type AvailabilityRow, type PrefRow } from './client'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export default async function PlannerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const [availability, prefs, subjects, scheduledCount] = await Promise.all([
    db.studyAvailability.findMany({
      where: { userId: user!.id },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    }),
    db.studyPreference.findUnique({ where: { userId: user!.id } }),
    db.subject.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            lessons: {
              where: {
                archivedAt: null,
                status: { not: 'COMPLETED' },
                sessions: { none: { status: 'SCHEDULED' } },
              },
            },
          },
        },
      },
    }),
    db.studySession.count({
      where: {
        userId: user!.id,
        status: 'SCHEDULED',
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ])

  // Weekday labels are interface strings — translated on the client.
  const availabilityRows: AvailabilityRow[] = availability.map((a) => ({
    id: a.id,
    weekday: a.weekday,
    startTime: a.startTime,
    endTime: a.endTime,
    dayKey: DAY_KEYS[a.weekday] ?? 'sunday',
  }))

  const prefRow: PrefRow = {
    maxDailyMinutes: prefs?.maxDailyMinutes ?? 180,
    preferredSessionMin: prefs?.preferredSessionMin ?? 45,
    breakMinutes: prefs?.breakMinutes ?? 10,
    remindBeforeMin: prefs?.remindBeforeMin ?? 15,
    pomodoroStudyMin: prefs?.pomodoroStudyMin ?? 25,
    pomodoroBreakMin: prefs?.pomodoroBreakMin ?? 5,
    pomodoroLongBreakMin: prefs?.pomodoroLongBreakMin ?? 15,
    pomodoroCycles: prefs?.pomodoroCycles ?? 4,
    notificationsEnabled: prefs?.notificationsEnabled ?? true,
    emailEnabled: prefs?.emailEnabled ?? false,
  }

  const subjectRows = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    priority: s.priority,
    importance: s.importance,
    examDate: s.examDate?.toISOString() ?? null,
    unscheduledLessons: s._count.lessons,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('planner.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('planner.subtitle')}</p>
      </div>

      <PlannerClient
        availability={availabilityRows}
        prefs={prefRow}
        subjects={subjectRows}
        scheduledCount={scheduledCount}
        locale={locale}
      />
    </div>
  )
}
