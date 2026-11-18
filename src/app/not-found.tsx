import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFoundPage() {
  const t = await getTranslations()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--muted))] text-3xl">🔍</div>
      <p className="mt-5 text-5xl font-extrabold text-[hsl(var(--primary))]">404</p>
      <h1 className="mt-2 text-xl font-extrabold">{t('errors.notFoundTitle')}</h1>
      <p className="mt-2 max-w-md text-sm text-[hsl(var(--muted-foreground))]">{t('errors.notFoundBody')}</p>
      <Link href="/" className="btn-primary mt-6">
        {t('errors.goHome')}
      </Link>
    </div>
  )
}
