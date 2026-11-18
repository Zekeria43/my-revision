import { defineRouting } from 'next-intl/routing'

export const locales = ['ar', 'fr', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ar'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v)
}
