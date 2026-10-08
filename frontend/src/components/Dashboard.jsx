import { KINDS } from '../format.js'

function Ring({ percent }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  return (
    <svg className="ring" viewBox="0 0 110 110" role="img" aria-label={`${percent} percent ready`}>
      <circle cx="55" cy="55" r={radius} className="ring-track" />
      <circle cx="55" cy="55" r={radius} className="ring-fill" strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)} transform="rotate(-90 55 55)" />
      <text x="55" y="53" textAnchor="middle" className="ring-number">{percent}%</text>
      <text x="55" y="71" textAnchor="middle" className="ring-label">ready</text>
    </svg>
  )
}

function StepButton({ step, onSelect, children }) {
  return <button type="button" className="mini-step" onClick={() => onSelect(step.id)}>{children ?? step.title}</button>
}

export default function Dashboard({ roadmap, plan, onSelect }) {
  const byId = Object.fromEntries(roadmap.nodes.map((n) => [n.id, n]))
  const counted = roadmap.nodes.filter((n) => plan.nodes[n.id].status !== 'stretch')
  const doneCount = counted.filter((n) => ['known', 'implied'].includes(plan.nodes[n.id].status)).length
  const thisWeek = plan.focus.this_week.map((id) => byId[id])
  const nextPhase = plan.phases.find((p) => !p.complete)

  const kindCounts = Object.keys(KINDS).map((kind) => ({ kind, count: counted.filter((n) => n.kind === kind).length })).filter((k) => k.count)
  const maxHours = Math.max(1, ...plan.phases.map((p) => p.total_hours))

  return (
    <section className="dash" aria-label="Dashboard">
      <article className="card card-progress">
        <h3>Progress</h3>
        <div className="progress-body">
          <Ring percent={plan.summary.percent_ready} />
          <p className="muted">{doneCount} of {counted.length} steps done or assumed known.{' '}
            {nextPhase ? <>Next milestone: finish <strong>{roadmap.phases[nextPhase.phase - 1] ?? `Phase ${nextPhase.phase}`}</strong>.</> : <strong>Every phase is complete.</strong>}
          </p>
        </div>
      </article>

      <article className="card">
        <h3>This week</h3>
        {thisWeek.length ? (
          <ul className="focus-list">
            {thisWeek.map((step) => (
              <li key={step.id}><StepButton step={step} onSelect={onSelect} /><span className="muted">{step.hours}h</span></li>
            ))}
          </ul>
        ) : <p className="muted">Nothing left to study. You are ready.</p>}
        <h4>Next 4 weeks</h4>
        <ol className="weeks">
          {plan.focus.timeline.map((ids, week) => (
            <li key={week}>
              <span className="week-name">Wk {week + 1}</span>
              <span className="week-items">
                {ids.length ? ids.map((id) => <StepButton key={id} step={byId[id]} onSelect={onSelect} />) : <span className="muted">free</span>}
              </span>
            </li>
          ))}
        </ol>
      </article>

      <article className="card">
        <h3>Hours by phase</h3>
        <ul className="bars">
          {plan.phases.map((p) => (
            <li key={p.phase}>
              <span className="bar-label">{roadmap.phases[p.phase - 1] ?? `Phase ${p.phase}`}</span>
              <span className="bar-track" role="img" aria-label={`${p.done_hours} of ${p.total_hours} hours done`}>
                <span className="bar-total" style={{ width: `${(p.total_hours / maxHours) * 100}%` }}>
                  <span className="bar-done" style={{ width: `${p.total_hours ? (p.done_hours / p.total_hours) * 100 : 0}%` }} />
                </span>
              </span>
              <span className="bar-value">{p.done_hours}/{p.total_hours}h</span>
            </li>
          ))}
        </ul>

        <h4>What the path is made of</h4>
        <div className="mix" role="img" aria-label={kindCounts.map((k) => `${k.count} ${KINDS[k.kind].label}`).join(', ')}>
          {kindCounts.map((k) => <span key={k.kind} className={`mix-${k.kind}`} style={{ flexGrow: k.count }} />)}
        </div>
        <ul className="mix-legend">
          {kindCounts.map((k) => <li key={k.kind}><i className={`dot mix-${k.kind}`} /> {KINDS[k.kind].label} · {k.count}</li>)}
        </ul>
      </article>
    </section>
  )
}
