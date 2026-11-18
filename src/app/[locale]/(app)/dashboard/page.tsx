import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import {
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FlaskConical,
  GraduationCap,
  Hourglass,
  Percent,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { getDashboardData } from '@/lib/dashboard'
import { db } from '@/lib/db'
import { Badge, Card, CardHeader, EmptyState, Progress, ProgressRing } from '@/components/ui'
import { DashboardCharts } from './charts'
import { DashboardSessions } from './sessions'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)

  const t = await getTranslations()
  const data = await getDashboardData(user.id, locale)

  if (data.isEmpty) {
    return (
      <div className="animate-fade-in">
        <PageHeading t={t} />
        <EmptyState
          icon={<GraduationCap size={22} />}
          title={t('dashboard.emptyTitle')}
          description={t('dashboard.emptyBody')}
          action={
            <a href="/subjects" className="btn-primary">
              {t('dashboard.emptyCta')}
            </a>
          }
          className="mt-6"
        />
      </div>
    )
  }

  const p = data.progress
  const hours = (m: number) => (m / 60).toFixed(m % 60 === 0 ? 0 : 1)

  const tiles = [
    {
      icon: BookOpen,
      label: t('dashboard.subjectsCount'),
      value: String(data.subjectCount),
      color: 'hsl(var(--primary))',
    },
    {
      icon: CalendarCheck,
      label: t('dashboard.completedLessons'),
      value: `${p.completed}`,
      sub: `${p.percent}%`,
      color: 'hsl(var(--success))',
    },
    {
      icon: Hourglass,
      label: t('dashboard.remainingLessons'),
      value: `${p.remaining}`,
      color: 'hsl(var(--warning))',
    },
    {
      icon: TrendingUp,
      label: t('dashboard.inProgressLessons'),
      value: `${p.inProgress}`,
      color: 'hsl(var(--accent))',
    },
    {
      icon: Zap,
      label: t('dashboard.revisionLessons'),
      value: `${p.needsRevision}`,
      color: '#a855f7',
    },
    {
      icon: CalendarX,
      label: t('dashboard.missedSessions'),
      value: `${data.missedCount}`,
      color: 'hsl(var(--danger))',
    },
    {
      icon: CalendarClock,
      label: t('dashboard.weeklyHours'),
      value: hours(data.weeklyMinutes),
      sub: t('common.hours'),
      color: '#06b6d4',
    },
    {
      icon: Percent,
      label: t('dashboard.overallProgress'),
      value: `${p.percent}%`,
      color: 'hsl(var(--primary))',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeading t={t} />

      {/* ── Greeting + progress ring ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-[hsl(var(--primary)/0.14)] blur-3xl"
          />
          <div className="relative flex flex-wrap items-center gap-6">
            <ProgressRing value={p.percent} size={132}>
              <div>
                <div className="text-2xl font-extrabold tabular-nums">{p.percent}%</div>
                <div className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                  {t('dashboard.overallProgress')}
                </div>
              </div>
            </ProgressRing>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">
                {t('dashboard.welcome', { name: user.name })}
              </h2>
              <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                {t('dashboard.subtitle')}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {data.currentYear && (
                  <Badge color="hsl(var(--primary))">
                    <GraduationCap size={12} /> {data.currentYear.name}
                  </Badge>
                )}
                {data.currentSemester && (
                  <Badge color="hsl(var(--accent))">{data.currentSemester.name}</Badge>
                )}
                <Badge>
                  {p.completed} / {p.total} {t('dashboard.completedLessons')}
                </Badge>
              </div>

              <div className="mt-4">
                <Progress value={p.percent} showLabel />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Upcoming exams ── */}
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <FlaskConical size={16} className="text-[hsl(var(--accent))]" />
                {t('dashboard.upcomingExams')}
              </span>
            }
            className="mb-3"
          />
          {data.upcomingExams.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t('exams.empty')}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.upcomingExams.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  <span
                    className="h-9 w-1.5 shrink-0 rounded-full"
                    style={{ background: e.subjectColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {e.subjectName}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs font-bold tabular-nums">
                      {e.daysLeft <= 0
                        ? t('exams.today')
                        : e.daysLeft === 1
                          ? t('exams.tomorrow')
                          : t('exams.daysLeft', { n: e.daysLeft })}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr-FR' : 'en-GB', {
                        month: 'short',
                        day: 'numeric',
                      }).format(e.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Card key={tile.label} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: `${tile.color}1f`, color: tile.color }}
                >
                  <Icon size={16} />
                </span>
                <span
                  className="text-xl font-extrabold tabular-nums"
                  style={{ color: tile.color }}
                >
                  {tile.value}
                  {tile.sub && (
                    <span className="ms-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                      {tile.sub}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-2.5 text-[11px] font-medium leading-tight text-[hsl(var(--muted-foreground))]">
                {tile.label}
              </p>
            </Card>
          )
        })}
      </div>

      {/* ── Today's sessions ── */}
      <DashboardSessions
        sessions={data.todaySessions}
        upcoming={data.upcomingSessions}
        emptyLabel={t('dashboard.sessionsTodayNone')}
        seeAllLabel={t('dashboard.seeAll')}
        locale={locale}
      />

      {/* ── Charts ── */}
      <DashboardCharts data={data.charts} locale={locale} />
    </div>
  )
}

function PageHeading({ t }: { t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">{t('dashboard.title')}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {t('dashboard.subtitle')}
      </p>
    </div>
  )
}
