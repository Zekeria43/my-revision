/**
 * The brand mark — the same bubbly design as public/icons/icon.svg:
 * blue→violet tile, floating bubbles, an open book and a gold progress
 * ring with a check. Used in the landing header, auth pages and app shell
 * so the identity is identical everywhere (PWA icon included).
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="مراجعتي"
    >
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8bff" />
          <stop offset=".5" stopColor="#1b6af5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="lg-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="lg-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe7ff" />
        </linearGradient>
        <radialGradient id="lg-gloss" cx=".3" cy=".18" r=".9">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".35" />
          <stop offset=".55" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="120" fill="url(#lg-bg)" />
      <rect width="512" height="512" rx="120" fill="url(#lg-gloss)" />

      {/* floating bubbles */}
      <circle cx="86" cy="132" r="20" fill="#fff" opacity=".3" />
      <circle cx="130" cy="452" r="13" fill="#fff" opacity=".35" />
      <circle cx="430" cy="418" r="24" fill="#fff" opacity=".22" />
      <circle cx="418" cy="120" r="11" fill="#fcd34d" opacity=".95" />

      {/* open book */}
      <path d="M104 330c42-28 100-32 148-12v96c-48-20-106-16-148 12z" fill="url(#lg-page)" />
      <path d="M408 330c-42-28-100-32-148-12v96c48-20 106-16 148 12z" fill="url(#lg-page)" opacity=".85" />
      <path d="M256 318v108" stroke="#1e40af" strokeWidth="12" strokeLinecap="round" opacity=".9" />
      <g stroke="#93b4f7" strokeWidth="10" strokeLinecap="round" fill="none">
        <path d="M136 356c30-16 66-18 96-8" />
        <path d="M136 392c30-16 66-18 96-8" />
        <path d="M376 356c-30-16-66-18-96-8" />
        <path d="M376 392c-30-16-66-18-96-8" />
      </g>

      {/* progress bubble: ring + check */}
      <circle cx="256" cy="188" r="92" fill="#0b3fa8" opacity=".28" />
      <circle cx="256" cy="188" r="78" fill="none" stroke="#ffffff" strokeOpacity=".38" strokeWidth="22" />
      <circle
        cx="256"
        cy="188"
        r="78"
        fill="none"
        stroke="url(#lg-ring)"
        strokeWidth="22"
        strokeLinecap="round"
        strokeDasharray="490"
        strokeDashoffset="147"
        transform="rotate(-90 256 188)"
      />
      <path
        d="M224 190l22 22 42-46"
        fill="none"
        stroke="#fff"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
