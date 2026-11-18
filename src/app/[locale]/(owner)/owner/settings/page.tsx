import { setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth/guards'
import { emailDailyLimit } from '@/lib/email-quota'
import { OwnerSettings } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function OwnerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireOwner()

  const rows = await db.platformSetting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return (
    <OwnerSettings
      locale={locale}
      registrationOpen={map.REGISTRATION_OPEN !== 'false'} // default: open
      effectiveLimit={await emailDailyLimit()} // resolved: DB → env → 3
      overridden={map.EMAIL_DAILY_SEND_LIMIT !== undefined}
    />
  )
}
