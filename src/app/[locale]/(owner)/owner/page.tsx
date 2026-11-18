import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth/guards'
import { emailDailyLimit } from '@/lib/email-quota'
import { registrationOpen } from '@/lib/platform-settings'
import { OwnerOverview, type OwnerOverviewProps } from './overview-client'

export const dynamic = 'force-dynamic'

export default async function OwnerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireOwner()
  const t = await getTranslations()

  const now = Date.now()
  const dayMs = 86_400_000
  const since = new Date(now - 29 * dayMs)
  const todayStart = new Date(new Date().toISOString().slice(0, 10))

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    suspendedUsers,
    admins,
    students,
    newUsers,
    subjects,
    lessons,
    studySessions,
    sessionsToday,
    emailsSent,
    emailsFailed,
    emailsSkipped,
    regOpen,
    mailLimit,
    dailyRows,
    recentEmails,
    recentAudit,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { status: 'PENDING' } }),
    db.user.count({ where: { status: 'SUSPENDED' } }),
    db.user.count({ where: { role: 'ADMIN' } }),
    db.user.count({ where: { role: 'STUDENT' } }),
    db.user.count({ where: { createdAt: { gte: new Date(now - 7 * dayMs) } } }),
    db.subject.count(),
    db.lesson.count(),
    db.studySession.count(),
    db.studySession.count({ where: { date: { gte: todayStart } } }),
    db.emailLog.count({ where: { status: 'SENT' } }),
    db.emailLog.count({ where: { status: 'FAILED' } }),
    db.emailLog.count({ where: { status: 'SKIPPED' } }),
    registrationOpen(),
    emailDailyLimit(),
    // Registrations per day, last 30 days (SQLite: group by date string).
    db.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, email: true, kind: true, status: true, createdAt: true },
    }),
    db.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, action: true, entityType: true, createdAt: true },
    }),
  ])

  // Bucket registrations per day (keyed YYYY-MM-DD).
  const buckets = new Map<string, number>()
  for (const row of dailyRows) {
    const key = row.createdAt.toISOString().slice(0, 10)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const registrations: OwnerOverviewProps['registrations'] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * dayMs)
    const key = d.toISOString().slice(0, 10)
    registrations.push({ day: key.slice(5), count: buckets.get(key) ?? 0 })
  }

  return (
    <OwnerOverview
      locale={locale}
      stats={{
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        admins,
        students,
        newUsers,
        subjects,
        lessons,
        studySessions,
        sessionsToday,
        emailsSent,
        emailsFailed,
        emailsSkipped,
        registrationOpen: regOpen,
        mailLimit,
      }}
      registrations={registrations}
      recentEmails={recentEmails.map((e) => ({
        id: e.id,
        email: e.email,
        kind: e.kind,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }))}
      recentAudit={recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        createdAt: a.createdAt.toISOString(),
      }))}
      labels={{
        totalUsers: t('owner.totalUsers'),
        activeUsers: t('owner.activeUsers'),
        pendingUsers: t('owner.pendingUsers'),
        suspendedUsers: t('owner.suspendedUsers'),
        admins: t('owner.admins'),
        students: t('owner.students'),
        newUsers: t('owner.newUsers'),
        subjects: t('nav.subjects'),
        lessons: t('nav.lessons'),
        sessions: t('nav.calendar'),
        sessionsToday: t('owner.sessionsToday'),
        emailsSent: t('owner.emailsSent'),
        emailsFailed: t('owner.emailsFailed'),
        emailsSkipped: t('owner.emailsSkipped'),
        registrationOpen: t('owner.regOpen'),
        registrationClosed: t('owner.regClosed'),
        mailLimit: t('owner.mailLimit', { limit: mailLimit }),
        chartTitle: t('owner.chartTitle'),
        chartEmpty: t('owner.chartEmpty'),
        recentEmails: t('owner.recentEmails'),
        recentAudit: t('owner.recentAudit'),
        viewAll: t('owner.viewAll'),
      }}
    />
  )
}
