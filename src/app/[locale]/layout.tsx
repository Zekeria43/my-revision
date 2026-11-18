import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { isLocale } from '@/i18n/routing'

export function generateStaticParams() {
  return ['ar', 'fr', 'en'].map((locale) => ({ locale }))
}

/**
 * Locale segment layout. The <html>/<body> shell lives in the root layout
 * (src/app/layout.tsx) so routes outside this segment — /offline, /not-found —
 * still render correctly.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  return <>{children}</>
}
