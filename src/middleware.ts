import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intl = createMiddleware(routing)

export default function middleware(req: NextRequest) {
  // Locale resolution only. Authentication is enforced in server components
  // and server actions via requireUser()/requireAdmin() — never in the client.
  return intl(req)
}

export const config = {
  // Skip API, Next internals, files with an extension, and the offline shell
  // (which must stay reachable without a locale prefix for the service worker).
  matcher: ['/((?!api|_next|_vercel|offline|.*\\..*).*)'],
}
