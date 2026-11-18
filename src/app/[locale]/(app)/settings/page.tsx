import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { SettingsClient, type SessionRow } from './client'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)
  const t = await getTranslations()

  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    take: 20,
  })

  const currentToken = await (async () => {
    const { cookies } = await import('next/headers')
    const { hashToken } = await import('@/lib/auth/session')
    const store = await cookies()
    const token = store.get('mv_session')?.value
    return token ? hashToken(token) : null
  })()

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    isCurrent: s.tokenHash === currentToken,
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('settings.subtitle')}</p>
      </div>

      <SettingsClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        }}
        profile={{
          school: user.profile?.school ?? '',
          program: user.profile?.program ?? '',
          timezone: user.profile?.timezone ?? '',
          bio: user.profile?.bio ?? '',
          country: user.profile?.country ?? '',
          city: user.profile?.city ?? '',
          academicLevel: user.profile?.academicLevel ?? '',
          academicYear: user.profile?.academicYear ?? '',
          preferredLanguage: user.profile?.preferredLanguage ?? '',
        }}
        prefs={{
          language: locale,
          notificationsEnabled: user.prefs?.notificationsEnabled ?? true,
          emailEnabled: user.prefs?.emailEnabled ?? false,
        }}
        sessions={sessionRows}
        locale={locale}
      />
    </div>
  )
}
