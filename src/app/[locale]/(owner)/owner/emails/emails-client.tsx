'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Clock, Mail, MinusCircle, XCircle } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, Select } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

interface LogRow {
  id: string
  email: string
  kind: string
  status: string
  error: string | null
  createdAt: string
}

const STATUS_COLOR: Record<string, string> = {
  SENT: 'hsl(var(--success))',
  FAILED: 'hsl(var(--danger))',
  SKIPPED: 'hsl(var(--warning))',
}

export function OwnerEmails({
  limit,
  totals,
  logs,
  quota,
  pagination,
  filters,
}: {
  limit: number
  totals: { sent: number; failed: number; skipped: number }
  logs: LogRow[]
  quota: { email: string; used: number; windowStart: string }[]
  pagination: { page: number; hasMore: boolean; total: number }
  filters: { status: string; kind: string }
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') params.delete(k)
      else params.set(k, v)
    }
    if (!('page' in patch)) params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const statusIcon = (s: string) => {
    const cls = 'shrink-0'
    if (s === 'SENT') return <CheckCircle2 size={15} className={cn(cls, 'text-[hsl(var(--success))]')} />
    if (s === 'FAILED') return <XCircle size={15} className={cn(cls, 'text-[hsl(var(--danger))]')} />
    return <MinusCircle size={15} className={cn(cls, 'text-[hsl(var(--warning))]')} />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Mail className="text-[#f59e0b]" size={22} />
          {t('owner.emailsTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t('owner.subtitle')}</p>
      </div>

      {/* Totals */}
      <Card>
        <CardHeader title={t('owner.emailMonitor')} description={t('owner.mailLimit', { limit })} />
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('owner.emailsSent'), value: totals.sent, color: 'hsl(var(--success))' },
            { label: t('owner.emailsFailed'), value: totals.failed, color: 'hsl(var(--danger))' },
            { label: t('owner.emailsSkipped'), value: totals.skipped, color: 'hsl(var(--warning))' },
          ].map((u) => (
            <div key={u.label} className="rounded-xl border bg-[hsl(var(--surface))] p-3 text-center">
              <p className="text-lg font-extrabold tabular-nums" style={{ color: u.color }}>
                {u.value}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{u.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Quota counters (live 24h windows) */}
      <Card>
        <CardHeader title={t('owner.quotaTitle')} />
        {quota.length === 0 ? (
          <EmptyState icon={<Clock size={22} />} title={t('owner.emailsEmpty')} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {quota.map((q) => (
              <div key={q.email} className="flex items-center gap-3 rounded-xl border p-2.5">
                <Clock size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold" dir="ltr">
                    {q.email}
                  </p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {fmt.relative(q.windowStart)}
                  </p>
                </div>
                <Badge color={q.used >= limit ? 'hsl(var(--danger))' : 'hsl(var(--primary))'}>
                  {t('owner.quotaUsed', { used: q.used, limit })}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-3.5">
        <Select
          value={filters.status}
          onChange={(e) => navigate({ status: e.target.value })}
          className="w-auto min-w-36"
          aria-label={t('admin.status')}
        >
          <option value="all">{t('admin.status')}: {t('common.all')}</option>
          <option value="SENT">SENT</option>
          <option value="FAILED">FAILED</option>
          <option value="SKIPPED">SKIPPED</option>
        </Select>
        <Select
          value={filters.kind}
          onChange={(e) => navigate({ kind: e.target.value })}
          className="w-auto min-w-36"
          aria-label={t('owner.kind')}
        >
          <option value="all">{t('owner.kind')}: {t('common.all')}</option>
          <option value="VERIFY">VERIFY</option>
          <option value="RESEND">RESEND</option>
          <option value="RESET">RESET</option>
          <option value="SECURITY">SECURITY</option>
        </Select>
        <span className="ms-auto text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {pagination.total}
        </span>
      </Card>

      {/* Log rows */}
      {logs.length === 0 ? (
        <EmptyState icon={<Mail size={22} />} title={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <Card key={l.id} className="flex items-center gap-2.5 p-3">
              {statusIcon(l.status)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold" dir="ltr">
                  {l.email}
                </p>
                {l.error && (
                  <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]" dir="ltr">
                    {l.error}
                  </p>
                )}
              </div>
              <Badge>{l.kind}</Badge>
              <Badge color={STATUS_COLOR[l.status]}>{l.status}</Badge>
              <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">
                {fmt.relative(l.createdAt)}
              </span>
            </Card>
          ))}
        </div>
      )}

      {(pagination.page > 1 || pagination.hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <button
            className="btn-outline"
            disabled={pagination.page <= 1}
            onClick={() => navigate({ page: String(pagination.page - 1) })}
          >
            {t('history.loadMore')}
          </button>
          <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">{pagination.page}</span>
          <button
            className="btn-outline"
            disabled={!pagination.hasMore}
            onClick={() => navigate({ page: String(pagination.page + 1) })}
          >
            {t('history.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}
