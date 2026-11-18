/**
 * Generates PNG app icons (192 / 512 / maskable-512 / apple-touch) from pure
 * Node — no image dependencies. Renders the SAME bubbly mark as
 * public/icons/icon.svg: blue→violet gradient tile, floating bubbles, an
 * open book, and a gold progress ring with a check.
 *
 * Run: npm run pwa:icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const OUT = path.join(process.cwd(), 'public', 'icons')
mkdirSync(OUT, { recursive: true })

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t)
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]

/* ── design-space palette (matches icon.svg) ── */
const BG_A = [79, 139, 255] // #4f8bff
const BG_B = [124, 58, 237] // #7c3aed
const PAGE_L = [255, 255, 255]
const PAGE_R = [219, 231, 255] // #dbe7ff
const GUTTER = [30, 64, 175] // #1e40af
const LINE = [147, 180, 247] // #93b4f7
const RING_A = [252, 211, 77] // #fcd34d
const RING_B = [249, 115, 22] // #f97316
const WHITE = [255, 255, 255]

/**
 * Renders the mark. Content is laid out in a 512 design space and scaled
 * into the content box (size × (1 − 2·pad)) so maskable icons keep a safe
 * zone. `rounded` controls the tile corners (apple-touch needs a full square).
 */
function render(size, { rounded, pad }) {
  const buf = Buffer.alloc(size * size * 4)

  // design → pixel scale (design content spans 64…448 → 384 units)
  const scale = (size * (1 - pad * 2)) / 384
  const toPx = (d) => (d - 256) * scale + size / 2

  const r = rounded ? size * 0.235 : 0

  const insideRound = (x, y) => {
    if (!rounded) return true
    const rx = Math.min(x, size - 1 - x)
    const ry = Math.min(y, size - 1 - y)
    if (rx >= r || ry >= r) return true
    const dx = r - rx
    const dy = r - ry
    return dx * dx + dy * dy <= r * r
  }

  /* ── background: blue → violet diagonal ── */
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (!insideRound(x, y)) {
        buf[i + 3] = 0
        continue
      }
      const t = (x + y) / (2 * size)
      const c = mix(BG_A, BG_B, t)
      buf[i] = c[0]
      buf[i + 1] = c[1]
      buf[i + 2] = c[2]
      buf[i + 3] = 255
    }
  }

  /* ── source-over painter ── */
  const blend = (px, py, rgb, a = 1) => {
    const x = Math.round(px)
    const y = Math.round(py)
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    if (buf[i + 3] === 0) return
    buf[i] = Math.round(buf[i] * (1 - a) + rgb[0] * a)
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + rgb[1] * a)
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + rgb[2] * a)
    buf[i + 3] = 255
  }

  const disc = (cx, cy, r, rgb, a = 1) => {
    const C = toPx(cx)
    const Cy = toPx(cy)
    const R = r * scale
    for (let y = Math.floor(Cy - R); y <= Cy + R; y++) {
      for (let x = Math.floor(C - R); x <= C + R; x++) {
        const dx = x - C
        const dy = y - Cy
        if (dx * dx + dy * dy <= R * R) blend(x, y, rgb, a)
      }
    }
  }

  /* ── floating bubbles ── */
  disc(86, 132, 20, WHITE, 0.3)
  disc(130, 452, 13, WHITE, 0.35)
  disc(430, 418, 24, WHITE, 0.22)
  disc(418, 120, 11, RING_A, 0.95)

  /* ── open book: two pages with sloped tops/bottoms ── */
  const page = (x0, yTop0, yBot0, rgb, alpha) => {
    // u runs 0→1 across 148 design units; edges slope by 12 units.
    for (let dx = 0; dx < 148; dx += 0.5) {
      const u = dx / 148
      const top = yTop0 + 12 * u
      const bot = yBot0 + 12 * u
      const px = toPx(x0 + dx)
      const y1 = Math.round(toPx(top))
      const y2 = Math.round(toPx(bot))
      for (let y = y1; y <= y2; y++) {
        blend(px, y, rgb, alpha)
        blend(px + 1, y, rgb, alpha) // half-step anti-alias on the vertical fill
      }
    }
  }
  page(104, 330, 426, PAGE_L, 1)
  page(260, 318, 414, PAGE_R, 0.85)

  /* gutter */
  {
    const x0 = toPx(250)
    const x1 = toPx(262)
    for (let y = Math.round(toPx(318)); y <= Math.round(toPx(426)); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) blend(x, y, GUTTER, 0.9)
    }
  }

  /* page lines (short rounded strokes) */
  const stroke = (x0, y0, x1, y1, w, rgb, a = 1) => {
    const ax = toPx(x0)
    const ay = toPx(y0)
    const bx = toPx(x1)
    const by = toPx(y1)
    const hw = (w * scale) / 2
    const minx = Math.floor(Math.min(ax, bx) - hw)
    const maxx = Math.ceil(Math.max(ax, bx) + hw)
    const miny = Math.floor(Math.min(ay, by) - hw)
    const maxy = Math.ceil(Math.max(ay, by) + hw)
    const vx = bx - ax
    const vy = by - ay
    const len2 = vx * vx + vy * vy || 1
    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        let t = ((x - ax) * vx + (y - ay) * vy) / len2
        t = Math.max(0, Math.min(1, t))
        const dx = x - (ax + t * vx)
        const dy = y - (ay + t * vy)
        if (dx * dx + dy * dy <= hw * hw) blend(x, y, rgb, a)
      }
    }
  }
  stroke(136, 356, 232, 348, 10, LINE)
  stroke(136, 392, 232, 384, 10, LINE)
  stroke(376, 356, 280, 348, 10, LINE)
  stroke(376, 392, 280, 384, 10, LINE)

  /* ── progress ring: 70% gold arc on a translucent white track ── */
  {
    const cx = toPx(256)
    const cy = toPx(188)
    const R = 78 * scale
    const hw = (22 * scale) / 2
    const R2 = R + hw
    const R1 = R - hw
    for (let y = Math.floor(cy - R2); y <= cy + R2; y++) {
      for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
        const dx = x - cx
        const dy = y - cy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < R1 || d > R2) continue
        // angle from top, clockwise (screen y grows downward)
        let ang = Math.atan2(dy, dx) + Math.PI / 2
        if (ang < 0) ang += Math.PI * 2
        const frac = ang / (Math.PI * 2)
        if (frac <= 0.7) blend(x, y, mix(RING_A, RING_B, frac / 0.7), 1)
        else blend(x, y, WHITE, 0.38)
      }
    }
  }

  /* ── check mark ── */
  stroke(224, 190, 246, 212, 20, WHITE)
  stroke(246, 212, 288, 166, 20, WHITE)

  return buf
}

const jobs = [
  ['icon-192.png', 192, { rounded: true, pad: 0.14 }],
  ['icon-512.png', 512, { rounded: true, pad: 0.14 }],
  ['maskable-512.png', 512, { rounded: false, pad: 0.26 }],
  ['apple-touch-icon.png', 180, { rounded: false, pad: 0.14 }],
]

for (const [name, size, opts] of jobs) {
  writeFileSync(path.join(OUT, name), encodePng(size, render(size, opts)))
  console.log(`✓ ${name} (${size}×${size})`)
}
