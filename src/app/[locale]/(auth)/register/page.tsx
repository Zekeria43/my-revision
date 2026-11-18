'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { registerAction, type ActionState } from '@/actions/auth'
import { Field, Input, Select } from '@/components/ui'

const initial: ActionState = { ok: false }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? `${label}…` : label}
    </button>
  )
}

export default function RegisterPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [state, formAction] = useActionState(registerAction, initial)

  const err = (k: string) => {
    const m = state.errors?.[k]?.[0]
    return m ? t(m as 'auth.errInvalidEmail') : undefined
  }

  return (
    <div className="card p-6 sm:p-8 animate-fade-in">
      <h1 className="text-xl font-extrabold">{t('auth.registerTitle')}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('auth.registerSubtitle')}</p>

      {state.messageKey && !state.ok && !state.errors && (
        <div role="alert" className="mt-4 rounded-xl border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] p-3 text-sm">
          {t(state.messageKey as 'auth.errEmailTaken', state.vars)}
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />

        <Field label={t('auth.name')} htmlFor="name" error={err('name')} required>
          <Input id="name" name="name" autoComplete="name" required defaultValue="" />
        </Field>

        <Field label={t('auth.email')} htmlFor="email" error={err('email')} required>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required placeholder="you@example.com" />
        </Field>

        <Field label={t('auth.password')} htmlFor="password" error={err('password')} required hint={t('auth.errWeakPassword')}>
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

        {/* Academic information — all optional */}
        <fieldset className="space-y-4 rounded-2xl border border-[hsl(var(--border))] p-4">
          <legend className="px-1 text-sm font-bold">{t('auth.academicInfo')}</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.country')} htmlFor="country" error={err('country')}>
              <Input id="country" name="country" maxLength={80} defaultValue="" />
            </Field>
            <Field label={t('settings.city')} htmlFor="city" error={err('city')}>
              <Input id="city" name="city" maxLength={80} defaultValue="" />
            </Field>
          </div>

          <Field label={t('settings.school')} htmlFor="school" error={err('school')}>
            <Input id="school" name="school" maxLength={120} defaultValue="" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.academicLevel')} htmlFor="academicLevel" error={err('academicLevel')}>
              <Input id="academicLevel" name="academicLevel" maxLength={80} defaultValue="" />
            </Field>
            <Field label={t('settings.fieldOfStudy')} htmlFor="program" error={err('program')}>
              <Input id="program" name="program" maxLength={120} defaultValue="" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.academicYear')} htmlFor="academicYear" error={err('academicYear')}>
              <Input id="academicYear" name="academicYear" maxLength={40} defaultValue="" />
            </Field>
            <Field label={t('settings.preferredLanguage')} htmlFor="preferredLanguage" error={err('preferredLanguage')}>
              <Select id="preferredLanguage" name="preferredLanguage" defaultValue={locale}>
                <option value="ar">العربية</option>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            </Field>
          </div>
        </fieldset>

        <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{t('auth.termsAgree')}</p>

        <Submit label={t('auth.submitRegister')} />
      </form>

      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t('auth.hasAccount')}{' '}
        <Link href="/login" className="font-semibold text-[hsl(var(--primary))] hover:underline">
          {t('auth.submitLogin')}
        </Link>
      </p>
    </div>
  )
}
