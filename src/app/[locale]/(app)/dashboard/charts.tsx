'use client'

import { useTranslations } from 'next-intl'
import {
  CompletedOverTimeChart,
  PlannedVsActualChart,
  ProgressBySubjectChart,
  TimeDistributionChart,
  WeeklyActivityChart,
} from '@/components/charts'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { ChartLine } from 'lucide-react'

interface ChartsData {
  bySubject: { name: string; color: string; percent: number; completed: number; total: number }[]
  overTime: { date: string; completed: number }[]
  weeklyActivity: { day: string; minutes: number }[]
  plannedVsActual: { label: string; planned: number; actual: number }[]
  timeDistribution: { name: string; value: number; color: string }[]
}

export function DashboardCharts({ data, locale }: { data: ChartsData; locale: string }) {
  const t = useTranslations()

  const hasAny =
    data.bySubject.length > 0 ||
    data.weeklyActivity.some((w) => w.minutes > 0) ||
    data.timeDistribution.length > 0

  if (!hasAny) {
    return (
      <EmptyState
        icon={<ChartLine size={22} />}
        title={t('analytics.noData')}
        description={t('dashboard.emptyBody')}
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('dashboard.progressBySubject')} />
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
        <CardHeader title={t('dashboard.weeklyActivity')} />
        <WeeklyActivityChart data={data.weeklyActivity} label={t('common.minutes')} />
      </Card>

      <Card>
        <CardHeader title={t('dashboard.lessonsOverTime')} />
        {data.overTime.length ? (
          <CompletedOverTimeChart data={data.overTime} label={t('dashboard.completedLessons')} />
        ) : (
          <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {t('analytics.noData')}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title={t('dashboard.timeDistribution')} />
        <TimeDistributionChart data={data.timeDistribution} emptyLabel={t('analytics.noData')} />
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title={t('dashboard.plannedVsActual')} />
        <PlannedVsActualChart
          data={data.plannedVsActual}
          labels={{
            planned: t('analytics.plannedHours'),
            actual: t('analytics.actualHours'),
          }}
        />
      </Card>
    </div>
  )
}
