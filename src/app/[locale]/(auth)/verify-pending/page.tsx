import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { ResendVerifyForm } from '../resend-form'

export default async function VerifyPendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const user = await getCurrentUser()
  if (user && user.status === 'ACTIVE') redirect(`/${locale}/dashboard`)

  return (
    <div className="card p-6 text-center sm:p-8 animate-fade-in">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--warning)/0.15)] text-2xl">✉️</div>
      <h1 className="mt-4 text-xl font-extrabold">{t('auth.verifyTitle')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {t('auth.verifyBody', { email: user?.email ?? '—' })}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link href="/login" className="btn-primary">
          {t('auth.verifyGoLogin')}
        </Link>
      </div>
      {/* Correct flow: a brand-new verification link — never /forgot. */}
      <ResendVerifyForm email={user?.email} />
    </div>
  )
}
