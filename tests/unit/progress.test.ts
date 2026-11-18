import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Progress math is unit-tested against a mocked Prisma client so the
 * arithmetic (clamping, division-by-zero, counts) is verified in isolation.
 */

const lessonFindMany = vi.fn()
const subjectFindMany = vi.fn()
const lessonCount = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    lesson: { findMany: (...a: unknown[]) => lessonFindMany(...a), count: (...a: unknown[]) => lessonCount(...a) },
    subject: { findMany: (...a: unknown[]) => subjectFindMany(...a) },
  },
}))

import { overallProgress, progressSummary, subjectProgress } from '@/lib/progress'

beforeEach(() => {
  lessonFindMany.mockReset()
  subjectFindMany.mockReset()
  lessonCount.mockReset()
})

describe('subjectProgress', () => {
  it('computes percentages without dividing by zero', async () => {
    lessonFindMany.mockResolvedValue([])
    const p = await subjectProgress('u1', 's1')
    expect(p.total).toBe(0)
    expect(p.percent).toBe(0)
    expect(p.remaining).toBe(0)
  })

  it('counts each status and derives the percentage', async () => {
    lessonFindMany.mockResolvedValue([
      { subjectId: 's1', status: 'COMPLETED' },
      { subjectId: 's1', status: 'COMPLETED' },
      { subjectId: 's1', status: 'IN_PROGRESS' },
      { subjectId: 's1', status: 'NEEDS_REVISION' },
      { subjectId: 's1', status: 'NOT_STARTED' },
    ])
    const p = await subjectProgress('u1', 's1')
    expect(p).toMatchObject({
      subjectId: 's1',
      total: 5,
      completed: 2,
      inProgress: 1,
      needsRevision: 1,
      notStarted: 1,
      remaining: 3,
      percent: 40,
    })
  })

  it('scopes the query to the owner and the subject', async () => {
    lessonFindMany.mockResolvedValue([])
    await subjectProgress('user-a', 'subject-a')
    expect(lessonFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', subjectId: 'subject-a', archivedAt: null },
      select: { subjectId: true, status: true },
    })
  })
})

describe('overallProgress', () => {
  it('aggregates across subjects and keeps per-subject rows', async () => {
    subjectFindMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    lessonFindMany.mockResolvedValue([
      { subjectId: 's1', status: 'COMPLETED' },
      { subjectId: 's1', status: 'NOT_STARTED' },
      { subjectId: 's2', status: 'COMPLETED' },
    ])

    const p = await overallProgress('u1')
    expect(p.subjectId).toBe('all')
    expect(p.total).toBe(3)
    expect(p.completed).toBe(2)
    expect(p.percent).toBe(66.67)
    expect(p.bySubject).toHaveLength(2)
    expect(p.bySubject[0]).toMatchObject({ subjectId: 's1', total: 2, percent: 50 })
    expect(p.bySubject[1]).toMatchObject({ subjectId: 's2', total: 1, percent: 100 })
  })

  it('returns zeroes when the user has no subjects', async () => {
    subjectFindMany.mockResolvedValue([])
    const p = await overallProgress('u1')
    expect(p.total).toBe(0)
    expect(p.percent).toBe(0)
    expect(p.bySubject).toEqual([])
    expect(lessonFindMany).not.toHaveBeenCalled()
  })
})

describe('progressSummary', () => {
  it('derives remaining and percent from raw counts', async () => {
    lessonCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(4) // completed
      .mockResolvedValueOnce(3) // in progress
      .mockResolvedValueOnce(2) // needs revision

    const s = await progressSummary('u1')
    expect(s).toEqual({
      total: 10,
      completed: 4,
      inProgress: 3,
      needsRevision: 2,
      remaining: 6,
      percent: 40,
    })
  })

  it('never divides by zero', async () => {
    lessonCount.mockResolvedValue(0)
    const s = await progressSummary('u1')
    expect(s.percent).toBe(0)
    expect(s.remaining).toBe(0)
  })
})
