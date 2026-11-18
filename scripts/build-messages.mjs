/**
 * Ensures every locale exposes exactly the same message keys.
 * Fails the build when a translation is missing so no UI string falls back
 * to a raw key in production.
 */
import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'messages')
const locales = ['ar', 'fr', 'en']

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out.add(key)
  }
  return out
}

const maps = {}
for (const l of locales) {
  const file = path.join(dir, `${l}.json`)
  maps[l] = flatten(JSON.parse(fs.readFileSync(file, 'utf8')))
}

const base = maps.ar
let failed = false
for (const l of locales) {
  const missing = [...base].filter((k) => !maps[l].has(k))
  const extra = [...maps[l]].filter((k) => !base.has(k))
  if (missing.length) {
    console.error(`✗ ${l}.json is missing ${missing.length} key(s):`)
    missing.slice(0, 40).forEach((k) => console.error(`    - ${k}`))
    failed = true
  }
  if (extra.length) {
    console.error(`✗ ${l}.json has ${extra.length} key(s) not present in ar.json:`)
    extra.slice(0, 40).forEach((k) => console.error(`    + ${k}`))
    failed = true
  }
}

if (failed) {
  console.error('\nMessage parity check failed.')
  process.exit(1)
}

console.log(`✓ Message parity OK — ${base.size} keys × ${locales.length} locales`)
