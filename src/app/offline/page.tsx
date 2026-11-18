/**
 * Offline fallback — rendered by the root layout.
 * Kept intentionally simple so it always loads from the service worker cache.
 */
import { RetryButton } from './retry-button'

export const metadata = { title: 'Offline' }

export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--muted))] text-3xl">📡</div>
      <h1 className="mt-5 text-2xl font-extrabold">أنت غير متصل / You&apos;re offline</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        تحقق من اتصالك بالإنترنت ثم أعد المحاولة.
        <br />
        Check your connection and try again.
      </p>
      <RetryButton />
    </main>
  )
}
