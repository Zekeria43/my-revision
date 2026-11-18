import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Every literal message key referenced in src/ must exist in the message
 * catalog. The parity gate (scripts/build-messages.mjs) only proves that
 * the three locales agree with EACH OTHER — a key forgotten in all three
 * (like `common.year` once was) passes parity but fails at runtime with
 * MISSING_MESSAGE. This test closes that hole.
 */

const ROOT = join(__dirname, '..', '..', 'src')
const catalog = JSON.parse(readFileSync(join(__dirname, '..', '..', 'messages', 'ar.json'), 'utf8'))

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Extract dotted keys from the literal call sites that render messages. */
function extractKeys(source: string): string[] {
  const keys: string[] = []
  const patterns = [
    // t('namespace.key') / t("namespace.key")
    /\bt\(\s*['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)['"]/g,
    // type casts: state.messageKey as 'namespace.key'
    /\bas\s+['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)['"]/g,
    // action helpers: fail('namespace.key') / ok('namespace.key')
    /\b(?:fail|ok)\(\s*['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)['"]/g,
    // explicit messageKey fields: messageKey: 'namespace.key'
    /\bmessageKey:\s*['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)['"]/g,
  ]
  for (const re of patterns) {
    for (const m of source.matchAll(re)) keys.push(m[1])
  }
  return keys
}

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, catalog)
}

describe('message key usage (phase 3)', () => {
  const files = collectFiles(ROOT)

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('resolves every literal message key used in src/', () => {
    const missing = new Map<string, string[]>() // key -> files

    for (const file of files) {
      const rel = file.replace(ROOT, 'src').replace(/\\/g, '/')
      for (const key of new Set(extractKeys(readFileSync(file, 'utf8')))) {
        if (lookup(key) === undefined) {
          missing.set(key, [...(missing.get(key) ?? []), rel])
        }
      }
    }

    const report = [...missing.entries()]
      .map(([key, where]) => `${key}  ←  ${[...new Set(where)].join(', ')}`)
      .sort()
      .join('\n')

    expect(report, `missing message keys:\n${report}`).toBe('')
  })
})
