'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Activity, ShieldAlert } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'

export interface AuditEntry {
  id: string
  action: string
  entityType: string
  meta: string
  createdAt: string
  actorName: string
  actorEmail: string
  actorRole: string
  targetName: string | null
  targetEmail: string | null
}

export function OwnerAudit({
  audit,
  pagination,
}: {
  audit: AuditEntry[]
  pagination: { page: number; hasMore: boolean; total: number }
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Activity className="text-[#f59e0b]" size={22} />
          {t('owner.auditTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t('owner.auditSubtitle')}</p>
      </div>

      <Card>
        <CardHeader title={t('admin.auditLog')} description={String(pagination.total)} />
        {audit.length === 0 ? (
          <EmptyState icon={<ShieldAlert size={22} />} title={t('owner.auditEmpty')} />
        ) : (
          <ol className="space-y-2">
            {audit.map((a) => {
              let metaNote = ''
              try {
                const meta = JSON.parse(a.meta) as Record<string, unknown>
                const parts = Object.entries(meta)
                  .filter(([k]) => k !== 'email' && k !== 'name')
                  .slice(0, 3)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                metaNote = parts.join(' · ')
              } catch {
                metaNote = ''
              }
              return (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]">
                    <ShieldAlert size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{a.action}</p>
                      <Badge>{a.entityType}</Badge>
                    </div>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {a.actorName} ({a.actorRole})
                      {a.targetName ? ` → ${a.targetName}` : ''}
                      {metaNote ? ` — ${metaNote}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">
                    {fmt.relative(a.createdAt)}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Card>

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
