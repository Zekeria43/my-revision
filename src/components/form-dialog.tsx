'use client'

import { useActionState, createContext, useContext, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Dialog, Button } from '@/components/ui'
import type { ActionState } from '@/actions/auth'

/**
 * Reusable modal form bound to a server action.
 * - translates validation keys returned by the server
 * - shows a success toast and closes on success
 * - never trusts client-side state for authorization (the action re-checks)
 */
export function FormDialog({
  open,
  onClose,
  title,
  action,
  children,
  submitLabel,
  wide,
  successMessage,
}: {
  open: boolean
  onClose: () => void
  title: string
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  children: React.ReactNode
  submitLabel?: string
  wide?: boolean
  successMessage?: string
}) {
  const t = useTranslations()
  const [state, formAction] = useActionState(action, { ok: false } as ActionState)
  const [toast, setToast] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      setToast(successMessage ?? t('common.save'))
      formRef.current?.reset()
      const id = setTimeout(() => {
        setToast(null)
        onClose()
      }, 650)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const err = (k: string) => {
    const m = state.errors?.[k]?.[0]
    if (!m) return undefined
    // server returns i18n keys — translate them
    try {
      return t(m as 'errors.formInvalid')
    } catch {
      return m
    }
  }

  const globalError =
    state.messageKey && !state.ok && !state.errors
      ? (() => {
          try {
            return t(state.messageKey as 'errors.serverErrorTitle')
          } catch {
            return state.messageKey
          }
        })()
      : null

  return (
    <>
      <Dialog open={open} onClose={onClose} title={title} wide={wide}>
        <form ref={formRef} action={formAction} className="space-y-4">
          {globalError && (
            <div
              role="alert"
              className="rounded-xl border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] p-3 text-sm"
            >
              {globalError}
            </div>
          )}
          <FormFields err={err}>{children}</FormFields>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Submit label={submitLabel ?? t('common.save')} />
          </div>
        </form>
      </Dialog>

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 inset-x-0 z-[70] flex justify-center px-4 animate-fade-in-up"
        >
          <div className="flex items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium shadow-2xl">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {toast}
          </div>
        </div>
      )}
    </>
  )
}

/** Passes an error translator down through arbitrary children. */
type ErrFn = (k: string) => string | undefined
const ErrContext = createContext<ErrFn>(() => undefined)
export const useFieldError = () => useContext(ErrContext)

function FormFields({ children, err }: { children: React.ReactNode; err: ErrFn }) {
  return <ErrContext.Provider value={err}>{children}</ErrContext.Provider>
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending}>
      {pending ? `${label}…` : label}
    </Button>
  )
}

/** Field wrapper that pulls the nearest dialog's validation error. */
export function DField({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  const err = useFieldError()(htmlFor ?? '')
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-[hsl(var(--danger))]"> *</span>}
      </label>
      {children}
      {hint && !err && (
        <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
      )}
      {err && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-[hsl(var(--danger))]">
          {err}
        </p>
      )}
    </div>
  )
}
