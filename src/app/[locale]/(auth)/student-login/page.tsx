import { setRequestLocale } from 'next-intl/server'
import { LoginClient } from '../login/login-client'

/**
 * Student portal — the dedicated entry point for learners, kept separate from
 * the staff sign-in so the two audiences never share a form. Only STUDENT
 * accounts are accepted here (enforced in `loginAction`); admins and the
 * owner are rejected with `auth.errWrongPortal` before any session exists.
 */
export default async function StudentLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ reset?: string }>
}) {
  const { locale } = await params
  const { reset } = await searchParams
  setRequestLocale(locale)

  return <LoginClient portal="student" resetDone={reset === 'done'} />
}
