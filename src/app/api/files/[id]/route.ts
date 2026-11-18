import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { readFileByKey } from '@/lib/storage'

export const runtime = 'nodejs'

/**
 * GET /api/files/[id] — download one of the caller's resource files.
 *
 * The id is a resource row id, NOT a filesystem path: ownership is verified
 * in the database and only then is the stored key resolved (which itself
 * refuses path traversal). A user can never read another user's bytes.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const resource = await db.resource.findFirst({
    where: { id, userId: user.id, kind: 'FILE' },
  })
  if (!resource) return NextResponse.json({ error: 'notFound' }, { status: 404 })

  const bytes = await readFileByKey(resource.url)
  if (!bytes) return NextResponse.json({ error: 'notFound' }, { status: 404 })

  const headerName = resource.name.replace(/["\\]/g, '_')
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': resource.mimeType || 'application/octet-stream',
      'Content-Length': String(resource.sizeBytes || bytes.byteLength),
      'Content-Disposition': `attachment; filename="${headerName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
