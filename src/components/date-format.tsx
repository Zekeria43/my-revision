'use client'

import { useLocale } from 'next-intl'

const LOCALE_TAGS: Record<string, string> = { ar: 'ar', fr: 'fr-FR', en: 'en-GB' }

/** Locale-aware date formatting. Never applied to user-authored text. */
export function useDateFormat() {
  const locale = useLocale()
  const tag = LOCALE_TAGS[locale] ?? 'en-GB'

  const date = (d: Date | string, opts?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, opts ?? { year: 'numeric', month: 'short', day: 'numeric' }).format(
      typeof d === 'string' ? new Date(d) : d,
    )

  const time = (d: Date | string) =>
    new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }).format(
      typeof d === 'string' ? new Date(d) : d,
    )

  const weekday = (d: Date | string, long = true) =>
    new Intl.DateTimeFormat(tag, { weekday: long ? 'long' : 'short' }).format(
      typeof d === 'string' ? new Date(d) : d,
    )

  const monthDay = (d: Date | string) =>
    new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric' }).format(
      typeof d === 'string' ? new Date(d) : d,
    )

  const relative = (d: Date | string) => {
    const x = typeof d === 'string' ? new Date(d) : d
    const diff = Date.now() - x.getTime()
    const mins = Math.round(diff / 60000)
    if (mins < 1) return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(0, 'minute')
    if (mins < 60) return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(-mins, 'minute')
    const hours = Math.round(mins / 60)
    if (hours < 24) return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(-hours, 'hour')
    const days = Math.round(hours / 24)
    if (days < 30) return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(-days, 'day')
    return date(x)
  }

  const duration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
  }

  return { date, time, weekday, monthDay, relative, duration, tag, locale }
}
