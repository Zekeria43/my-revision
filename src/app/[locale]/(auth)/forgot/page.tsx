import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ForgotForm } from './form'

export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  return (
    <div className="card p-6 sm:p-8 animate-fade-in">
      <h1 className="text-xl font-extrabold">{t('auth.forgotTitle')}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('auth.forgotSubtitle')}</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-[hsl(var(--primary))] hover:underline">
          {t('auth.submitLogin')}
        </Link>
      </p>
    </div>
  )
}
