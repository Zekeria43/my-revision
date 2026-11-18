import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Scheduler helpers: time conversion and overlap detection.
 * The Prisma client is mocked so these are pure unit tests.
 */

const sessionFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    studySession: { findMany: (...a: unknown[]) => sessionFindMany(...a) },
  },
}))

import { hasOverlap, timeHelpers } from '@/lib/scheduler'

const { toMin, toTime, dayStart, addDays } = timeHelpers

beforeEach(() => sessionFindMany.mockReset())

describe('time helpers', () => {
  it('converts HH:MM to minutes', () => {
    expect(toMin('00:00')).toBe(0)
    expect(toMin('09:30')).toBe(570)
    expect(toMin('23:59')).toBe(1439)
  })

  it('converts minutes back to HH:MM, clamped to a day', () => {
    expect(toTime(0)).toBe('00:00')
    expect(toTime(570)).toBe('09:30')
    expect(toTime(1439)).toBe('23:59')
    expect(toTime(-10)).toBe('00:00') // clamped low
    expect(toTime(5000)).toBe('23:59') // clamped high
  })

  it('round-trips', () => {
    for (const t of ['00:00', '07:05', '12:34', '18:45', '23:59']) {
      expect(toTime(toMin(t))).toBe(t)
    }
  })

  it('normalises dates to midnight and adds days safely', () => {
    const d = new Date(2026, 5, 15, 14, 37, 12)
    expect(dayStart(d).getHours()).toBe(0)
    expect(dayStart(d).getDate()).toBe(15)
    expect(addDays(d, 1).getDate()).toBe(16)
    expect(addDays(new Date(2026, 11, 31), 1).getDate()).toBe(1) // rolls over the year
  })
})

describe('hasOverlap', () => {
  const date = new Date(2026, 2, 10)

  it('detects a full containment', async () => {
    sessionFindMany.mockResolvedValue([{ startTime: '10:00', endTime: '11:00' }])
    expect(await hasOverlap('u1', date, '10:15', '10:45')).toBe(true)
  })

  it('detects a partial overlap on either side', async () => {
    sessionFindMany.mockResolvedValue([{ startTime: '10:00', endTime: '11:00' }])
    expect(await hasOverlap('u1', date, '09:30', '10:30')).toBe(true)
    expect(await hasOverlap('u1', date, '10:30', '11:30')).toBe(true)
  })

  it('returns false for adjacent (touching but not overlapping) slots', async () => {
    sessionFindMany.mockResolvedValue([{ startTime: '10:00', endTime: '11:00' }])
    // [09:00,10:00) ends exactly when the existing session starts → no overlap
    expect(await hasOverlap('u1', date, '09:00', '10:00')).toBe(false)
    expect(await hasOverlap('u1', date, '11:00', '12:00')).toBe(false)
  })

  it('returns false when the day has no sessions', async () => {
    sessionFindMany.mockResolvedValue([])
    expect(await hasOverlap('u1', date, '10:00', '11:00')).toBe(false)
  })

  it('scopes the query to one user, one day and excludes cancelled sessions', async () => {
    sessionFindMany.mockResolvedValue([])
    await hasOverlap('user-a', date, '10:00', '11:00', 'session-9')
    expect(sessionFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-a',
        date: dayStart(date),
        status: { notIn: ['CANCELLED'] },
        id: { not: 'session-9' },
      },
      select: { startTime: true, endTime: true },
    })
  })
})
