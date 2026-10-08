import { useEffect, useRef } from 'react'
import { KINDS, STATUS_LABEL, assumedBecause } from '../format.js'

export default function SidePanel({ step, info, roadmap, known, completedAt, evidenceTitle, advice, onClose, onToggleKnown, onAdvice }) {
  const closeRef = useRef(null)
  useEffect(() => { closeRef.current?.focus() }, [step.id])
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kind = KINDS[step.kind] ?? KINDS.skill
  const isKnown = known.includes(step.id)
  const because = info.status === 'implied' ? assumedBecause(step.id, roadmap.nodes, known) : null
  const prerequisites = step.requires.map((id) => roadmap.nodes.find((n) => n.id === id)?.title).filter(Boolean)

  return (
    <aside className="panel" aria-label={`Details for ${step.title}`}>
      <div className="panel-top">
        <span className={`badge kind-${step.kind}`}>{kind.icon} {kind.label}</span>
        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close details">✕</button>
      </div>
      <h2>{step.title}</h2>
      <p className="muted">{step.hours} hours · {STATUS_LABEL[info.status]}{!step.essential && ' · optional'}
        {info.start_week != null && ` · weeks ${Math.floor(info.start_week) + 1}–${Math.max(Math.ceil(info.end_week), Math.floor(info.start_week) + 1)}`}</p>
      {step.why && <p>{step.why}</p>}
      {prerequisites.length > 0 && <p className="muted">Needs: {prerequisites.join(', ')}</p>}
      {evidenceTitle && <p className="callout">Counted from your certificate: <strong>{evidenceTitle}</strong> (self-reported, not verified).</p>}
      {completedAt && <p className="muted">Marked as known on {new Date(completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>}
      {info.critical && <p className="callout">This step is on your longest chain: finishing it sooner moves your ready-by date.</p>}
      {info.status === 'stretch' && <p className="callout warn">Left out of your plan because it does not fit your weeks budget.</p>}

      {info.status === 'implied' ? (
        <p className="callout">Assumed known because you know <strong>{because ?? 'a later step'}</strong>. Remove that step from your known list to change this.</p>
      ) : (
        <button type="button" className={isKnown ? 'secondary' : 'primary'} onClick={() => onToggleKnown(step.id)}>
          {isKnown ? 'Not known yet: put it back in my plan' : 'I already know this'}
        </button>
      )}

      <div className="advice">
        <h3>Make it real</h3>
        {!advice.data && (
          <button type="button" className="secondary" onClick={() => onAdvice(step)} disabled={advice.loading}>
            {advice.loading ? 'Thinking…' : 'Get a project idea and interview questions'}
          </button>
        )}
        {advice.error && <p className="callout warn" role="alert">{advice.error}</p>}
        {advice.data && (
          <>
            <h4>Weekend project: {advice.data.project.title}</h4>
            <p>{advice.data.project.description}</p>
            <p><a href={`https://github.com/search?q=${encodeURIComponent(advice.data.project.title)}&type=repositories`} target="_blank" rel="noreferrer">Find example projects on GitHub</a></p>
            {advice.data.interview_questions.length > 0 && (
              <>
                <h4>Interview questions</h4>
                <ol>{advice.data.interview_questions.map((q) => <li key={q}>{q}</li>)}</ol>
              </>
            )}
            {advice.data.search_terms.length > 0 && (
              <>
                <h4>Search for</h4>
                <ul className="terms">
                  {advice.data.search_terms.map((t) => (
                    <li key={t}><a href={`https://www.google.com/search?q=${encodeURIComponent(t)}`} target="_blank" rel="noreferrer">{t}</a></li>
                  ))}
                </ul>
              </>
            )}
            <p className="notice">✨ AI suggestion: confirm details with official sources.</p>
          </>
        )}
      </div>
    </aside>
  )
}
