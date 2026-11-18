'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Lock, Mail, Settings2, ToggleLeft, ToggleRight, UserPlus, X } from 'lucide-react'
import { saveOwnerSetting } from '@/actions/owner'
import type { ActionState } from '@/actions/auth'
import { Button, Card, CardHeader, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

export function OwnerSettings({
  locale,
  registrationOpen,
  effectiveLimit,
  overridden,
}: {
  locale: string
  registrationOpen: boolean
  effectiveLimit: number
  overridden: boolean
}) {
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [limitDraft, setLimitDraft] = useState(String(effectiveLimit))

  const flash = (r: ActionState) => {
    setToast(
      r.ok
        ? { kind: 'ok', text: t('owner.settingSaved') }
        : { kind: 'err', text: t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle') },
    )
    setTimeout(() => setToast(null), 4000)
  }

  const save = (key: 'REGISTRATION_OPEN' | 'EMAIL_DAILY_SEND_LIMIT', value: string) => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('key', key)
      fd.set('value', value)
      fd.set('locale', locale)
      flash(await saveOwnerSetting({ ok: false }, fd))
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Settings2 className="text-[#f59e0b]" size={22} />
          {t('owner.settingsTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{t('owner.settingsSubtitle')}</p>
      </div>

      {/* Registration switch */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
            <UserPlus size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{t('owner.regSettingTitle')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('owner.regSettingHelp')}</p>
          </div>
          <Button
            variant={registrationOpen ? 'outline' : 'danger'}
            disabled={isPending}
            onClick={() => save('REGISTRATION_OPEN', registrationOpen ? 'false' : 'true')}
          >
            {registrationOpen ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {registrationOpen ? t('owner.regOpen') : t('owner.regClosed')}
          </Button>
        </div>
      </Card>

      {/* Email daily limit */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent)/0.14)] text-[hsl(var(--accent))]">
            <Mail size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{t('owner.limitSettingTitle')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('owner.limitSettingHelp')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              name="emailLimit"
              type="number"
              min={1}
              dir="ltr"
              className="w-24"
              aria-label={t('owner.limitSettingTitle')}
              placeholder={t('owner.limitPlaceholder')}
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.currentTarget.value)}
            />
            <Button
              variant="outline"
              disabled={
                isPending ||
                limitDraft.trim() === String(effectiveLimit) ||
                !/^\d+$/.test(limitDraft.trim()) ||
                Number(limitDraft.trim()) < 1
              }
              onClick={() => save('EMAIL_DAILY_SEND_LIMIT', limitDraft.trim())}
            >
              <Check size={15} /> {t('common.save')}
            </Button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          {overridden ? <X size={12} className="text-[hsl(var(--warning))]" /> : <Lock size={12} />}
          {t('owner.limitCurrent', { limit: effectiveLimit })}
        </p>
      </Card>

      {toast && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium',
            toast.kind === 'ok' ? 'border-[hsl(var(--success)/0.45)]' : 'border-[hsl(var(--danger)/0.45)]',
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}
