import { redirect } from 'next/navigation'
import { getCurrentUser } from './session'

/**
 * Server-side authorization helpers.
 * Never trust a client-provided user id — every helper resolves the user
 * from the session cookie only.
 */

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'PENDING') redirect('/verify-pending')
  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Mandatory email verification applies to every role — a pending admin
  // must verify before touching the admin panel.
  if (user.status === 'PENDING') redirect('/verify-pending')
  if (user.role !== 'ADMIN') redirect('/dashboard')
  return user
}

/**
 * Platform owner — the highest privilege, provisioned only by the seed
 * process. Everything under /owner resolves the role here, on the server.
 * The OWNER never enters the admin panel: the /owner dashboard is theirs.
 */
export async function requireOwner() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'PENDING') redirect('/verify-pending')
  if (user.role !== 'OWNER') {
    redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard')
  }
  return user
}

/** For server actions that must not redirect. Returns null instead. */
export async function optionalUser() {
  return getCurrentUser()
}

export async function requireActiveUser() {
  const user = await getCurrentUser()
  if (!user || user.status !== 'ACTIVE') return null
  return user
}
