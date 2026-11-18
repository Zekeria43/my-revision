'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const FEATURES = [
  { icon: '🗂️', title: 'academic.title', body: 'academic.subtitle' },
  { icon: '✅', title: 'lessons.title', body: 'lessons.status.COMPLETED' },
  { icon: '📈', title: 'analytics.overallProgress', body: 'dashboard.overallProgress' },
  { icon: '🗓️', title: 'calendar.title', body: 'calendar.subtitle' },
  { icon: '🧠', title: 'planner.title', body: 'planner.subtitle' },
  { icon: '🧪', title: 'exams.title', body: 'exams.subtitle' },
  { icon: '🔔', title: 'notifications.title', body: 'notifications.preferences' },
  { icon: '📊', title: 'analytics.title', body: 'analytics.subtitle' },
] as const

const STEPS = [
  'step1Title', 'step2Title', 'step3Title', 'step4Title', 'step5Title', 'step6Title',
] as const
const STEP_BODIES = [
  'step1Body', 'step2Body', 'step3Body', 'step4Body', 'step5Body', 'step6Body',
] as const

export function LandingSections() {
  const t = useTranslations()
  const locale = useLocale()
  const [sent, setSent] = useState(false)

  return (
    <>
      {/* ── Features ── */}
      <section id="features" className="container-app scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.featuresTitle')}</h2>
          <p className="mt-3 text-[hsl(var(--muted-foreground))]">{t('landing.featuresSubtitle')}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--muted))] text-xl transition group-hover:bg-[hsl(var(--primary)/0.15)]">
                {f.icon}
              </div>
              <h3 className="font-bold">{t(f.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t(f.body)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-20 border-y bg-[hsl(var(--surface))] py-16 sm:py-20">
        <div className="container-app">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.howTitle')}</h2>
            <p className="mt-3 text-[hsl(var(--muted-foreground))]">{t('landing.howSubtitle')}</p>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((key, i) => (
              <li key={key} className="card relative p-5">
                <span className="absolute end-4 top-4 text-5xl font-extrabold text-[hsl(var(--muted))]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="relative font-bold">{t(`landing.${key}`)}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {t(`landing.${STEP_BODIES[i]}`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="container-app scroll-mt-20 py-16 sm:py-20">
        <div className="card overflow-hidden p-0">
          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t('landing.aboutTitle')}
              </h2>
              <p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t('landing.aboutBody')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary">
                  {t('landing.ctaRegister')}
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 self-center">
              {[
                { v: '3', k: 'landing.stat3' },
                { v: '6', k: 'landing.stat2' },
                { v: '∞', k: 'landing.stat1' },
                { v: '100%', k: 'analytics.overallProgress' },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border bg-[hsl(var(--surface))] p-4 text-center">
                  <div className="text-3xl font-extrabold text-[hsl(var(--primary))]">{s.v}</div>
                  <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t(s.k)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact + legal ── */}
      <section id="contact" className="scroll-mt-20 border-t bg-[hsl(var(--surface))] py-16 sm:py-20">
        <div className="container-app grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('landing.contactTitle')}</h2>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t('landing.contactSubtitle')}</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                setSent(true)
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-name">
                    {t('landing.contactName')}
                  </label>
                  <input id="c-name" name="name" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="c-email">
                    {t('landing.contactEmail')}
                  </label>
                  <input id="c-email" name="email" type="email" required className="input" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="c-msg">
                  {t('landing.contactMessage')}
                </label>
                <textarea id="c-msg" name="message" required rows={5} className="input min-h-32" />
              </div>
              <button type="submit" className="btn-primary">
                {t('landing.contactSend')}
              </button>
              {sent && (
                <p role="status" className="rounded-xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] p-3 text-sm">
                  {t('landing.contactSent')}
                </p>
              )}
            </form>
          </div>

          <div className="space-y-5">
            <div id="privacy" className="card scroll-mt-20 p-5">
              <h3 className="font-bold">{t('landing.privacyTitle')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t('landing.privacyBody')}
              </p>
            </div>
            <div id="terms" className="card scroll-mt-20 p-5">
              <h3 className="font-bold">{t('landing.termsTitle')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t('landing.termsBody')}
              </p>
            </div>
            <div className="card p-5">
              <h3 className="font-bold">{t('brand.fullName')}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                <span dir="ltr">hello@marevision.app</span>
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {locale === 'ar' ? 'الرد خلال 24 ساعة' : locale === 'fr' ? 'Réponse sous 24 h' : 'Reply within 24 hours'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
