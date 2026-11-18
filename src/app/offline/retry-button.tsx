'use client'

/** Reloads the offline fallback once the network is back. */
export function RetryButton() {
  return (
    <button onClick={() => location.reload()} className="btn-primary mt-6">
      إعادة المحاولة / Retry
    </button>
  )
}
