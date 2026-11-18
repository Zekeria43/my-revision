import { db } from '@/lib/db'

/**
 * Server-enforced platform configuration.
 *
 * Stored in the PlatformSetting table, editable ONLY through owner actions
 * (requireOwner) and always audited. These helpers are the single source of
 * truth the app reads — the database value wins over the environment value.
 */

export type PlatformSettingKey = 'REGISTRATION_OPEN' | 'EMAIL_DAILY_SEND_LIMIT'

/** Keys an owner may write — anything else is rejected at the action layer. */
export const PLATFORM_SETTING_KEYS: PlatformSettingKey[] = [
  'REGISTRATION_OPEN',
  'EMAIL_DAILY_SEND_LIMIT',
]

export async function getPlatformSetting(key: PlatformSettingKey, fallback: string): Promise<string> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key } })
    return row?.value ?? fallback
  } catch {
    // The settings table must never take the app down — fall back quietly.
    return fallback
  }
}

export async function setPlatformSetting(
  key: PlatformSettingKey,
  value: string,
  updatedById: string | null,
): Promise<void> {
  await db.platformSetting.upsert({
    where: { key },
    update: { value, updatedBy: updatedById },
    create: { key, value, updatedBy: updatedById },
  })
}

/** Whether new sign-ups are accepted. Default: open. */
export async function registrationOpen(): Promise<boolean> {
  return (await getPlatformSetting('REGISTRATION_OPEN', 'true')) !== 'false'
}

/** Current effective email limit (DB override → env → default 3). */
export async function effectiveEmailDailyLimit(): Promise<number> {
  const stored = await getPlatformSetting('EMAIL_DAILY_SEND_LIMIT', '')
  const n = Number(stored)
  if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  const env = Number(process.env.EMAIL_DAILY_SEND_LIMIT ?? '')
  return Number.isFinite(env) && env >= 1 ? Math.floor(env) : 3
}
