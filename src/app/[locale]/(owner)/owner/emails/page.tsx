import { setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth/guards'
import { emailDailyLimit } from '@/lib/email-quota'
import { OwnerEmails } from './emails-client'

export const dynamic = 'force-dynamic'

const PAGE = 30

export default async function OwnerEmailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ status?: string; kind?: string; page?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)
  await requireOwner()

  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const status = sp.status && sp.status !== 'all' ? sp.status : undefined
  const kind = sp.kind && sp.kind !== 'all' ? sp.kind : undefined

  const where = {
    ...(status ? { status: status as 'SENT' } : {}),
    ...(kind ? { kind: kind as 'VERIFY' } : {}),
  }

  const [logs, total, quotaRows, sentCount, failedCount, skippedCount, limit] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE + 1,
      select: { id: true, email: true, kind: true, status: true, error: true, createdAt: true },
    }),
    db.emailLog.count({ where }),
    db.emailQuota.findMany({ orderBy: { windowStart: 'desc' }, take: 50 }),
    db.emailLog.count({ where: { status: 'SENT' } }),
    db.emailLog.count({ where: { status: 'FAILED' } }),
    db.emailLog.count({ where: { status: 'SKIPPED' } }),
    emailDailyLimit(),
  ])

  const hasMore = logs.length > PAGE

  return (
    <OwnerEmails
      limit={limit}
      totals={{ sent: sentCount, failed: failedCount, skipped: skippedCount }}
      logs={logs.slice(0, PAGE).map((l) => ({
        id: l.id,
        email: l.email,
        kind: l.kind,
        status: l.status,
        error: l.error,
        createdAt: l.createdAt.toISOString(),
      }))}
      quota={quotaRows.map((q) => ({
        email: q.email,
        used: q.used,
        windowStart: q.windowStart.toISOString(),
      }))}
      pagination={{ page, hasMore, total }}
      filters={{ status: status ?? 'all', kind: kind ?? 'all' }}
    />
  )
}
