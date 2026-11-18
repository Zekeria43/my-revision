import { afterEach, describe, expect, it, vi } from 'vitest'
import { rateLimit, resetRateLimit } from '@/lib/rate-limit'

afterEach(() => {
  vi.useRealTimers()
  resetRateLimit('test:key')
})

describe('rateLimit', () => {
  it('allows up to the limit then blocks', () => {
    expect(rateLimit('test:key', 3, 60_000)).toBe(true)
    expect(rateLimit('test:key', 3, 60_000)).toBe(true)
    expect(rateLimit('test:key', 3, 60_000)).toBe(true)
    expect(rateLimit('test:key', 3, 60_000)).toBe(false)
  })

  it('tracks keys independently', () => {
    expect(rateLimit('test:key', 1, 60_000)).toBe(true)
    expect(rateLimit('test:key', 1, 60_000)).toBe(false)
    expect(rateLimit('test:other', 1, 60_000)).toBe(true)
  })

  it('frees the bucket after the window elapses', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(rateLimit('test:key', 1, 60_000)).toBe(true)
    expect(rateLimit('test:key', 1, 60_000)).toBe(false)

    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    expect(rateLimit('test:key', 1, 60_000)).toBe(true)
  })

  it('resetRateLimit clears the bucket immediately', () => {
    expect(rateLimit('test:key', 1, 60_000)).toBe(true)
    expect(rateLimit('test:key', 1, 60_000)).toBe(false)
    resetRateLimit('test:key')
    expect(rateLimit('test:key', 1, 60_000)).toBe(true)
  })
})
