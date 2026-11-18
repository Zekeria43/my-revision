import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function RegisterSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ email?: string; limited?: string }>
}) {
  const { locale } = await params
  const { email, limited } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations()

  // Quota exhausted at registration: the account exists but NO mail went
  // out — never claim "we sent" when we didn't.
  const deferred = limited === '1'

  return (
    <div className="card p-6 text-center sm:p-8 animate-fade-in">
      <div
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl"
        style={{
          background: deferred
            ? 'hsl(var(--warning)/0.15)'
            : 'hsl(var(--success)/0.15)',
        }}
      >
        {deferred ? '⏳' : '📧'}
      </div>
      <h1 className="mt-4 text-xl font-extrabold">
        {deferred ? t('auth.verifyLimitedTitle') : t('auth.verifyTitle')}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {deferred
          ? t('auth.verifyDeferred', { email: email ?? '—' })
          : t('auth.verifyBody', { email: email ?? '—' })}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link href="/login" className="btn-primary">
          {t('auth.verifyGoLogin')}
        </Link>
        <Link href="/" className="btn-ghost">
          {t('errors.goHome')}
        </Link>
      </div>
    </div>
  )
}
