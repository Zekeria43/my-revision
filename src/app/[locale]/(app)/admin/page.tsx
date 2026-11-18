import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireAdmin } from '@/lib/auth/guards'
import { db } from '@/lib/db'
import { AdminClient, type AdminUserRow, type AuditRow } from './client'

export const dynamic = 'force-dynamic'

const USER_PAGE = 25

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  const admin = await requireAdmin()
  const t = await getTranslations()

  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status && sp.status !== 'all' ? sp.status : undefined

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
    ...(status ? { status: status as 'ACTIVE' } : {}),
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [users, total, counts, newThisMonth, auditRows, auditTotal, usage] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * USER_PAGE,
      take: USER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        locale: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { subjects: true, sessionsStudy: true, lessons: true } },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({ by: ['status'], _count: { _all: true } }),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        admin: { select: { name: true, email: true } },
        target: { select: { name: true, email: true } },
      },
    }),
    db.adminAuditLog.count(),
    Promise.all([
      db.subject.count(),
      db.lesson.count(),
      db.studySession.count(),
      db.exam.count(),
      db.note.count(),
      db.notification.count(),
    ]),
  ])

  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]))
  const totalUsers = counts.reduce((a, c) => a + c._count._all, 0)

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    locale: u.locale,
    verified: !!u.emailVerifiedAt,
    createdAt: u.createdAt.toISOString(),
    subjects: u._count.subjects,
    lessons: u._count.lessons,
    sessions: u._count.sessionsStudy,
    isSelf: u.id === admin.id,
  }))

  const audit: AuditRow[] = auditRows.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    adminName: a.admin.name,
    targetName: a.target?.name ?? null,
    meta: a.meta,
    createdAt: a.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('admin.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('admin.subtitle')}</p>
      </div>

      <AdminClient
        stats={{
          totalUsers,
          activeUsers: countByStatus.get('ACTIVE') ?? 0,
          pendingUsers: countByStatus.get('PENDING') ?? 0,
          suspendedUsers: countByStatus.get('SUSPENDED') ?? 0,
          newRegistrations: newThisMonth,
          students: rows.filter((r) => r.role === 'STUDENT').length,
          admins: rows.filter((r) => r.role === 'ADMIN').length,
          subjects: usage[0],
          lessons: usage[1],
          sessions: usage[2],
          exams: usage[3],
          notes: usage[4],
          notifications: usage[5],
        }}
        users={rows}
        pagination={{ page, hasMore: users.length === USER_PAGE, total }}
        audit={audit}
        auditTotal={auditTotal}
        filters={{ q, status: status ?? 'all' }}
        locale={locale}
      />
    </div>
  )
}
