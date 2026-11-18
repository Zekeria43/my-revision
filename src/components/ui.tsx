'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/* ───────────────────────── Button ───────────────────────── */
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-sm',
  outline: 'border bg-transparent hover:bg-[hsl(var(--muted))]',
  ghost: 'bg-transparent hover:bg-[hsl(var(--muted))]',
  danger: 'bg-[hsl(var(--danger))] text-white hover:opacity-90',
  soft: 'bg-[hsl(var(--muted))] hover:bg-[hsl(var(--surface-elevated))]',
}
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
  icon: 'h-10 w-10 p-0',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

/* ───────────────────────── Input / Textarea / Select ───────────────────────── */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn('input', className)} {...p} />,
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn('input min-h-24 resize-y', className)} {...p} />,
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) => (
    <select ref={ref} className={cn('input appearance-none bg-no-repeat', className)} {...p}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  error?: string | null
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-[hsl(var(--danger))]"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-[hsl(var(--danger))]">
          {error}
        </p>
      )}
    </div>
  )
}

/* ───────────────────────── Card ───────────────────────── */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card p-5', className)} {...p} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/* ───────────────────────── Badge ───────────────────────── */
export function Badge({
  children,
  color,
  variant = 'soft',
  className,
}: {
  children: React.ReactNode
  color?: string
  variant?: 'soft' | 'solid' | 'outline'
  className?: string
}) {
  const style = color
    ? variant === 'solid'
      ? { background: color, color: '#fff' }
      : { background: `${color}1f`, color, border: `1px solid ${color}4d` }
    : undefined
  return (
    <span
      className={cn(
        'badge',
        !color && variant === 'soft' && 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
        !color && variant === 'outline' && 'border text-[hsl(var(--muted-foreground))]',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  )
}

/* ───────────────────────── Progress ───────────────────────── */
export function Progress({
  value,
  color = 'hsl(var(--primary))',
  className,
  showLabel,
}: {
  value: number
  color?: string
  className?: string
  showLabel?: boolean
}) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${v}%`, background: color }}
        />
      </div>
      {showLabel && <span className="w-11 shrink-0 text-end text-xs font-semibold tabular-nums">{Math.round(v)}%</span>}
    </div>
  )
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 11,
  color = 'hsl(var(--primary))',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: React.ReactNode
}) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.23,1,.32,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/* ───────────────────────── Dialog ───────────────────────── */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border bg-[hsl(var(--card))] p-5 shadow-2xl animate-fade-in-up sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="close"
            className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ───────────────────────── Empty state ───────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed bg-[hsl(var(--surface))] px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
          {icon}
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ───────────────────────── Skeleton / Spinner ───────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-label="loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/* ───────────────────────── Tabs ───────────────────────── */
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto rounded-xl border bg-[hsl(var(--surface))] p-1 no-scrollbar', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition',
            value === t.id
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className={cn('rounded-full px-1.5 text-[11px]', value === t.id ? 'bg-white/20' : 'bg-[hsl(var(--muted))]')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ───────────────────────── Toast host (client) ───────────────────────── */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  React.useEffect(() => {
    const id = setTimeout(onDone, 3200)
    return () => clearTimeout(id)
  }, [message, onDone])
  return (
    <div
      role="status"
      className="fixed bottom-5 inset-x-0 z-[60] flex justify-center px-4 animate-fade-in-up"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium shadow-2xl">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--success))" strokeWidth="2.4" strokeLinecap="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {message}
      </div>
    </div>
  )
}
