'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { forgotAction, type ActionState } from '@/actions/auth'
import { Field, Input } from '@/components/ui'

const initial: ActionState = { ok: false }

function Submit() {
  const t = useTranslations()
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? `${t('common.saving')}…` : t('auth.forgotSend')}
    </button>
  )
}

export function ForgotForm() {
  const t = useTranslations()
  const locale = useLocale()
  const [state, formAction] = useActionState(forgotAction, initial)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {state.ok && (
        <div role="status" className="rounded-xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] p-3 text-sm">
          {t('auth.forgotSent')}
          {state.devLink && (
            <a
              href={state.devLink}
              dir="ltr"
              className="mt-2 block break-all font-mono text-xs underline"
            >
              {state.devLink}
            </a>
          )}
        </div>
      )}

      {state.messageKey && !state.ok && (
        <div role="alert" className="rounded-xl border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] p-3 text-sm">
          {t(state.messageKey as 'auth.errInvalidEmail', state.vars)}
        </div>
      )}

      <Field label={t('auth.email')} htmlFor="email" required>
        <Input id="email" name="email" type="email" dir="ltr" required placeholder="you@example.com" />
      </Field>

      <Submit />
    </form>
  )
}
