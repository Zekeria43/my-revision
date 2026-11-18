import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth/guards'
import { OwnerUsers, type OwnerUserRow } from './users-client'

export const dynamic = 'force-dynamic'

const PAGE = 25

export default async function OwnerUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)
  const owner = await requireOwner()
  const t = await getTranslations()

  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status && sp.status !== 'all' ? sp.status : undefined

  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    ...(status ? { status: status as 'ACTIVE' } : {}),
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE + 1,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        locale: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { subjects: true, lessons: true, sessionsStudy: true } },
      },
    }),
    db.user.count({ where }),
  ])

  const hasMore = users.length > PAGE
  const rows: OwnerUserRow[] = users.slice(0, PAGE).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    locale: u.locale,
    verified: u.emailVerifiedAt !== null,
    createdAt: u.createdAt.toISOString(),
    subjects: u._count.subjects,
    lessons: u._count.lessons,
    sessions: u._count.sessionsStudy,
    isSelf: u.id === owner.id,
    isOwner: u.role === 'OWNER',
  }))

  return (
    <OwnerUsers
      users={rows}
      pagination={{ page, hasMore, total }}
      filters={{ q, status: status ?? 'all' }}
      locale={locale}
      labels={{
        title: t('owner.title'),
        subtitle: t('owner.subtitle'),
        searchUsers: t('owner.searchUsers'),
        status: t('admin.status'),
        all: t('common.all'),
        users: t('admin.users'),
        noResults: t('common.noResults'),
        you: t('admin.you'),
        ownerBadge: t('owner.ownerBadge'),
        admins: t('owner.admins'),
        students: t('owner.students'),
        subjects: t('nav.subjects'),
        lessons: t('nav.lessons'),
        sessions: t('nav.calendar'),
        verified: t('owner.verified'),
        unverified: t('owner.unverified'),
        activate: t('admin.activate'),
        suspend: t('admin.suspend'),
        makeAdmin: t('admin.makeAdmin'),
        revokeAdmin: t('admin.revokeAdmin'),
        delete: t('common.delete'),
        activateConfirm: t('admin.activateConfirm'),
        suspendConfirm: t('admin.suspendConfirm'),
        adminConfirm: t('admin.adminConfirm'),
        deleteConfirmTitle: t('owner.deleteConfirmTitle'),
        deleteConfirmHelp: t('owner.deleteConfirmHelp'),
        deleteTypeEmail: t('owner.deleteTypeEmail'),
        cancel: t('common.cancel'),
        confirmDelete: t('owner.confirmDelete'),
        userUpdated: t('owner.userUpdated'),
        userDeleted: t('owner.userDeleted'),
        deleteMismatch: t('owner.deleteMismatch'),
        error: t('errors.serverErrorTitle'),
        prev: t('history.loadMore'),
        next: t('history.loadMore'),
      }}
    />
  )
}
