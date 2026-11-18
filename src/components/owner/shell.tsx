'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, Link } from '@/i18n/navigation'
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/actions/auth'

/**
 * Owner shell — deliberately distinct from the student AppShell and the
 * admin panel: dark sidebar, gold/crown branding, /owner-only nav.
 */

export const OWNER_NAV_ITEMS: { href: string; key: string; icon: LucideIcon }[] = [
  { href: '/owner', key: 'owner.navOverview', icon: LayoutDashboard },
  { href: '/owner/users', key: 'owner.navUsers', icon: Users },
  { href: '/owner/emails', key: 'owner.navEmails', icon: Mail },
  { href: '/owner/settings', key: 'owner.navSettings', icon: Settings },
  { href: '/owner/audit', key: 'owner.navAudit', icon: Activity },
]

export function OwnerShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: { name: string; email: string }
}) {
  const t = useTranslations()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => setMobileOpen(false), [pathname])

  const isActive = (href: string) =>
    href === '/owner' ? pathname === '/owner' : pathname === href || pathname.startsWith(href + '/')

  const NavList = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="flex flex-col gap-0.5" aria-label={t('nav.menu')}>
      {OWNER_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              active
                ? 'bg-[#f59e0b]/15 text-[#fbbf24]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={17} className="shrink-0" />
            <span className="truncate">{t(item.key as 'owner.navOverview')}</span>
          </Link>
        )
      })}
      {mobile && <OwnerLogoutButton className="mt-2" />}
    </nav>
  )

  const OwnerLogoutButton = ({ className }: { className?: string }) => (
    <form action={logoutAction} className={className}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut size={17} className="shrink-0" />
        {t('nav.logout')}
      </button>
    </form>
  )

  const Brand = ({ compact = false }: { compact?: boolean }) => (
    <Link href="/owner" className="flex items-center gap-2.5">
      <Logo size={36} className="rounded-xl shadow-lg shadow-amber-500/20" />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-extrabold text-white">{t('owner.brand')}</span>
          <span className="block text-[10px] font-medium text-slate-400">{t('owner.brandSub')}</span>
        </span>
      )}
    </Link>
  )

  return (
    <div className="min-h-dvh bg-[hsl(var(--background))]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col bg-slate-950 p-4 lg:flex">
        <Brand />
        <div className="mt-6 flex-1">
          <NavList />
        </div>
        <div className="space-y-3 border-t border-white/10 pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400" dir="ltr">
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {mounted && <LanguageSwitcher compact />}
            {mounted && <ThemeToggle />}
          </div>
          <OwnerLogoutButton />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-slate-950 px-4 py-3 lg:hidden">
        <button
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
          onClick={() => setMobileOpen(true)}
          aria-label={t('nav.menu')}
        >
          <Menu size={20} />
        </button>
        <Brand compact />
        <span className="ms-auto flex items-center gap-1.5">
          {mounted && <ThemeToggle />}
        </span>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 start-0 flex w-72 flex-col bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex-1">
              <NavList mobile />
            </div>
            <div className="space-y-3 border-t border-white/10 pt-3">
              {mounted && <LanguageSwitcher compact />}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{user.name}</p>
                <p className="truncate text-[11px] text-slate-400" dir="ltr">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="px-4 py-5 sm:px-6 lg:ms-64 lg:px-8">{children}</main>
    </div>
  )
}
