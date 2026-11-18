'use client'

import { useTranslations } from 'next-intl'
import { CalendarDays, Clock } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface SessionLite {
  id: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: string
  priority: string
  subjectName: string
  subjectColor: string
  lessonTitle: string | null
}

export interface UpcomingLite {
  id: string
  date: Date
  startTime: string
  endTime: string
  status: string
  subjectName: string
  subjectColor: string
  lessonTitle: string | null
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'hsl(var(--primary))',
  COMPLETED: 'hsl(var(--success))',
  MISSED: 'hsl(var(--danger))',
  POSTPONED: 'hsl(var(--warning))',
  CANCELLED: 'hsl(var(--muted-foreground))',
}

export function DashboardSessions({
  sessions,
  upcoming,
  emptyLabel,
  seeAllLabel,
  locale,
}: {
  sessions: SessionLite[]
  upcoming: UpcomingLite[]
  emptyLabel: string
  seeAllLabel: string
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Today ── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <CalendarDays size={16} className="text-[hsl(var(--primary))]" />
              {t('dashboard.todayPlan')}
            </span>
          }
          action={
            <a href="/calendar" className="btn-ghost h-8 px-3 text-[13px]">
              {seeAllLabel}
            </a>
          }
        />

        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-[hsl(var(--surface))]"
              >
                <div className="w-16 shrink-0 text-center">
                  <p className="text-sm font-extrabold tabular-nums" dir="ltr">
                    {s.startTime}
                  </p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">→ {s.endTime}</p>
                </div>
                <span
                  className="h-10 w-1 shrink-0 rounded-full"
                  style={{ background: s.subjectColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.subjectName}</p>
                  {s.lessonTitle && (
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {s.lessonTitle}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge color={STATUS_COLOR[s.status]}>
                    {t(`calendar.status.${s.status}` as 'calendar.status.SCHEDULED')}
                  </Badge>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {s.durationMinutes} {t('common.minutes')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Upcoming ── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-[hsl(var(--accent))]" />
              {t('dashboard.upcomingSessions')}
            </span>
          }
          action={
            <a href="/calendar" className="btn-ghost h-8 px-3 text-[13px]">
              {seeAllLabel}
            </a>
          }
        />

        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title={t('calendar.noSessions')}
            description={t('planner.subtitle')}
            action={
              <a href="/planner" className="btn-primary h-9 text-[13px]">
                {t('planner.generate')}
              </a>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="w-20 shrink-0 text-center">
                  <p className="text-[11px] font-bold text-[hsl(var(--primary))]">
                    {fmt.monthDay(s.date)}
                  </p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {fmt.weekday(s.date, false)}
                  </p>
                </div>
                <span
                  className="h-10 w-1 shrink-0 rounded-full"
                  style={{ background: s.subjectColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.subjectName}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">
                    {s.startTime} – {s.endTime}
                  </p>
                </div>
                {s.lessonTitle && (
                  <span className="hidden max-w-32 truncate text-xs text-[hsl(var(--muted-foreground))] sm:block">
                    {s.lessonTitle}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
