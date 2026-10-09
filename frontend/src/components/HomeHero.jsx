import Wordmark from './Wordmark.jsx'

// The banner at the top of the start page: title, headline, a button to the form, and a tiled picture drawn here (not a photo).
function startNow() {
  const goal = document.getElementById('goal')
  if (!goal) return
  goal.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => goal.focus({ preventScroll: true }), 450)
}

const RING = 2 * Math.PI * 34

export default function HomeHero() {
  return (
    <section className="home-hero" aria-label="CareerMap">
      <div className="hh-text">
        <p className="hh-pill"><svg className="pill-route" width="32" height="12" viewBox="0 0 32 12" aria-hidden="true"><defs><linearGradient id="pill-g" x1="5" y1="0" x2="27" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#4fe6cb" /><stop offset="0.5" stopColor="#a78bff" /><stop offset="1" stopColor="#ffc94d" /></linearGradient></defs><line x1="5" y1="6" x2="27" y2="6" stroke="url(#pill-g)" strokeWidth="2.4" strokeLinecap="round" /><circle cx="5" cy="6" r="3.6" fill="#1b1f2a" stroke="#4fe6cb" strokeWidth="1.8" /><circle cx="27" cy="6" r="4" fill="#ffc94d" /></svg> AI career roadmaps, built backwards</p>
        <p className="hh-brand"><Wordmark className="hh-word" /></p>
        <h1>Your dream job, <span className="grad">reverse-engineered.</span></h1>
        <p className="hh-lead">Tell us the exact role. We build your skill tree and tell you the date you could be ready, then it re-plans live as your hours and skills change.</p>
        <button type="button" className="primary hh-cta" onClick={startNow}>Get started <span className="hh-knob" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></span></button>
        <ul className="hh-points">
          <li>No sign-up</li>
          <li>Saved only in your browser</li>
          <li>Re-plans live</li>
        </ul>
      </div>

      <div className="hh-art" aria-hidden="true">
        <div className="hh-tile t-ring">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" className="hh-ring-bg" />
            <circle cx="40" cy="40" r="34" className="hh-ring-fg" strokeDasharray={RING} strokeDashoffset={RING * 0.22} transform="rotate(-90 40 40)" />
            <text x="40" y="45" textAnchor="middle" className="hh-ring-num">78%</text>
          </svg>
        </div>
        <div className="hh-tile t-done"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="20" className="hh-done" /><path d="M21 30 l7 7 l13 -15" className="hh-tick" /></svg></div>
        <div className="hh-tile t-tree">
          <svg viewBox="0 0 120 120">
            <g className="hh-line"><path d="M30 92 L60 56" /><path d="M90 92 L60 56" /><path d="M60 56 L60 24" className="hh-lit" /></g>
            <circle cx="30" cy="92" r="14" className="hh-done" /><circle cx="90" cy="92" r="14" className="hh-done" />
            <circle cx="60" cy="56" r="14" className="hh-ready" /><circle cx="60" cy="24" r="14" className="hh-locked" />
          </svg>
        </div>
        <div className="hh-tile t-bars"><svg viewBox="0 0 80 60"><rect x="8" y="34" width="12" height="20" rx="3" /><rect x="28" y="22" width="12" height="32" rx="3" /><rect x="48" y="10" width="12" height="44" rx="3" className="hi" /></svg></div>
        <div className="hh-tile t-lock"><svg viewBox="0 0 60 60"><rect x="16" y="28" width="28" height="20" rx="5" /><path d="M22 28 v-6 a8 8 0 0 1 16 0 v6" /></svg></div>
        <div className="hh-tile t-goal"><svg viewBox="0 0 100 60"><circle cx="30" cy="30" r="20" className="g1" /><circle cx="30" cy="30" r="12" className="g2" /><circle cx="30" cy="30" r="4" className="g3" /><path d="M52 22 h34 M52 32 h26 M52 42 h30" /></svg></div>
      </div>
    </section>
  )
}
