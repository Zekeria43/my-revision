'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

/** Add-to-home-screen prompt for the PWA. */
export function InstallPrompt() {
  const t = useTranslations('pwa')
  const [deferred, setDeferred] = useState<EventPrompt | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      if (localStorage.getItem('mv-install-dismissed')) return
      setDeferred(e as EventPrompt)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!visible || !deferred) return null

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 p-4 sm:end-auto sm:start-4 sm:bottom-4">
      <div className="card flex flex-wrap items-center gap-3 p-4 shadow-2xl animate-fade-in-up">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary))] text-lg font-bold text-white">
          م
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('installTitle')}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('installBody')}</p>
        </div>
        <button
          className="btn-primary h-9 text-[13px]"
          onClick={async () => {
            deferred.prompt()
            await deferred.userChoice
            setVisible(false)
          }}
        >
          {t('install')}
        </button>
        <button
          className="btn-ghost h-9 text-[13px]"
          onClick={() => {
            localStorage.setItem('mv-install-dismissed', '1')
            setVisible(false)
          }}
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  )
}

interface EventPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Online / offline banner. */
export function OfflineBanner() {
  const t = useTranslations('pwa')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null
  return (
    <div
      role="status"
      className="no-print sticky top-0 z-50 bg-[hsl(var(--warning))] px-4 py-2 text-center text-sm font-semibold text-black"
    >
      {t('offline')}
    </div>
  )
}
