'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import {
  BookOpen,
  CalendarDays,
  ChartLine,
  Clock,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Bell,
  History,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/actions/auth'

export interface NavItem {
  href: string
  key: string
  icon: LucideIcon
  admin?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/academic', key: 'nav.academic', icon: GraduationCap },
  { href: '/subjects', key: 'nav.subjects', icon: BookOpen },
  { href: '/calendar', key: 'nav.calendar', icon: CalendarDays },
  { href: '/planner', key: 'nav.planner', icon: Sparkles },
  { href: '/timer', key: 'nav.timer', icon: Clock },
  { href: '/exams', key: 'nav.exams', icon: FlaskConical },
  { href: '/notes', key: 'nav.notes', icon: FileText },
  { href: '/notifications', key: 'nav.notifications', icon: Bell },
  { href: '/analytics', key: 'nav.analytics', icon: ChartLine },
  { href: '/history', key: 'nav.history', icon: History },
  { href: '/settings', key: 'nav.settings', icon: Settings },
]

interface ShellProps {
  children: React.ReactNode
  user: {
    name: string
    email: string
    role: string
  }
  unreadCount: number
}

export function AppShell({ children, user, unreadCount }: ShellProps) {
  const t = useTranslations()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => setMobileOpen(false), [pathname])

  const items = NAV_ITEMS.filter((i) => !i.admin)
  const isAdmin = user.role === 'ADMIN'

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const NavList = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="flex flex-col gap-0.5" aria-label={t('nav.menu')}>
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href)
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
            )}
          >
            <Icon size={17} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{t(item.key as 'nav.dashboard')}</span>
            {item.href === '/notifications' && mounted && unreadCount > 0 && (
              <span
                className={cn(
                  'ms-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold',
                  active ? 'bg-white/25 text-white' : 'bg-[hsl(var(--danger))] text-white',
                )}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </a>
        )
      })}

      {isAdmin && (
        <a
          href="/admin"
          className={cn(
            'mt-2 flex items-center gap-3 rounded-xl border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.1)] px-3 py-2.5 text-sm font-semibold transition',
            isActive('/admin')
              ? 'bg-[hsl(var(--accent))] text-white'
              : 'text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.18)]',
          )}
        >
          <ShieldCheck size={17} className="shrink-0" />
          <span>{t('nav.admin')}</span>
        </a>
      )}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      {/* ── Desktop sidebar ── */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e bg-[hsl(var(--surface))] lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <Logo size={36} className="rounded-xl" />
          <span className="text-[15px] font-extrabold">{t('brand.name')}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </div>

        <div className="border-t p-3">
          <LogoutButton />
        </div>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e bg-[hsl(var(--surface))] animate-fade-in-up">
            <div className="flex h-16 items-center gap-2.5 border-b px-5">
              <Logo size={36} className="rounded-xl" />
              <span className="text-[15px] font-extrabold">{t('brand.name')}</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label={t('common.close')}
                className="ms-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-[hsl(var(--muted))]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList mobile />
            </div>
            <div className="border-t p-3">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-[hsl(var(--background))]/90 px-4 backdrop-blur-lg sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label={t('nav.menu')}
            className="grid h-10 w-10 place-items-center rounded-xl border lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold">{t('brand.name')}</p>
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
              {t('brand.tagline')}
            </p>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher compact />
            <ThemeToggle />
            <a
              href="/notifications"
              aria-label={t('nav.notifications')}
              className="relative grid h-10 w-10 place-items-center rounded-xl border transition hover:bg-[hsl(var(--muted))]"
            >
              <Bell size={17} />
              {mounted && unreadCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[hsl(var(--danger))] px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </a>
            <div className="hidden items-center gap-2.5 border-s ps-3 md:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--primary)/0.15)] text-sm font-bold text-[hsl(var(--primary))]">
                {user.name.trim().charAt(0).toUpperCase() || 'S'}
              </span>
              <span className="max-w-32 truncate text-sm font-semibold">{user.name}</span>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        {/* ── Mobile bottom nav ── */}
        <nav
          className="no-print sticky bottom-0 z-40 border-t bg-[hsl(var(--surface))]/95 backdrop-blur-lg lg:hidden"
          aria-label={t('nav.menu')}
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {items.slice(0, 4).map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition',
                    active
                      ? 'text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground))]',
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                  <span className="max-w-full truncate px-1">
                    {t(item.key as 'nav.dashboard')}
                  </span>
                </a>
              )
            })}
            <a
              href="/settings"
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition',
                isActive('/settings')
                  ? 'text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))]',
              )}
            >
              <Settings size={19} />
              <span className="truncate px-1">{t('nav.settings')}</span>
            </a>
          </div>
        </nav>
      </div>
    </div>
  )
}

function LogoutButton() {
  const t = useTranslations()
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--danger))]"
      >
        <LogOut size={17} />
        {t('nav.logout')}
      </button>
    </form>
  )
}
