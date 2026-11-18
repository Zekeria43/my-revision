import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { HistoryClient, type HistoryRow } from './client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 60

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ entity?: string; action?: string; page?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const entity = sp.entity && sp.entity !== 'all' ? sp.entity : undefined
  const action = sp.action && sp.action !== 'all' ? sp.action : undefined

  const where = {
    userId: user!.id,
    ...(entity ? { entityType: entity } : {}),
    ...(action ? { action } : {}),
  }

  const [rows, total, entityTypes, actionTypes] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1, // one extra → hasMore
    }),
    db.activityLog.count({ where }),
    db.activityLog.groupBy({ by: ['entityType'], where: { userId: user!.id } }),
    db.activityLog.groupBy({ by: ['action'], where: { userId: user!.id } }),
  ])

  const hasMore = rows.length > PAGE_SIZE
  const pageRows = rows.slice(0, PAGE_SIZE)

  const items: HistoryRow[] = pageRows.map((r) => {
    let meta: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(r.meta) as unknown
      if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>
    } catch {
      meta = {}
    }
    return {
      id: r.id,
      entityType: r.entityType,
      action: r.action,
      entityId: r.entityId,
      meta,
      createdAt: r.createdAt.toISOString(),
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('history.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('history.subtitle')}</p>
      </div>

      <HistoryClient
        items={items}
        page={page}
        hasMore={hasMore}
        total={total}
        filters={{
          entity: entity ?? 'all',
          action: action ?? 'all',
          entityOptions: entityTypes
            .map((e) => e.entityType)
            .sort(),
          actionOptions: actionTypes.map((a) => a.action).sort(),
        }}
        locale={locale}
      />
    </div>
  )
}
