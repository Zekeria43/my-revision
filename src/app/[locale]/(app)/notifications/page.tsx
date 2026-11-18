import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { NotificationsClient, type NotificationRow } from './client'

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const [notifications, prefs, unreadCount, stats] = await Promise.all([
    db.notification.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.studyPreference.findUnique({ where: { userId: user!.id } }),
    db.notification.count({ where: { userId: user!.id, readAt: null } }),
    db.notification.groupBy({
      by: ['type'],
      where: { userId: user!.id, readAt: null },
      _count: { _all: true },
    }),
  ])

  const rows: NotificationRow[] = notifications.map((n) => {
    let params: Record<string, string | number> = {}
    try {
      const parsed = JSON.parse(n.params) as unknown
      if (parsed && typeof parsed === 'object') params = parsed as Record<string, string | number>
    } catch {
      params = {}
    }
    return {
      id: n.id,
      type: n.type,
      titleKey: n.titleKey,
      bodyKey: n.bodyKey,
      params,
      link: n.link,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('notifications.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {unreadCount > 0
            ? t('notifications.unread', { n: unreadCount })
            : t('notifications.empty')}
        </p>
      </div>

      <NotificationsClient
        notifications={rows}
        unreadCount={unreadCount}
        byType={stats.map((s) => ({ type: s.type, count: s._count._all }))}
        prefs={{
          notificationsEnabled: prefs?.notificationsEnabled ?? true,
          emailEnabled: prefs?.emailEnabled ?? false,
          remindBeforeMin: prefs?.remindBeforeMin ?? 15,
        }}
        locale={locale}
      />
    </div>
  )
}
