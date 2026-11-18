import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const clampPercent = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0))

export const formatDateISO = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let d = eh * 60 + em - (sh * 60 + sm)
  if (d <= 0) d += 1440
  return d
}
