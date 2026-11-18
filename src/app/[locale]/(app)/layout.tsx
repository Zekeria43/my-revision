import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { AppShell } from '@/components/app/shell'
import { OfflineBanner, InstallPrompt } from '@/components/pwa'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

/**
 * Authenticated application shell.
 *
 * Authorization happens HERE on the server — the client never supplies a user
 * id. A missing/expired session redirects to /login; a suspended account is
 * rejected by getCurrentUser() itself.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)
  if (user.status === 'PENDING') redirect(`/${locale}/verify-pending`)
  if (user.status === 'SUSPENDED') redirect(`/${locale}/login`)

  const unreadCount = await db.notification.count({
    where: { userId: user.id, readAt: null },
  })

  return (
    <>
      <OfflineBanner />
      <AppShell
        user={{ name: user.name, email: user.email, role: user.role }}
        unreadCount={unreadCount}
      >
        {children}
      </AppShell>
      <InstallPrompt />
    </>
  )
}
