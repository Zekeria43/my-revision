'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { resetAction, type ActionState } from '@/actions/auth'
import { Field, Input } from '@/components/ui'

const initial: ActionState = { ok: false }

function Submit() {
  const t = useTranslations()
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? `${t('common.saving')}…` : t('auth.resetSubmit')}
    </button>
  )
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const [state, formAction] = useActionState(resetAction, initial)

  const err = (k: string) => {
    const m = state.errors?.[k]?.[0]
    return m ? t(m as 'auth.errWeakPassword') : undefined
  }

  // A successful reset redirects to the login page (with a success banner),
  // so state.ok is unreachable here — failures render inline below.

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />

      {state.messageKey && !state.ok && !state.errors && (
        <div role="alert" className="rounded-xl border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] p-3 text-sm">
          {t(state.messageKey as 'auth.resetInvalid', state.vars)}
        </div>
      )}

      <Field label={t('auth.password')} htmlFor="password" error={err('password')} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" required minLength={8} />
      </Field>

      <Field label={t('auth.confirmPassword')} htmlFor="confirmPassword" error={err('confirmPassword')} required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          minLength={8}
        />
      </Field>

      <Submit />
    </form>
  )
}
