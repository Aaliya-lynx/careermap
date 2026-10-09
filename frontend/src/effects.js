// Small touch feedback for buttons: a ripple where you press, and a very light buzz on phones.
// Both are skipped for people who asked their device to reduce motion.
const RIPPLE = '.ghost, .secondary, .primary, .tool, .sections button, .viewbar button, .filter-chip, .pager-dots button, .hh-cta'

export function installButtonEffects() {
  if (typeof window === 'undefined') return
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  document.addEventListener('pointerdown', (event) => {
    if (calm?.matches) return
    const button = event.target.closest?.(RIPPLE)
    if (!button || button.disabled) return
    if (event.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(8)
    const box = button.getBoundingClientRect()
    const size = Math.max(box.width, box.height) * 2
    const ripple = document.createElement('span')
    ripple.className = 'cm-ripple'
    ripple.setAttribute('aria-hidden', 'true')
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - box.left - size / 2}px;top:${event.clientY - box.top - size / 2}px`
    button.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
  }, { passive: true })
}
