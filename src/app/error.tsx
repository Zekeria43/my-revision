'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] unhandled error', error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b1119',
          color: '#e2e8f0',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 460 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 22, margin: '16px 0 8px' }}>خطأ في الخادم / Server error</h1>
          <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.7 }}>
            حدث خطأ غير متوقع. حاول مجدداً. / Something went wrong. Please try again.
          </p>
          {error.digest && (
            <p style={{ opacity: 0.4, fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              background: '#1b6af5',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            إعادة المحاولة / Try again
          </button>
        </div>
      </body>
    </html>
  )
}
