'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, type Locale } from '@/i18n/routing'

const LABELS: Record<Locale, string> = { ar: 'العربية', fr: 'Français', en: 'English' }

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('common')

  return (
    <div className="relative" title={t('language')}>
      <select
        aria-label={t('language')}
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
        className={`input h-10 cursor-pointer appearance-none ps-3 pe-8 font-medium ${
          compact ? 'w-auto text-xs' : 'w-auto text-sm'
        }`}
        style={{ backgroundImage: 'none' }}
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {LABELS[l]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-2.5 my-auto h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
