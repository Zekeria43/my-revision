import { db } from './db'

export type EntityType =
  | 'USER'
  | 'YEAR'
  | 'SEMESTER'
  | 'SPECIALIZATION'
  | 'SUBJECT'
  | 'CHAPTER'
  | 'LESSON'
  | 'SESSION'
  | 'EXAM'
  | 'NOTE'
  | 'RESOURCE'
  | 'TIMER'

export type ActivityAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'UNARCHIVE'
  | 'COMPLETE'
  | 'REOPEN'
  | 'RESCHEDULE'
  | 'LOGIN'
  | 'REGISTER'

/**
 * Append-only activity log. Writes are fire-and-forget so a logging failure
 * never breaks the user's action, and history is never silently rewritten.
 */
export function logActivity(
  userId: string,
  entityType: EntityType,
  action: ActivityAction,
  entityId?: string,
  meta: Record<string, unknown> = {},
) {
  void db.activityLog
    .create({
      data: {
        userId,
        entityType,
        entityId: entityId ?? null,
        action,
        meta: JSON.stringify(meta).slice(0, 4000),
      },
    })
    .catch((e) => console.error('[activity] write failed', e))
}

export function auditAdmin(
  adminId: string,
  action: string,
  meta: Record<string, unknown> = {},
  targetId?: string,
) {
  void db.adminAuditLog
    .create({
      data: {
        adminId,
        targetId: targetId ?? null,
        action,
        meta: JSON.stringify(meta).slice(0, 4000),
      },
    })
    .catch((e) => console.error('[audit] write failed', e))
}
