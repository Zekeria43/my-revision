import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { overallProgress, progressSummary, subjectProgress } from '@/lib/progress'
import { hasOverlap } from '@/lib/scheduler'
import { getAnalytics } from '@/lib/analytics'

/**
 * Student isolation — two real accounts in the real SQLite database.
 *
 * These tests create their own throwaway users and delete ONLY those users
 * in the teardown (test-owned data); seeded demo data is never touched.
 */

const suffix = randomBytes(4).toString('hex')
const A = { id: `test-a-${suffix}`, email: `test-a-${suffix}@example.test` }
const B = { id: `test-b-${suffix}`, email: `test-b-${suffix}@example.test` }

const day = (offset: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

async function createUser(u: { id: string; email: string }, label: string) {
  return db.user.create({
    data: {
      id: u.id,
      email: u.email,
      passwordHash: 'x'.repeat(60),
      name: `Isolation test ${label}`,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  })
}

let subjectA1: string
let subjectA2: string
let subjectB1: string
let sessionB1: string

beforeAll(async () => {
  await createUser(A, 'A')
  await createUser(B, 'B')

  const [sA1, sA2, sB1] = await Promise.all([
    db.subject.create({
      data: { userId: A.id, name: 'Algebra A', color: '#ff0000', priority: 1, importance: 'HIGH' },
    }),
    db.subject.create({
      data: { userId: A.id, name: 'Physics A', color: '#00ff00', priority: 2, importance: 'LOW' },
    }),
    db.subject.create({
      data: { userId: B.id, name: 'Chemistry B', color: '#0000ff', priority: 1, importance: 'MEDIUM' },
    }),
  ])
  subjectA1 = sA1.id
  subjectA2 = sA2.id
  subjectB1 = sB1.id

  // A: 3 lessons (2 completed) across two subjects — each under its own chapter
  const [chA1, chA2, chB1] = await Promise.all([
    db.chapter.create({ data: { userId: A.id, subjectId: sA1.id, title: 'A-Ch1', order: 1 } }),
    db.chapter.create({ data: { userId: A.id, subjectId: sA2.id, title: 'A-Ch2', order: 1 } }),
    db.chapter.create({ data: { userId: B.id, subjectId: sB1.id, title: 'B-Ch1', order: 1 } }),
  ])

  await db.lesson.createMany({
    data: [
      { userId: A.id, subjectId: sA1.id, chapterId: chA1.id, title: 'A-L1', status: 'COMPLETED', order: 1, completedAt: new Date() },
      { userId: A.id, subjectId: sA1.id, chapterId: chA1.id, title: 'A-L2', status: 'COMPLETED', order: 2, completedAt: new Date() },
      { userId: A.id, subjectId: sA2.id, chapterId: chA2.id, title: 'A-L3', status: 'NOT_STARTED', order: 1 },
    ],
  })

  // B: 1 lesson, not completed
  await db.lesson.create({
    data: { userId: B.id, subjectId: sB1.id, chapterId: chB1.id, title: 'B-L1', status: 'NOT_STARTED', order: 1 },
  })

  // Sessions — A today, B today at a different hour
  await db.studySession.create({
    data: {
      userId: A.id,
      subjectId: sA1.id,
      date: day(0),
      startTime: '08:00',
      endTime: '09:00',
      durationMinutes: 60,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })
  const sB = await db.studySession.create({
    data: {
      userId: B.id,
      subjectId: sB1.id,
      date: day(0),
      startTime: '17:00',
      endTime: '18:00',
      durationMinutes: 60,
      status: 'SCHEDULED',
    },
  })
  sessionB1 = sB.id
})

afterAll(async () => {
  // Delete ONLY the test-owned rows (children first where FKs require it).
  await db.studySession.deleteMany({ where: { userId: { in: [A.id, B.id] } } })
  await db.lesson.deleteMany({ where: { userId: { in: [A.id, B.id] } } })
  await db.chapter.deleteMany({ where: { userId: { in: [A.id, B.id] } } })
  await db.subject.deleteMany({ where: { userId: { in: [A.id, B.id] } } })
  await db.activityLog.deleteMany({ where: { userId: { in: [A.id, B.id] } } })
  await db.user.deleteMany({ where: { id: { in: [A.id, B.id] } } })
})

describe('student isolation', () => {
  it('subjectProgress only counts the owner\'s lessons', async () => {
    const pa = await subjectProgress(A.id, subjectA1)
    expect(pa.total).toBe(2)
    expect(pa.completed).toBe(2)
    expect(pa.percent).toBe(100)

    // B sees zero lessons for A's subject — not A's numbers.
    const pb = await subjectProgress(B.id, subjectA1)
    expect(pb.total).toBe(0)
    expect(pb.completed).toBe(0)
    expect(pb.percent).toBe(0)
  })

  it('overallProgress never mixes two students', async () => {
    const pa = await overallProgress(A.id)
    expect(pa.total).toBe(3)
    expect(pa.completed).toBe(2)
    expect(pa.bySubject).toHaveLength(2)

    const pb = await overallProgress(B.id)
    expect(pb.total).toBe(1)
    expect(pb.completed).toBe(0)
    expect(pb.bySubject).toHaveLength(1)
    expect(pb.bySubject[0].subjectId).toBe(subjectB1)
  })

  it('progressSummary is scoped to the owner', async () => {
    const sa = await progressSummary(A.id)
    expect(sa.total).toBe(3)
    expect(sa.completed).toBe(2)

    const sb = await progressSummary(B.id)
    expect(sb.total).toBe(1)
    expect(sb.completed).toBe(0)
  })

  it('hasOverlap ignores another student\'s session', async () => {
    // B has 17:00–18:00 today. A can book it freely.
    expect(await hasOverlap(A.id, day(0), '17:30', '18:30')).toBe(false)
    // B cannot double-book their own slot.
    expect(await hasOverlap(B.id, day(0), '17:30', '18:30')).toBe(true)
  })

  it('analytics aggregate per user only', async () => {
    const a = await getAnalytics(A.id, '30d', 'en')
    expect(a.totals.completedSessions).toBe(1)
    expect(a.kpis.totalStudyTime).toBe(60)

    const b = await getAnalytics(B.id, '30d', 'en')
    expect(b.totals.completedSessions).toBe(0)
    expect(b.kpis.totalStudyTime).toBe(0)
    expect(b.totals.sessions).toBe(1) // B's own SCHEDULED row is visible to B
  })

  it('ownership filters reject foreign ids at the query level', async () => {
    const foreign = await db.subject.findFirst({ where: { id: subjectA1, userId: B.id } })
    expect(foreign).toBeNull()

    const own = await db.subject.findFirst({ where: { id: subjectA1, userId: A.id } })
    expect(own).not.toBeNull()

    const foreignSession = await db.studySession.findFirst({
      where: { id: sessionB1, userId: A.id },
    })
    expect(foreignSession).toBeNull()
  })
})
