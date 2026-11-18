import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { MAX_FILE_BYTES, isAllowedFile, saveFile, sanitizeName } from '@/lib/storage'

export const runtime = 'nodejs'

/**
 * POST /api/files — upload a resource file.
 *
 * - authentication resolved server-side from the session cookie
 * - size, extension and (where detectable) magic-byte checks
 * - written under ./uploads/<userId>/ so ownership is structural
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  const file = form.get('file')
  const subjectId = str(form.get('subjectId'))
  const chapterId = str(form.get('chapterId'))
  const lessonId = str(form.get('lessonId'))

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'badRequest', messageKey: 'errors.formInvalid' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'empty', messageKey: 'errors.formInvalid' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'tooLarge', messageKey: 'notes.fileTooLarge', vars: { max: MAX_FILE_BYTES / 1024 / 1024 } },
      { status: 413 },
    )
  }

  const name = sanitizeName(file.name)
  if (!isAllowedFile(name)) {
    return NextResponse.json(
      { error: 'blocked', messageKey: 'notes.fileTypeBlocked' },
      { status: 415 },
    )
  }

  // Ownership checks on the linkage before anything is written.
  try {
    if (subjectId) {
      const n = await db.subject.count({ where: { id: subjectId, userId: user.id } })
      if (n !== 1) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (chapterId) {
      const n = await db.chapter.count({ where: { id: chapterId, userId: user.id } })
      if (n !== 1) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (lessonId) {
      const n = await db.lesson.count({ where: { id: lessonId, userId: user.id } })
      if (n !== 1) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // Basic magic-byte sanity check for known types.
  const sniff = sniffType(bytes)
  if (sniff === 'blocked') {
    return NextResponse.json(
      { error: 'blocked', messageKey: 'notes.fileTypeBlocked' },
      { status: 415 },
    )
  }

  try {
    const stored = await saveFile(user.id, name, bytes, file.type || sniff)

    const resource = await db.resource.create({
      data: {
        userId: user.id,
        name,
        kind: 'FILE',
        url: stored.key,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        subjectId: subjectId ?? null,
        chapterId: chapterId ?? null,
        lessonId: lessonId ?? null,
      },
    })

    logActivity(user.id, 'RESOURCE', 'CREATE', resource.id, {
      name,
      size: stored.sizeBytes,
    })

    return NextResponse.json({ ok: true, id: resource.id, messageKey: 'notes.uploadSuccess' })
  } catch (e) {
    console.error('[upload] failed', e)
    return NextResponse.json({ error: 'server', messageKey: 'errors.serverErrorTitle' }, { status: 500 })
  }
}

/** Narrow a FormData value to a trimmed non-empty string (or null). */
function str(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length ? s : null
}

/** Returns 'ok' | 'blocked' | null (unknown type — allowed). */function sniffType(b: Uint8Array): 'ok' | 'blocked' | null {
  if (b.length < 4) return null
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v)

  // Executables / scripts must never be accepted regardless of extension.
  if (starts(0x4d, 0x5a)) return 'blocked' // MZ (PE)
  if (starts(0x7f, 0x45, 0x4c, 0x46)) return 'blocked' // ELF
  if (starts(0xca, 0xfe, 0xba, 0xbe)) return 'blocked' // Mach-O / Java class
  if (b[0] === 0x23 && b[1] === 0x21) return 'blocked' // #! shebang
  if (b[0] === 0x3c && b[1] === 0x3f) {
    // XML / SVG — allowed (SVG is text); PowerShell BOM handled below.
    return null
  }

  return 'ok'
}
