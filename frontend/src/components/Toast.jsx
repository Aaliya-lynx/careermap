import { useEffect } from 'react'

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.07,
  hue: (i * 47) % 360,
  drift: ((i * 29) % 60) - 30,
}))

// A short message at the bottom of the screen. With `celebrate`, a burst of confetti falls too.
export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDone, toast.celebrate ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [toast, onDone])

  if (!toast) return null
  return (
    <>
      {toast.celebrate && (
        <div className="confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, background: `hsl(${c.hue} 90% 62%)`, '--drift': `${c.drift}px` }} />
          ))}
        </div>
      )}
      <div className={`toast ${toast.celebrate ? 'is-celebrate' : ''}`} role="status" aria-live="polite">
        <span>{toast.text}</span>
        <button type="button" className="icon-button" onClick={onDone} aria-label="Dismiss message">✕</button>
      </div>
    </>
  )
}
