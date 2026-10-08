import { useEffect } from 'react'
import { readyByDate } from '../format.js'

// A list of every roadmap saved in this browser.
export default function Library({ items, activeId, onOpen, onDelete, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="My roadmaps">
        <div className="panel-top">
          <h2>My roadmaps</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted">Saved only in this browser. Clearing your browser data removes them, so download the ones you want to keep.</p>
        {items.length === 0 ? <p className="callout">Nothing saved yet. Every roadmap you build appears here.</p> : (
          <ul className="saved-list">
            {items.map((item) => (
              <li key={item.id} className={item.id === activeId ? 'is-active' : ''}>
                <button type="button" className="saved-open" onClick={() => onOpen(item.id)}>
                  <span className="saved-title">{item.title || item.goal}</span>
                  <span className="muted saved-meta">
                    {item.summary ? `Ready by ${item.summary.weeks_needed === 0 ? 'today' : readyByDate(item.summary.weeks_needed)} · ${item.summary.percent_ready}% ready` : 'Not planned yet'}
                    {' · '}{new Date(item.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {item.summary && <span className="saved-bar" aria-hidden="true"><span style={{ width: `${item.summary.percent_ready}%` }} /></span>}
                </button>
                <button type="button" className="ghost" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.title || item.goal}`}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
