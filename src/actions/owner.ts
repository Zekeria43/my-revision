'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth/guards'
import { rateLimit } from '@/lib/rate-limit'
import { PLATFORM_SETTING_KEYS, setPlatformSetting, type PlatformSettingKey } from '@/lib/platform-settings'
import type { ActionState } from './auth'

/**
 * Platform owner actions.
 *
 * - The actor is always re-resolved from the session and must be OWNER
 *   (requireOwner redirects otherwise — the client is never trusted).
 * - OWNER accounts are untouchable: no admin action and no owner action may
 *   demote, suspend or delete them (only the owner themselves, never through
 *   these endpoints, and never their own account — lockout protection).
 * - Every mutation is written to AdminAuditLog BEFORE it is applied.
 */

const fail = (m: string): ActionState => ({ ok: false, messageKey: m })
const ok = (m?: string): ActionState => ({ ok: true, messageKey: m })

const STATUS_VALUES = new Set(['PENDING', 'ACTIVE', 'SUSPENDED'])
const ROLE_VALUES = new Set(['STUDENT', 'ADMIN'])

async function audit(
  ownerId: string,
  action: string,
  targetId: string | null,
  entityType: 'User' | 'PlatformSetting',
  meta: Record<string, unknown>,
) {
  await db.adminAuditLog.create({
    data: {
      adminId: ownerId,
      targetId,
      action,
      entityType,
      meta: JSON.stringify(meta),
    },
  })
}

function revalidateOwner(locale: string) {
  revalidatePath(`/${locale}/owner`)
  revalidatePath(`/${locale}/owner/users`)
  revalidatePath(`/${locale}/owner/settings`)
  revalidatePath(`/${locale}/owner/audit`)
}

/* ───────────────────────── Role (STUDENT ⇄ ADMIN) ───────────────────────── */

export async function ownerSetUserRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const locale = String(fd.get('locale') ?? 'ar')
  const targetId = String(fd.get('targetId') ?? '')
  const role = String(fd.get('role') ?? '')

  if (!targetId || !ROLE_VALUES.has(role)) return fail('errors.formInvalid')
  if (targetId === owner.id) return fail('errors.forbidden') // never change your own role
  if (!rateLimit(`owner-role:${owner.id}`, 30, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.role === 'OWNER') return fail('errors.forbidden') // OWNER accounts are untouchable

  try {
    await db.user.update({ where: { id: target.id }, data: { role: role as 'STUDENT' } })
    await audit(owner.id, 'SET_ROLE', target.id, 'User', { from: target.role, to: role, email: target.email })
    revalidateOwner(locale)
    return ok('owner.userUpdated')
  } catch (e) {
    console.error('[owner/setUserRole]', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Status ───────────────────────── */

export async function ownerSetUserStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const locale = String(fd.get('locale') ?? 'ar')
  const targetId = String(fd.get('targetId') ?? '')
  const status = String(fd.get('status') ?? '')

  if (!targetId || !STATUS_VALUES.has(status)) return fail('errors.formInvalid')
  if (targetId === owner.id) return fail('errors.forbidden')
  if (!rateLimit(`owner-status:${owner.id}`, 30, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.role === 'OWNER') return fail('errors.forbidden')

  try {
    await db.user.update({ where: { id: target.id }, data: { status: status as 'ACTIVE' } })
    if (status === 'SUSPENDED') {
      // Same hygiene as admin suspension: kill every live session.
      await db.session.deleteMany({ where: { userId: target.id } })
    }
    await audit(owner.id, 'SET_STATUS', target.id, 'User', { from: target.status, to: status, email: target.email })
    revalidateOwner(locale)
    return ok('owner.userUpdated')
  } catch (e) {
    console.error('[owner/setUserStatus]', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Manual verification ───────────────────────── */

export async function ownerVerifyUser(targetId: string, locale = 'ar'): Promise<ActionState> {
  const owner = await requireOwner()
  if (!rateLimit(`owner-verify:${owner.id}`, 30, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.role === 'OWNER') return fail('errors.forbidden')

  try {
    // The owner vouches for the account — same semantics as the admin panel.
    await db.user.update({
      where: { id: target.id },
      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    })
    await db.authToken.deleteMany({ where: { userId: target.id, type: 'VERIFY_EMAIL' } })
    await audit(owner.id, 'ACTIVATE', target.id, 'User', { email: target.email, via: 'owner' })
    revalidateOwner(locale)
    return ok('owner.userUpdated')
  } catch (e) {
    console.error('[owner/verifyUser]', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Delete (destructive) ───────────────────────── */

export async function ownerDeleteUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const locale = String(fd.get('locale') ?? 'ar')
  const targetId = String(fd.get('targetId') ?? '')
  // Destructive guard: the owner must type the target's email to confirm.
  const confirmEmail = String(fd.get('confirmEmail') ?? '').trim().toLowerCase()

  if (!targetId) return fail('errors.formInvalid')
  if (!rateLimit(`owner-delete:${owner.id}`, 5, 60_000)) return fail('auth.errRateLimited')

  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return fail('errors.notFoundTitle')
  if (target.role === 'OWNER') return fail('errors.forbidden')
  if (targetId === owner.id) return fail('errors.forbidden')
  if (confirmEmail !== target.email) return fail('owner.deleteMismatch')

  try {
    await db.user.delete({ where: { id: target.id } }) // cascades sessions/tokens/data
    await audit(owner.id, 'DELETE_USER', null, 'User', {
      email: target.email,
      name: target.name,
      role: target.role,
      status: target.status,
    })
    revalidateOwner(locale)
    return ok('owner.userDeleted')
  } catch (e) {
    console.error('[owner/deleteUser]', e)
    return fail('errors.serverErrorTitle')
  }
}

/* ───────────────────────── Platform settings ───────────────────────── */

export async function saveOwnerSetting(_p: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const locale = String(fd.get('locale') ?? 'ar')
  const key = String(fd.get('key') ?? '') as PlatformSettingKey
  const value = String(fd.get('value') ?? '').trim()

  if (!PLATFORM_SETTING_KEYS.includes(key)) return fail('errors.formInvalid')
  if (!rateLimit(`owner-setting:${owner.id}`, 30, 60_000)) return fail('auth.errRateLimited')

  if (key === 'REGISTRATION_OPEN' && value !== 'true' && value !== 'false') {
    return fail('errors.formInvalid')
  }
  if (key === 'EMAIL_DAILY_SEND_LIMIT') {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 10_000) return fail('errors.formInvalid')
  }

  try {
    const previous = await db.platformSetting.findUnique({ where: { key } })
    await setPlatformSetting(key, value, owner.id)
    await audit(owner.id, 'SET_SETTING', null, 'PlatformSetting', {
      key,
      from: previous?.value ?? null,
      to: value,
    })
    revalidateOwner(locale)
    return ok('owner.settingSaved')
  } catch (e) {
    console.error('[owner/saveSetting]', e)
    return fail('errors.serverErrorTitle')
  }
}
