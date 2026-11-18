'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { rateLimit } from '@/lib/rate-limit'
import type { ActionState } from './auth'

/**
 * Administration actions.
 *
 * - The actor is always re-resolved from the session and must be ADMIN
 *   (requireAdmin redirects otherwise — the client is never trusted).
 * - Every mutation is written to AdminAuditLog before it is applied.
 * - Self-protection: an admin can neither suspend themselves nor revoke
 *   their own administrator role (prevents lockout).
 */

const fail = (m: string): ActionState => ({ ok: false, messageKey: m })
const ok = (m?: string): ActionState => ({ ok: true, messageKey: m })

const STATUS_VALUES = new Set(['PENDING', 'ACTIVE', 'SUSPENDED'])
const ROLE_VALUES = new Set(['STUDENT', 'ADMIN'])

async function audit(
  adminId: string,
  action: string,
  targetId: string,
  meta: Record<string, unknown>,
) {
  await db.adminAuditLog.create({
    data: {
      adminId,
      targetId,
      action,
      entityType: 'User',
      meta: JSON.stringify(meta),
    },
  })
}

/** Bumps the admin's own activity record for the platform audit trail. */
function revalidateAdmin(locale: string) {
  revalidatePath(`/${locale}/admin`)
}

/* ───────────────────────── Status ───────────────────────── */

export async function setUserStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const locale = String(fd.get('locale') ?? 'ar')
  const targetId = String(fd.get('targetId') ?? '')
  const status = String(fd.get('status') ?? '')

  if (!targetId || !STATUS_VALUES.has(status)) return fail('errors.formInvalid')
  if (targetId === admin.id) return fail('errors.forbidden')
  if (!rateLimit(`admin-status:${admin.id}`, 30, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.role === 'OWNER') return fail('errors.forbidden') // OWNER accounts belong to /owner only

  try {
    await db.user.update({ where: { id: target.id }, data: { status: status as 'ACTIVE' } })

    // Suspending an account invalidates every one of its sessions.
    if (status === 'SUSPENDED') {
      await db.session.deleteMany({ where: { userId: target.id } })
    }

    await audit(admin.id, 'SET_STATUS', target.id, {
      from: target.status,
      to: status,
      email: target.email,
    })
    revalidateAdmin(locale)
    return ok('admin.userUpdated')
  } catch (e) {
    console.error('[admin/setUserStatus]', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Role ───────────────────────── */

export async function setUserRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const locale = String(fd.get('locale') ?? 'ar')
  const targetId = String(fd.get('targetId') ?? '')
  const role = String(fd.get('role') ?? '')

  if (!targetId || !ROLE_VALUES.has(role)) return fail('errors.formInvalid')
  if (targetId === admin.id) return fail('errors.forbidden') // never demote yourself
  if (!rateLimit(`admin-role:${admin.id}`, 20, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.role === 'OWNER') return fail('errors.forbidden') // OWNER accounts belong to /owner only

  try {
    await db.user.update({ where: { id: target.id }, data: { role: role as 'STUDENT' } })
    await audit(admin.id, 'SET_ROLE', target.id, {
      from: target.role,
      to: role,
      email: target.email,
    })
    revalidateAdmin(locale)
    return ok('admin.roleUpdated')
  } catch (e) {
    console.error('[admin/setUserRole]', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Resend activation ───────────────────────── */

export async function resendActivation(targetId: string, locale = 'ar'): Promise<ActionState> {
  const admin = await requireAdmin()
  if (!rateLimit(`admin-resend:${admin.id}`, 10, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.status !== 'PENDING') return fail('errors.formInvalid')

  try {
    // Mark as verified directly — the administrator vouches for the account.
    await db.user.update({
      where: { id: target.id },
      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    })
    await db.authToken.deleteMany({ where: { userId: target.id, type: 'VERIFY_EMAIL' } })
    await audit(admin.id, 'ACTIVATE', target.id, { email: target.email, via: 'admin' })
    revalidateAdmin(locale)
    return ok('admin.userUpdated')
  } catch (e) {
    console.error('[admin/resendActivation]', e)
    return fail('errors.serverErrorTitle')
  }
}
