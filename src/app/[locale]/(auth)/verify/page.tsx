import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { verifyEmail } from '@/actions/auth'

export default async function VerifyPage({
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

  const result = token
    ? await verifyEmail(token)
    : { ok: false, messageKey: 'auth.verifyMissing' }

  return (
    <div className="card p-6 text-center sm:p-8 animate-fade-in">
      <div
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl"
        style={{
          background: result.ok ? 'hsl(var(--success)/0.15)' : 'hsl(var(--danger)/0.12)',
        }}
      >
        {result.ok ? '✅' : '⚠️'}
      </div>
      <h1 className="mt-4 text-xl font-extrabold">
        {result.ok ? t('auth.verifiedTitle') : t(result.messageKey as 'auth.verifyMissing')}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {result.ok ? t('auth.verifiedBody') : t('auth.verifyMissingHelp')}
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
