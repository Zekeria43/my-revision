'use client'

/** Triggers the browser print dialog → "Save as PDF". */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()}>
      {label}
    </button>
  )
}
