/**
 * In-memory sliding-window rate limiter.
 * Suitable for a single instance. For multi-instance production deployments
 * swap the store for Redis/Upstash — the interface below stays identical.
 */

type Bucket = number[]

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 20_000

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b) {
    if (buckets.size > MAX_BUCKETS) buckets.clear()
    b = []
    buckets.set(key, b)
  }
  // drop expired entries
  while (b.length && b[0] <= now - windowMs) b.shift()
  if (b.length >= limit) return false
  b.push(now)
  return true
}

/** Reset a bucket — used after a successful login. */
export function resetRateLimit(key: string) {
  buckets.delete(key)
}

// Periodic cleanup so memory stays bounded.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      if (!b.length || b[b.length - 1] <= now - 600_000) buckets.delete(k)
    }
  }, 120_000).unref?.()
}
