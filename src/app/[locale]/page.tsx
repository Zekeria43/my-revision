import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { LandingSections } from '@/components/landing/sections'

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  return (
    <div className="flex min-h-screen flex-col">
      <Header t={t} locale={locale} />

      <main id="main" className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 start-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[hsl(var(--primary)/0.18)] blur-[120px]" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
                backgroundSize: '56px 56px',
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 75%)',
              }}
            />
          </div>

          <div className="container-app relative py-16 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="badge mx-auto mb-5 border bg-[hsl(var(--muted))]">
                {t('landing.trustedBy')}
              </span>
              <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                {t('landing.heroTitle')}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[hsl(var(--muted-foreground))] sm:text-lg">
                {t('landing.heroSubtitle')}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/register" className="btn-primary h-12 px-7 text-[15px]">
                  {t('landing.ctaRegister')}
                </Link>
                <Link href="/login" className="btn-outline h-12 px-7 text-[15px]">
                  {t('landing.ctaLogin')}
                </Link>
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="relative mx-auto mt-14 max-w-5xl">
              <div className="card overflow-hidden p-0 shadow-2xl">
                <div className="flex items-center gap-2 border-b bg-[hsl(var(--surface-muted))] px-4 py-2.5">
                  <span className="h-3 w-3 rounded-full bg-[hsl(var(--danger))]" />
                  <span className="h-3 w-3 rounded-full bg-[hsl(var(--warning))]" />
                  <span className="h-3 w-3 rounded-full bg-[hsl(var(--success))]" />
                  <span className="mx-auto text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {t('landing.previewTitle')}
                  </span>
                </div>
                <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[220px_1fr]">
                  <div className="hidden space-y-2 md:block">
                    {['nav.dashboard', 'nav.subjects', 'nav.calendar', 'nav.planner', 'nav.exams'].map((k) => (
                      <div
                        key={k}
                        className="rounded-lg px-3 py-2 text-[13px] text-[hsl(var(--muted-foreground))] first:bg-[hsl(var(--primary))] first:text-white"
                      >
                        {t(k as 'nav.dashboard')}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { v: '68%', c: 'hsl(var(--primary))' },
                        { v: '142', c: 'hsl(var(--success))' },
                        { v: '37', c: 'hsl(var(--accent))' },
                        { v: '12', c: 'hsl(var(--warning))' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl border bg-[hsl(var(--surface))] p-3">
                          <div className="text-xl font-extrabold" style={{ color: s.c }}>
                            {s.v}
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${[68, 84, 55, 30][i]}%`, background: s.c }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex h-32 items-end gap-1.5">
                      {[35, 58, 42, 76, 64, 88, 52, 70, 46, 92, 60, 78].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-md bg-gradient-to-t from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.4)]"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LandingSections />
      </main>

      <Footer t={t} locale={locale} />
    </div>
  )
}

function Header({ t, locale }: { t: (k: string) => string; locale: string }) {
  const items: { href: string; key: string }[] = [
    { href: '#features', key: 'nav.features' },
    { href: '#how', key: 'nav.howItWorks' },
    { href: '#about', key: 'nav.about' },
    { href: '#contact', key: 'nav.contact' },
  ]
  return (
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--background))]/85 backdrop-blur-lg">
      <div className="container-app flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold">
          <Logo size={36} className="rounded-xl shadow-sm" />
          <span className="text-[15px]">{t('brand.name')}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="main">
          {items.map((i) => (
            <a
              key={i.href}
              href={i.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              {t(i.key)}
            </a>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/login" className="btn-ghost hidden h-10 text-sm sm:inline-flex">
            {t('nav.login')}
          </Link>
          <Link href="/register" className="btn-primary h-10 text-sm">
            {t('nav.register')}
          </Link>
        </div>
      </div>
    </header>
  )
}

function Footer({ t, locale }: { t: (k: string) => string; locale: string }) {
  return (
    <footer className="border-t bg-[hsl(var(--surface))]">
      <div className="container-app grid gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 font-extrabold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.65)] text-white">
              م
            </span>
            {t('brand.name')}
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {t('landing.footerAbout')}
          </p>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </div>

        <FooterCol
          t={t}
          title={t('landing.footerProduct')}
          links={[
            { href: '#features', key: 'nav.features' },
            { href: '#how', key: 'nav.howItWorks' },
            { href: '/register', key: 'nav.register' },
          ]}
        />
        <FooterCol
          t={t}
          title={t('landing.footerLegal')}
          links={[
            { href: '#privacy', key: 'landing.footerPrivacy' },
            { href: '#terms', key: 'landing.footerTerms' },
            { href: '#contact', key: 'landing.footerContact' },
          ]}
        />
      </div>
      <div className="border-t">
        <div className="container-app flex flex-col items-center justify-between gap-2 py-5 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row">
          <span>
            © {new Date().getFullYear()} {t('brand.fullName')} — {t('common.allRights')}
          </span>
          <span>{t('landing.footerAboutUs')}</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  t,
  title,
  links,
}: {
  t: (k: string) => string
  title: string
  links: { href: string; key: string }[]
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-bold">{title}</h4>
      <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
        {links.map((l) => (
          <li key={l.href + l.key}>
            <a href={l.href} className="transition hover:text-[hsl(var(--foreground))]">
              {t(l.key)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
