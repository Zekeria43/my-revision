import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { peekToken } from '@/lib/auth/tokens'
import { ResetForm } from './form'

/**
 * Recovery landing page. A missing, expired, already-used or unknown token
 * never reaches the password form — the page explains what happened (in the
 * active language) and offers a fresh link instead of a dead form.
 */
export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { locale } = await params
  const { token } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations()

  const state = token ? await peekToken(token, 'RESET_PASSWORD') : 'unknown'

  if (state !== 'ok') {
    const title = state === 'expired' ? t('auth.resetExpired') : t('auth.resetInvalid')
    return (
      <div className="card p-6 text-center sm:p-8 animate-fade-in">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--danger)/0.12)] text-2xl">
          ⚠️
        </div>
        <h1 className="mt-4 text-xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {t('auth.resetExpiredHelp')}
        </p>
        <Link href="/forgot" className="btn-primary mt-6 inline-flex">
          {t('auth.forgotTitle')}
        </Link>
      </div>
    )
  }

  return (
    <div className="card p-6 sm:p-8 animate-fade-in">
      <h1 className="text-xl font-extrabold">{t('auth.resetTitle')}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('auth.resetSubtitle')}</p>
      <div className="mt-6">
        <ResetForm token={token!} />
      </div>
    </div>
  )
}
