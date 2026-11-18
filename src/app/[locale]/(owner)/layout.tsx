import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { OwnerShell } from '@/components/owner/shell'
import { getCurrentUser } from '@/lib/auth/session'

/**
 * Owner route group — completely separate from the student (app) group and
 * the admin panel. Authorization happens HERE on the server via requireOwner:
 * ADMIN → /admin, STUDENT/anonymous → /dashboard or /login.
 */
export default async function OwnerLayout({
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
  if (user.role !== 'OWNER') {
    redirect(user.role === 'ADMIN' ? `/${locale}/admin` : `/${locale}/dashboard`)
  }

  return (
    <OwnerShell user={{ name: user.name, email: user.email }}>
      {children}
    </OwnerShell>
  )
}
