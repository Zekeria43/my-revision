import { setRequestLocale } from 'next-intl/server'
import { LoginClient } from './login-client'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ reset?: string }>
}) {
  const { locale } = await params
  const { reset } = await searchParams
  setRequestLocale(locale)

  return <LoginClient resetDone={reset === 'done'} />
}
