'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { resendVerificationAction, type ActionState } from '@/actions/auth'
import { Field, Input } from '@/components/ui'

const initial: ActionState = { ok: false }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? `${label}…` : label}
    </button>
  )
}

/**
 * Shared "resend activation link" form.
 *
 * - login page: appears after an errPending attempt — the address is typed
 * - verify-pending page: the signed-in user's address is locked in a hidden
 *   field so the form can never be pointed at somebody else's account
 */
export function ResendVerifyForm({ email }: { email?: string | null }) {
  const t = useTranslations()
  const locale = useLocale()
  const [state, formAction] = useActionState(resendVerificationAction, initial)

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-xl border bg-[hsl(var(--surface))] p-4 animate-fade-in text-start"
    >
      <input type="hidden" name="locale" value={locale} />
      {email ? <input type="hidden" name="email" value={email} /> : null}

      <p className="text-sm font-semibold">{t('auth.verifyResend')}</p>

      {state.ok && (
        <div
          role="status"
          className="rounded-xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] p-3 text-sm"
        >
          {t('auth.resendSent')}
          {state.devLink && (
            <a href={state.devLink} dir="ltr" className="mt-2 block break-all font-mono text-xs underline">
              {state.devLink}
            </a>
          )}
        </div>
      )}

      {state.messageKey && !state.ok && (
        <div
          role="alert"
          className="rounded-xl border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] p-3 text-sm"
        >
          {t(state.messageKey as 'auth.errInvalidEmail', state.vars)}
        </div>
      )}

      {!email && (
        <Field label={t('auth.email')} htmlFor="resend-email" required>
          <Input
            id="resend-email"
            name="email"
            type="email"
            dir="ltr"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
      )}

      <Submit label={t('auth.resendSend')} />
    </form>
  )
}
