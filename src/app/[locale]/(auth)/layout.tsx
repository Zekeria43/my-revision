import type { ReactNode } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container-app flex h-16 items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold">
            <Logo size={36} className="rounded-xl" />
            <span className="text-[15px]">{t('brand.name')}</span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t py-5 text-center text-xs text-[hsl(var(--muted-foreground))]">
        © {new Date().getFullYear()} {t('brand.fullName')} — {t('common.allRights')}
      </footer>
    </div>
  )
}
