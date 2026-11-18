import { setRequestLocale } from 'next-intl/server'
import { LoginClient } from '../login/login-client'

/**
 * Staff / administration portal — separate entry point so admin sign-ins are
 * never mixed with student ones. Only ADMIN and OWNER accounts are accepted
 * here (enforced in `loginAction`); students are rejected with
 * `auth.errWrongPortal` before any session is created.
 */
export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ reset?: string }>
}) {
  const { locale } = await params
  const { reset } = await searchParams
  setRequestLocale(locale)

  return <LoginClient portal="admin" resetDone={reset === 'done'} />
}
