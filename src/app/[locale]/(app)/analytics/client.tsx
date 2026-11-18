'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CalendarCheck,
  CalendarX,
  Download,
  FileText,
  Flame,
  Printer,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react'
import {
  CompletedOverTimeChart,
  PlannedVsActualChart,
  ProgressBySubjectChart,
  TimeDistributionChart,
  WeeklyActivityChart,
} from '@/components/charts'
import { Badge, Button, Card, CardHeader, EmptyState, Select, Tabs } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

interface AnalyticsPayload {
  range: string
  totals: {
    studyMinutes: number
    sessions: number
    completedSessions: number
    missedSessions: number
    cancelledSessions: number
    lessonsCompleted: number
    lessonsTotal: number
    daysStudied: number
    activeDays: number
  }
  kpis: {
    totalStudyTime: number
    avgDaily: number
    consistency: number
    missedRate: number
    streak: number
  }
  bySubject: { name: string; color: string; percent: number; completed: number; total: number; minutes: number }[]
  overTime: { date: string; completed: number }[]
  weekly: { day: string; minutes: number }[]
  plannedVsActual: { label: string; planned: number; actual: number }[]
  distribution: { name: string; value: number; color: string }[]
  topDays: { date: string; minutes: number; sessions: number }[]
}

const RANGES = ['7d', '30d', '90d', 'year'] as const

export function AnalyticsClient({
  data,
  subjects,
  range,
  subjectFilter,
  locale,
}: {
  data: AnalyticsPayload
  subjects: { id: string; name: string; color: string }[]
  range: string
  subjectFilter: string
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const router = useRouter()
  const [exporting, setExporting] = useState(false)

  const navigate = (nextRange: string, nextSubject: string) => {
    const params = new URLSearchParams()
    if (nextRange !== '30d') params.set('range', nextRange)
    if (nextSubject !== 'all') params.set('subject', nextSubject)
    const qs = params.toString()
    router.push(`/${locale}/analytics${qs ? `?${qs}` : ''}`)
  }

  const hasData =
    data.totals.sessions > 0 || data.totals.lessonsTotal > 0 || data.bySubject.length > 0

  const hours = (m: number) =>
    m >= 60 ? `${(m / 60).toFixed(m % 60 === 0 ? 0 : 1)}` : (m / 60).toFixed(1)

  const kpis = [
    {
      icon: Timer,
      label: t('analytics.totalStudyTime'),
      value: `${hours(data.kpis.totalStudyTime)}`,
      sub: t('common.hours'),
      color: 'hsl(var(--primary))',
    },
    {
      icon: TrendingUp,
      label: t('analytics.avgDaily'),
      value: `${(data.kpis.avgDaily / 60).toFixed(1)}`,
      sub: t('common.hours'),
      color: 'hsl(var(--accent))',
    },
    {
      icon: Target,
      label: t('analytics.consistency'),
      value: `${data.kpis.consistency}%`,
      color: 'hsl(var(--success))',
    },
    {
      icon: CalendarX,
      label: t('analytics.missedRate'),
      value: `${data.kpis.missedRate}%`,
      color: 'hsl(var(--danger))',
    },
    {
      icon: Flame,
      label: t('analytics.streak'),
      value: `${data.kpis.streak}`,
      sub: t('common.days'),
      color: '#f97316',
    },
    {
      icon: CalendarCheck,
      label: t('analytics.daysStudied'),
      value: `${data.totals.daysStudied}/${data.totals.activeDays}`,
      color: '#06b6d4',
    },
    {
      icon: CalendarCheck,
      label: t('analytics.lessonsCompleted'),
      value: `${data.totals.lessonsCompleted}`,
      color: 'hsl(var(--success))',
    },
    {
      icon: CalendarX,
      label: t('analytics.lessonsMissed'),
      value: `${data.totals.missedSessions}`,
      color: 'hsl(var(--danger))',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={range}
          onChange={(v) => navigate(v, subjectFilter)}
          tabs={RANGES.map((r) => ({ id: r, label: t(`analytics.filterRange`) + ` · ${rangeLabel(r, t)}` }))}
          className="flex-1"
        />

        <Select
          value={subjectFilter}
          onChange={(e) => navigate(range, e.target.value)}
          className="w-auto min-w-44"
          aria-label={t('analytics.filterSubject')}
        >
          <option value="all">{t('analytics.filterSubject')}: {t('common.all')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <div className="flex gap-2">
          <a
            href={`/api/export/csv?type=analytics&range=${range}${subjectFilter !== 'all' ? `&subject=${subjectFilter}` : ''}`}
            className="btn-outline h-10"
            onClick={() => setExporting(true)}
          >
            <Download size={15} /> {t('analytics.exportCsv')}
          </a>
          <a
            href={`/${locale}/report?range=${range}${subjectFilter !== 'all' ? `&subject=${subjectFilter}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary h-10"
          >
            <Printer size={15} /> {t('analytics.exportPdf')}
          </a>
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={<TrendingUp size={22} />}
          title={t('analytics.noData')}
          description={t('dashboard.emptyBody')}
          action={
            <a href="/subjects" className="btn-primary">
              {t('dashboard.emptyCta')}
            </a>
          }
        />
      ) : (
        <>
          {/* ── KPI tiles ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon
              return (
                <Card key={k.label} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${k.color}1f`, color: k.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <span
                      className="text-xl font-extrabold tabular-nums"
                      style={{ color: k.color }}
                    >
                      {k.value}
                      {k.sub && (
                        <span className="ms-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                          {k.sub}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[11px] font-medium leading-tight text-[hsl(var(--muted-foreground))]">
                    {k.label}
                  </p>
                </Card>
              )
            })}
          </div>

          {/* ── Charts ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('analytics.bySubject')} />
              {data.bySubject.length ? (
                <ProgressBySubjectChart
                  data={data.bySubject}
                  labels={{ completed: t('common.completed'), total: t('common.total') }}
                />
              ) : (
                <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  {t('analytics.noData')}
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title={t('analytics.weeklyActivity')} />
              <WeeklyActivityChart data={data.weekly} label={t('common.minutes')} />
            </Card>

            <Card>
              <CardHeader title={t('analytics.completedOverTime')} />
              <CompletedOverTimeChart data={data.overTime} label={t('analytics.lessonsCompleted')} />
            </Card>

            <Card>
              <CardHeader title={t('analytics.studyDistribution')} />
              <TimeDistributionChart data={data.distribution} emptyLabel={t('analytics.noData')} />
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title={t('analytics.plannedVsActual')} />
              <PlannedVsActualChart
                data={data.plannedVsActual}
                labels={{
                  planned: t('analytics.plannedHours'),
                  actual: t('analytics.actualHours'),
                }}
              />
            </Card>
          </div>

          {/* ── Top days ── */}
          {data.topDays.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Flame size={16} className="text-[hsl(var(--warning))]" />
                    {t('analytics.streak')}
                  </span>
                }
              />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {data.topDays.map((d, i) => (
                  <div
                    key={d.date}
                    className="flex items-center gap-3 rounded-xl border bg-[hsl(var(--surface))] p-3"
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold',
                        i === 0
                          ? 'bg-[hsl(var(--warning))] text-white'
                          : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{fmt.date(d.date)}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {d.sessions} {t('calendar.scheduledSessions')}
                      </p>
                    </div>
                    <Badge color="hsl(var(--primary))">
                      {(d.minutes / 60).toFixed(d.minutes % 60 === 0 ? 0 : 1)} {t('common.hours')}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <FileText size={13} />
            {t('analytics.subtitle')}
            {exporting ? ' …' : ''}
          </p>
        </>
      )}
    </div>
  )
}

function rangeLabel(r: string, t: (k: string) => string): string {
  switch (r) {
    case '7d':
      return '7'
    case '30d':
      return '30'
    case '90d':
      return '90'
    default:
      return t('common.year')
  }
}
