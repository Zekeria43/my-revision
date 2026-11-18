import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/export/data — a complete JSON export of the caller's own data.
 * Nothing outside the authenticated user's rows is included.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const [
      profile,
      prefs,
      years,
      semesters,
      specializations,
      subjects,
      chapters,
      lessons,
      sessions,
      availability,
      exams,
      notes,
      resources,
      notifications,
      activity,
      reschedules,
      timers,
    ] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: user.id } }),
      db.studyPreference.findUnique({ where: { userId: user.id } }),
      db.academicYear.findMany({ where: { userId: user.id } }),
      db.semester.findMany({ where: { userId: user.id } }),
      db.specialization.findMany({ where: { userId: user.id } }),
      db.subject.findMany({ where: { userId: user.id } }),
      db.chapter.findMany({ where: { userId: user.id } }),
      db.lesson.findMany({ where: { userId: user.id } }),
      db.studySession.findMany({ where: { userId: user.id } }),
      db.studyAvailability.findMany({ where: { userId: user.id } }),
      db.exam.findMany({ where: { userId: user.id } }),
      db.note.findMany({ where: { userId: user.id } }),
      db.resource.findMany({ where: { userId: user.id } }),
      db.notification.findMany({ where: { userId: user.id } }),
      db.activityLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
      db.reschedulingHistory.findMany({ where: { userId: user.id } }),
      db.studyTimerRecord.findMany({ where: { userId: user.id } }),
    ])

    const payload = {
      format: 'marevision-export/v1',
      exportedAt: new Date().toISOString(),
      // Credentials are never exported.
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
      },
      profile,
      preferences: prefs,
      academicYears: years,
      semesters,
      specializations,
      subjects,
      chapters,
      lessons,
      studySessions: sessions,
      availability,
      exams,
      notes,
      resources,
      notifications,
      activityLog: activity,
      reschedulingHistory: reschedules,
      timerRecords: timers,
    }

    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="marevision-export-${stamp}.json"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[export/data] failed', e)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
