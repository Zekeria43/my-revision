'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { loginAction, type ActionState } from '@/actions/auth'
import { ResendVerifyForm } from '../resend-form'
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

export function LoginClient({ resetDone }: { resetDone?: boolean }) {
  const t = useTranslations()
  const locale = useLocale()
  const [state, formAction] = useActionState(loginAction, initial)
  const [showResend, setShowResend] = useState(false)

  const err = (k: string) => state.errors?.[k]?.[0]
  const globalMsg = state.messageKey && !state.ok ? t(state.messageKey as 'auth.errInvalidCredentials', state.vars) : null

  return (
    <div className="card p-6 sm:p-8 animate-fade-in">
      <h1 className="text-xl font-extrabold">{t('auth.loginTitle')}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('auth.loginSubtitle')}</p>

      {resetDone && !state.messageKey && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] p-3 text-sm"
        >
          {t('auth.resetDone')}
        </div>
      )}

      {globalMsg && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] p-3 text-sm"
        >
          <p>{globalMsg}</p>
          {state.messageKey === 'auth.errPending' && (
            <button className="mt-2 text-xs font-semibold underline" onClick={() => setShowResend(true)}>
              {t('auth.verifyResend')}
            </button>
          )}
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />

        <Field label={t('auth.email')} htmlFor="email" error={err('email')} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            placeholder="you@example.com"
            defaultValue=""
          />
        </Field>

        <Field label={t('auth.password')} htmlFor="password" error={err('password')} required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            placeholder="••••••••"
          />
        </Field>

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <input type="checkbox" name="remember" className="h-4 w-4 rounded accent-[hsl(var(--primary))]" />
            {t('auth.remember')}
          </label>
          <Link href="/forgot" className="font-medium text-[hsl(var(--primary))] hover:underline">
            {t('auth.forgot')}
          </Link>
        </div>

        <Submit label={t('auth.submitLogin')} />
      </form>

      {showResend && <ResendVerifyForm />}

      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-[hsl(var(--primary))] hover:underline">
          {t('auth.submitRegister')}
        </Link>
      </p>
    </div>
  )
}
