import { createHash, randomBytes } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import path from 'path'

/**
 * Local file storage for user resources.
 *
 * Files live under ./uploads/<userId>/<unique>.<ext> and are NEVER served as
 * static assets — every read goes through an authenticated route that checks
 * ownership first. Swap this module for Supabase Storage by implementing the
 * same functions against the bucket (STORAGE_DRIVER=supabase).
 */

const ROOT = path.join(process.cwd(), 'uploads')

/** Max upload size (10 MB). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** Allow-list of extensions (checked after path sanitisation). */
const ALLOWED_EXT = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'txt', 'md', 'csv', 'json',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'rar', '7z',
  'mp3', 'mp4', 'webm', 'ogg',
])

const BLOCKED_EXT = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'js', 'jar', 'app', 'sh', 'ps1',
])

export function extensionOf(name: string): string {
  return path.extname(name).replace('.', '').toLowerCase()
}

export function isAllowedFile(name: string): boolean {
  const ext = extensionOf(name)
  if (!ext) return false
  if (BLOCKED_EXT.has(ext)) return false
  return ALLOWED_EXT.has(ext)
}

/** Rejects path traversal and control characters in a client-supplied name. */
export function sanitizeName(name: string): string {
  const base = path
    .basename(name)
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0)
      if (code < 32 || '<>:"/\\|?*'.includes(c)) return '_'
      return c
    })
    .join('')
  return base.trim().slice(0, 180) || 'file'
}

export interface StoredFile {
  /** Relative path stored in the DB (resource.url). */
  key: string
  absolutePath: string
  sizeBytes: number
  mimeType: string | null
}

export async function saveFile(
  userId: string,
  originalName: string,
  bytes: Uint8Array,
  mimeType: string | null,
): Promise<StoredFile> {
  const safe = sanitizeName(originalName)
  const ext = extensionOf(safe)
  const unique = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`
  const dir = path.join(ROOT, userId)
  await mkdir(dir, { recursive: true })
  const absolutePath = path.join(dir, unique)
  await writeFile(absolutePath, bytes)
  return {
    key: `${userId}/${unique}`,
    absolutePath,
    sizeBytes: bytes.byteLength,
    mimeType,
  }
}

/** Resolves a stored key to an absolute path, refusing traversal. */
export function resolveKey(key: string): string | null {
  const normalized = path.normalize(key)
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null
  const abs = path.join(ROOT, normalized)
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep
  if (!abs.startsWith(rootWithSep)) return null
  return abs
}

export async function readFileByKey(key: string): Promise<Buffer | null> {
  const abs = resolveKey(key)
  if (!abs) return null
  try {
    return await readFile(abs)
  } catch {
    return null
  }
}

export async function deleteFileByKey(key: string): Promise<void> {
  const abs = resolveKey(key)
  if (!abs) return
  await rm(abs, { force: true }).catch(() => undefined)
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
