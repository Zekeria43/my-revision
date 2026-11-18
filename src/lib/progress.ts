import { db } from './db'
import type { Prisma } from '@prisma/client'

/**
 * Progress calculations.
 * Every percentage is clamped to [0, 100] and never divides by zero.
 * Results are always derived from the live database — never cached in the
 * client and never hardcoded.
 */

export interface SubjectProgress {
  subjectId: string
  total: number
  completed: number
  inProgress: number
  needsRevision: number
  notStarted: number
  remaining: number
  percent: number
}

export interface OverallProgress extends SubjectProgress {
  subjectId: 'all'
  bySubject: SubjectProgress[]
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100))

function build(
  rows: { subjectId: string; status: string }[],
  subjectIds?: string[],
): SubjectProgress {
  const total = rows.length
  const completed = rows.filter((r) => r.status === 'COMPLETED').length
  const inProgress = rows.filter((r) => r.status === 'IN_PROGRESS').length
  const needsRevision = rows.filter((r) => r.status === 'NEEDS_REVISION').length
  const notStarted = rows.filter((r) => r.status === 'NOT_STARTED').length
  return {
    subjectId: subjectIds?.[0] ?? '',
    total,
    completed,
    inProgress,
    needsRevision,
    notStarted,
    remaining: total - completed,
    percent: total ? clamp((completed / total) * 100) : 0,
  }
}

/** Progress for one subject (safe when the subject has no lessons). */
export async function subjectProgress(userId: string, subjectId: string): Promise<SubjectProgress> {
  const rows = await db.lesson.findMany({
    where: { userId, subjectId, archivedAt: null },
    select: { subjectId: true, status: true },
  })
  const p = build(rows, [subjectId])
  p.subjectId = subjectId
  return p
}

/** Overall + per-subject progress for a user (optionally scoped to a semester). */
export async function overallProgress(
  userId: string,
  scope: { semesterId?: string } = {},
): Promise<OverallProgress> {
  const subjectWhere: Prisma.SubjectWhereInput = {
    userId,
    archivedAt: null,
    ...(scope.semesterId ? { semesterId: scope.semesterId } : {}),
  }

  const subjects = await db.subject.findMany({
    where: subjectWhere,
    select: { id: true },
  })
  const ids = subjects.map((s) => s.id)

  const rows = ids.length
    ? await db.lesson.findMany({
        where: { userId, subjectId: { in: ids }, archivedAt: null },
        select: { subjectId: true, status: true },
      })
    : []

  const bySubject: SubjectProgress[] = ids.map((id) => {
    const p = build(
      rows.filter((r) => r.subjectId === id),
      [id],
    )
    p.subjectId = id
    return p
  })

  const overall: OverallProgress = { ...build(rows), subjectId: 'all', bySubject }
  return overall
}

/** Raw counts used by the dashboard tiles. */
export async function progressSummary(userId: string) {
  const [total, completed, inProgress, needsRevision] = await Promise.all([
    db.lesson.count({ where: { userId, archivedAt: null } }),
    db.lesson.count({ where: { userId, archivedAt: null, status: 'COMPLETED' } }),
    db.lesson.count({ where: { userId, archivedAt: null, status: 'IN_PROGRESS' } }),
    db.lesson.count({ where: { userId, archivedAt: null, status: 'NEEDS_REVISION' } }),
  ])
  return {
    total,
    completed,
    inProgress,
    needsRevision,
    remaining: total - completed,
    percent: total ? clamp((completed / total) * 100) : 0,
  }
}
