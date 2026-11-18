'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker (PWA) once the page is idle.
 * Only runs in production — dev has no build assets to precache.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
        console.warn('[pwa] registration failed', e)
      })
    }

    if (document.readyState === 'complete') register()
    else {
      const t = window.setTimeout(register, 1500)
      return () => window.clearTimeout(t)
    }
  }, [])

  return null
}
