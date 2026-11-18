'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Activity,
  Crown,
  Mail,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
} from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface OwnerOverviewProps {
  locale: string
  stats: {
    totalUsers: number
    activeUsers: number
    pendingUsers: number
    suspendedUsers: number
    admins: number
    students: number
    newUsers: number
    subjects: number
    lessons: number
    studySessions: number
    sessionsToday: number
    emailsSent: number
    emailsFailed: number
    emailsSkipped: number
    registrationOpen: boolean
    mailLimit: number
  }
  registrations: { day: string; count: number }[]
  recentEmails: { id: string; email: string; kind: string; status: string; createdAt: string }[]
  recentAudit: { id: string; action: string; entityType: string; createdAt: string }[]
  labels: Record<string, string>
}

const EMAIL_STATUS_COLOR: Record<string, string> = {
  SENT: 'hsl(var(--success))',
  FAILED: 'hsl(var(--danger))',
  SKIPPED: 'hsl(var(--warning))',
}

export function OwnerOverview({ stats, registrations, recentEmails, recentAudit, labels }: OwnerOverviewProps) {
  const t = useTranslations()
  const fmt = useDateFormat()

  const tiles = [
    { icon: Users, label: labels.totalUsers, value: stats.totalUsers, color: '#f59e0b' },
    { icon: UserCheck, label: labels.activeUsers, value: stats.activeUsers, color: 'hsl(var(--success))' },
    { icon: Mail, label: labels.pendingUsers, value: stats.pendingUsers, color: 'hsl(var(--warning))' },
    { icon: UserX, label: labels.suspendedUsers, value: stats.suspendedUsers, color: 'hsl(var(--danger))' },
    { icon: Crown, label: labels.admins, value: stats.admins, color: '#a855f7' },
    { icon: Users, label: labels.students, value: stats.students, color: 'hsl(var(--primary))' },
    { icon: Activity, label: labels.newUsers, value: stats.newUsers, color: '#06b6d4' },
    { icon: Activity, label: labels.sessionsToday, value: stats.sessionsToday, color: '#f97316' },
  ]

  const emailTiles = [
    { label: labels.emailsSent, value: stats.emailsSent, color: 'hsl(var(--success))' },
    { label: labels.emailsFailed, value: stats.emailsFailed, color: 'hsl(var(--danger))' },
    { label: labels.emailsSkipped, value: stats.emailsSkipped, color: 'hsl(var(--warning))' },
  ]

  const usage = [
    { label: labels.subjects, value: stats.subjects },
    { label: labels.lessons, value: stats.lessons },
    { label: labels.sessions, value: stats.studySessions },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <Crown className="text-[#f59e0b]" size={22} />
            {t('owner.title')}
          </h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t('owner.subtitle')}</p>
        </div>
        <Badge color={stats.registrationOpen ? 'hsl(var(--success))' : 'hsl(var(--danger))'}>
          {stats.registrationOpen ? labels.registrationOpen : labels.registrationClosed}
        </Badge>
      </div>

      {/* User tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {tiles.map((k) => {
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
                <span className="text-xl font-extrabold tabular-nums" style={{ color: k.color }}>
                  {k.value}
                </span>
              </div>
              <p className="mt-2.5 text-[11px] font-medium leading-tight text-[hsl(var(--muted-foreground))]">
                {k.label}
              </p>
            </Card>
          )
        })}
      </div>

      {/* Registrations chart */}
      <Card>
        <CardHeader title={labels.chartTitle} />
        <div className="h-56 w-full" dir="ltr">
          {registrations.every((r) => r.count === 0) ? (
            <div className="grid h-full place-items-center text-sm text-[hsl(var(--muted-foreground))]">
              {labels.chartEmpty}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrations} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#regGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Email quota monitor */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Mail size={16} className="text-[hsl(var(--primary))]" />
              {t('owner.emailMonitor')}
            </span>
          }
          description={labels.mailLimit}
        />
        <div className="grid grid-cols-3 gap-3">
          {emailTiles.map((u) => (
            <div key={u.label} className="rounded-xl border bg-[hsl(var(--surface))] p-3 text-center">
              <p className="text-lg font-extrabold tabular-nums" style={{ color: u.color }}>
                {u.value}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{u.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {usage.map((u) => (
            <div key={u.label} className="rounded-xl border bg-[hsl(var(--surface))] p-3 text-center">
              <p className="text-lg font-extrabold tabular-nums">{u.value}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{u.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent emails + audit */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center justify-between gap-2">
                {labels.recentEmails}
                <Link
                  href="/owner/emails"
                  className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline"
                >
                  {labels.viewAll}
                </Link>
              </span>
            }
          />
          {recentEmails.length === 0 ? (
            <EmptyState icon={<Mail size={22} />} title={t('owner.emailsEmpty')} />
          ) : (
            <ul className="space-y-2">
              {recentEmails.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5 rounded-xl border p-2.5">
                  <XCircle
                    size={15}
                    className="shrink-0"
                    style={{ color: EMAIL_STATUS_COLOR[e.status] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold" dir="ltr">
                      {e.email}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {e.kind} · {fmt.relative(e.createdAt)}
                    </p>
                  </div>
                  <Badge color={EMAIL_STATUS_COLOR[e.status]}>{e.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center justify-between gap-2">
                {labels.recentAudit}
                <Link
                  href="/owner/audit"
                  className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline"
                >
                  {labels.viewAll}
                </Link>
              </span>
            }
          />
          {recentAudit.length === 0 ? (
            <EmptyState icon={<Activity size={22} />} title={t('owner.auditEmpty')} />
          ) : (
            <ul className="space-y-2">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 rounded-xl border p-2.5">
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                      'bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]',
                    )}
                  >
                    <Activity size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{a.action}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {a.entityType} · {fmt.relative(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
