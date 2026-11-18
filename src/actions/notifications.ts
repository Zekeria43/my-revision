'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'

/**
 * Notification actions. Titles/bodies are stored as i18n KEYS plus a JSON
 * params object — user-generated content is never interpolated as markup.
 */

const fail = (m: string) => ({ ok: false, messageKey: m }) as const
const ok = (m?: string) => ({ ok: true, messageKey: m }) as const

export async function markNotificationRead(fd: FormData) {
  const user = await requireUser()
  const id = String(fd.get('id') ?? '')
  const locale = String(fd.get('locale') ?? 'ar')
  if (!id) return fail('errors.formInvalid')

  const row = await db.notification.findFirst({ where: { id, userId: user.id } })
  if (!row) return fail('errors.forbidden')

  try {
    if (!row.readAt) {
      await db.notification.update({ where: { id }, data: { readAt: new Date() } })
    }
    revalidatePath(`/${locale}/notifications`)
    return ok('notifications.markRead')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function markAllNotificationsRead(locale = 'ar') {
  const user = await requireUser()
  try {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    revalidatePath(`/${locale}/notifications`)
    return ok('notifications.markAllRead')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function clearReadNotifications(locale = 'ar') {
  const user = await requireUser()
  try {
    // Only READ notifications are ever removed, and only the caller's.
    await db.notification.deleteMany({
      where: { userId: user.id, readAt: { not: null } },
    })
    revalidatePath(`/${locale}/notifications`)
    return ok('common.delete')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}

export async function setNotificationPreference(_p: { ok: boolean }, fd: FormData) {
  const user = await requireUser()
  const locale = String(fd.get('locale') ?? 'ar')
  const enabled = fd.get('notificationsEnabled') === 'on'
  const emailEnabled = fd.get('emailEnabled') === 'on'
  const remindBeforeMin = Number(fd.get('remindBeforeMin') ?? 15)

  if (!Number.isFinite(remindBeforeMin) || remindBeforeMin < 0 || remindBeforeMin > 1440) {
    return fail('errors.formInvalid')
  }

  try {
    await db.studyPreference.upsert({
      where: { userId: user.id },
      update: { notificationsEnabled: enabled, emailEnabled, remindBeforeMin },
      create: {
        userId: user.id,
        notificationsEnabled: enabled,
        emailEnabled,
        remindBeforeMin,
      },
    })
    revalidatePath(`/${locale}/notifications`)
    return ok('common.save')
  } catch {
    return fail('errors.serverErrorTitle')
  }
}
