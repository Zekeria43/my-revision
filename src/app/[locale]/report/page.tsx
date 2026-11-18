import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireUser } from '@/lib/auth/guards'
import { getAnalytics, type RangeKey } from '@/lib/analytics'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'

/**
 * /analytics/report — a print-optimized snapshot of the analytics page.
 * Opened from "Export PDF"; the browser's print dialog offers "Save as PDF",
 * which keeps full RTL/Arabic typography (a server-side PDF renderer would
 * need an embedded Arabic font and would lose the vector charts).
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; subject?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  // requireUser() enforces login AND mandatory verification (PENDING →
  // /verify-pending), same as every other protected surface.
  const user = await requireUser()

  const t = await getTranslations()
  const ranges: RangeKey[] = ['7d', '30d', '90d', 'year']
  const range: RangeKey = ranges.includes(sp.range as RangeKey) ? (sp.range as RangeKey) : '30d'

  const data = await getAnalytics(user.id, range, locale, sp.subject)

  const tag = locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr-FR' : 'en-GB'
  const now = new Intl.DateTimeFormat(tag, { dateStyle: 'full', timeStyle: 'short' }).format(new Date())
  const hours = (m: number) => (m / 60).toFixed(m % 60 === 0 ? 0 : 1)

  const rangeNames: Record<RangeKey, string> = {
    '7d': t('common.days') + ' 7',
    '30d': t('common.days') + ' 30',
    '90d': t('common.days') + ' 90',
    year: t('common.year'),
  }

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <style>{`
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          .report-root { font-family: var(--font-sans, system-ui), system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; margin: 0; padding: 24px; color: #111; background: #fff; }
          .report-root h1 { font-size: 22px; margin: 0 0 4px; }
          .report-root h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
          .report-root .muted { color: #555; font-size: 12px; }
          .report-root .grid { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); }
          .report-root .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
          .report-root .kpi .v { font-size: 20px; font-weight: 800; }
          .report-root .kpi .l { font-size: 11px; color: #555; }
          .report-root table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .report-root th, .report-root td { border: 1px solid #ddd; padding: 6px 8px; text-align: start; }
          .report-root th { background: #f4f4f4; }
          .report-root .bar { height: 8px; background: #eee; border-radius: 99px; overflow: hidden; }
          .report-root .bar > span { display: block; height: 100%; background: #1b6af5; }
          .report-root .row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
          .report-root .row .name { width: 34%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .report-root .row .pct { width: 44px; font-weight: 700; text-align: end; }
          .report-root .actions { display: flex; gap: 8px; margin-bottom: 16px; }
          .report-root .actions button { padding: 8px 14px; border: 1px solid #111; background: #111; color: #fff; border-radius: 8px; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-block; }
          .report-root .actions a.ghost button { background: #fff; color: #111; }
          .report-root footer { margin-top: 26px; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 8px; }
          @media print {
            .report-root .actions { display: none; }
            .report-root { padding: 0; }
          }
        `}</style>

      <div className="report-root">
        <div className="actions">
          <PrintButton label={t('analytics.exportPdf')} />
          <a href={`/${locale}/analytics?range=${range}`} className="ghost">
            <button type="button">{t('errors.tryAgain')}</button>
          </a>
        </div>

        <h1>{t('analytics.title')}</h1>
        <p className="muted">
          {user.name} · {user.email} · {rangeNames[range]} · {now}
        </p>

        <h2>{t('analytics.overallProgress')}</h2>
        <div className="grid">
          <div className="kpi">
            <div className="v">{hours(data.kpis.totalStudyTime)}</div>
            <div className="l">{t('analytics.totalStudyTime')} ({t('common.hours')})</div>
          </div>
          <div className="kpi">
            <div className="v">{(data.kpis.avgDaily / 60).toFixed(1)}</div>
            <div className="l">{t('analytics.avgDaily')}</div>
          </div>
          <div className="kpi">
            <div className="v">{data.kpis.consistency}%</div>
            <div className="l">{t('analytics.consistency')}</div>
          </div>
          <div className="kpi">
            <div className="v">{data.kpis.missedRate}%</div>
            <div className="l">{t('analytics.missedRate')}</div>
          </div>
          <div className="kpi">
            <div className="v">{data.kpis.streak}</div>
            <div className="l">{t('analytics.streak')}</div>
          </div>
          <div className="kpi">
            <div className="v">
              {data.totals.daysStudied}/{data.totals.activeDays}
            </div>
            <div className="l">{t('analytics.daysStudied')}</div>
          </div>
          <div className="kpi">
            <div className="v">{data.totals.completedSessions}</div>
            <div className="l">{t('analytics.lessonsCompleted')}</div>
          </div>
          <div className="kpi">
            <div className="v">{data.totals.missedSessions}</div>
            <div className="l">{t('analytics.lessonsMissed')}</div>
          </div>
        </div>

        <h2>{t('analytics.bySubject')}</h2>
        {data.bySubject.length === 0 ? (
          <p className="muted">{t('analytics.noData')}</p>
        ) : (
          data.bySubject.map((s) => (
            <div key={s.name} className="row">
              <span className="name">{s.name}</span>
              <div className="bar" style={{ flex: 1 }}>
                <span style={{ width: `${s.percent}%`, background: s.color }} />
              </div>
              <span className="pct">{s.percent}%</span>
              <span className="muted" style={{ width: 70 }}>
                {s.completed}/{s.total}
              </span>
            </div>
          ))
        )}

        <h2>{t('analytics.weeklyActivity')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('analytics.weeklyActivity')}</th>
              <th>{t('common.minutes')}</th>
              <th>{t('common.hours')}</th>
            </tr>
          </thead>
          <tbody>
            {data.weekly.map((w) => (
              <tr key={w.day}>
                <td>{w.day}</td>
                <td>{w.minutes}</td>
                <td>{(w.minutes / 60).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>{t('analytics.studyDistribution')}</h2>
        {data.distribution.length === 0 ? (
          <p className="muted">{t('analytics.noData')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('analytics.filterSubject')}</th>
                <th>{t('common.minutes')}</th>
                <th>{t('common.hours')}</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {data.distribution.map((d) => {
                const total = data.distribution.reduce((a, x) => a + x.value, 0) || 1
                return (
                  <tr key={d.name}>
                    <td>{d.name}</td>
                    <td>{d.value}</td>
                    <td>{(d.value / 60).toFixed(1)}</td>
                    <td>{Math.round((d.value / total) * 100)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <h2>{t('analytics.plannedVsActual')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('analytics.plannedHours')}</th>
              <th>{t('analytics.actualHours')}</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {data.plannedVsActual.map((p) => (
              <tr key={p.label}>
                <td>{(p.planned / 60).toFixed(1)}</td>
                <td>{(p.actual / 60).toFixed(1)}</td>
                <td>{p.planned ? Math.round((p.actual / p.planned) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer>
          مراجعتي — Ma Révision — My Revision · {t('analytics.subtitle')} · {now}
        </footer>
      </div>
    </div>
  )
}
