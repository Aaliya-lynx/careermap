// The CareerMap wordmark, hand-drawn as monoline letters with rounded ends (like a route line).
// Each letter draws itself in turn on load; the animation is skipped for reduced-motion users.
export default function Wordmark({ className = '' }) {
  return (
    <svg className={`cm-word ${className}`} viewBox="0 0 446 80" role="img" aria-label="CareerMap" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8">
      <defs>
        <linearGradient id="cm-wa" x1="0" y1="0" x2="275" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9f6ee" />
        </linearGradient>
        <linearGradient id="cm-wb" x1="275" y1="0" x2="446" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b79cff" />
          <stop offset="0.5" stopColor="#ff8fc7" />
          <stop offset="1" stopColor="#ffc94d" />
        </linearGradient>
        <linearGradient id="cm-wc" x1="0" y1="52" x2="0" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4fe6cb" />
          <stop offset="0.55" stopColor="#b79cff" />
          <stop offset="1" stopColor="#ffc94d" />
        </linearGradient>
      </defs>
      <path className="cm-l" style={{ '--i': 0 }} pathLength="1" stroke="url(#cm-wc)" d="M45.8 44.1 A24 24 0 1 1 45.8 11.9" />
      <g className="cm-node" strokeWidth="3">
        <circle cx="45.8" cy="44.1" r="5.6" fill="#0f1f2e" stroke="#4fe6cb" />
        <g className="cm-goal">
          <circle cx="45.8" cy="11.9" r="8" fill="#ffc94d" stroke="#fff1c2" strokeWidth="2.2" />
          <circle cx="45.8" cy="11.9" r="4.2" fill="none" stroke="#b36a0a" strokeWidth="1.6" />
          <circle cx="45.8" cy="11.9" r="1.7" fill="#7a3f00" stroke="none" />
        </g>
      </g>
      <path className="cm-l" style={{ '--i': 1 }} pathLength="1" stroke="url(#cm-wa)" d="M65 36 A16 16 0 1 1 97 36 A16 16 0 1 1 65 36 M97 20 V52" />
      <path className="cm-l" style={{ '--i': 2 }} pathLength="1" stroke="url(#cm-wa)" d="M114 20 V52 M114 36 A16 16 0 0 1 130 20 H135" />
      <path className="cm-l" style={{ '--i': 3 }} pathLength="1" stroke="url(#cm-wa)" d="M149 36 H181 A16 16 0 1 0 176.3 47.3" />
      <path className="cm-l" style={{ '--i': 4 }} pathLength="1" stroke="url(#cm-wa)" d="M198 36 H230 A16 16 0 1 0 225.3 47.3" />
      <path className="cm-l" style={{ '--i': 5 }} pathLength="1" stroke="url(#cm-wa)" d="M247 20 V52 M247 36 A16 16 0 0 1 263 20 H268" />
      <path className="cm-l" style={{ '--i': 6 }} pathLength="1" stroke="url(#cm-wb)" d="M282 52 V4 L306 47 L330 4 V52" />
      <path className="cm-l" style={{ '--i': 7 }} pathLength="1" stroke="url(#cm-wb)" d="M349 36 A16 16 0 1 1 381 36 A16 16 0 1 1 349 36 M381 20 V52" />
      <path className="cm-l" style={{ '--i': 8 }} pathLength="1" stroke="url(#cm-wb)" d="M402 20 V72 M402 36 A16 16 0 1 1 434 36 A16 16 0 1 1 402 36" />
    </svg>
  )
}
