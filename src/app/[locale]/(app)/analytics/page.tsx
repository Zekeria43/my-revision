import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { getAnalytics, type RangeKey } from '@/lib/analytics'
import { AnalyticsClient } from './client'

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; subject?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const ranges: RangeKey[] = ['7d', '30d', '90d', 'year']
  const range: RangeKey = ranges.includes(sp.range as RangeKey) ? (sp.range as RangeKey) : '30d'

  const [data, subjects] = await Promise.all([
    getAnalytics(user!.id, range, locale, sp.subject),
    db.subject.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ])

  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr-FR' : 'en-GB', {
      weekday: 'short',
    }).format(new Date(2024, 0, 7 + i)),
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('analytics.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('analytics.subtitle')}</p>
      </div>

      <AnalyticsClient
        data={{
          ...data,
          // Localised weekday labels computed server-side.
          weekly: data.weekly.map((w, i) => ({ ...w, day: dayNames[i] ?? w.day })),
        }}
        subjects={subjects}
        range={range}
        subjectFilter={sp.subject ?? 'all'}
        locale={locale}
      />
    </div>
  )
}
