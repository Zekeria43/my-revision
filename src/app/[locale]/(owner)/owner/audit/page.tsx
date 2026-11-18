import { setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth/guards'
import { OwnerAudit } from './audit-client'

export const dynamic = 'force-dynamic'

const PAGE = 40

export default async function OwnerAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)
  await requireOwner()

  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const [rows, total] = await Promise.all([
    db.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE + 1,
      select: {
        id: true,
        action: true,
        entityType: true,
        meta: true,
        createdAt: true,
        admin: { select: { name: true, email: true, role: true } },
        target: { select: { name: true, email: true } },
      },
    }),
    db.adminAuditLog.count(),
  ])

  return (
    <OwnerAudit
      audit={rows.slice(0, PAGE).map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        meta: a.meta,
        createdAt: a.createdAt.toISOString(),
        actorName: a.admin.name,
        actorEmail: a.admin.email,
        actorRole: a.admin.role,
        targetName: a.target?.name ?? null,
        targetEmail: a.target?.email ?? null,
      }))}
      pagination={{ page, hasMore: rows.length > PAGE, total }}
    />
  )
}
