import { KINDS, STATUS_LABEL } from '../format.js'

// The same plan as the map, as a plain list: easier to read on a phone, and fully usable with a keyboard or screen reader.
export default function Outline({ roadmap, plan, known, selectedId, onSelect, onToggleKnown }) {
  const phases = [...new Set(roadmap.nodes.map((n) => n.phase))].sort((a, b) => a - b)
  return (
    <div className="outline">
      {phases.map((phase) => {
        const steps = roadmap.nodes.filter((n) => n.phase === phase)
        const info = plan.phases.find((p) => p.phase === phase)
        return (
          <section key={phase} className={`outline-phase ${info?.complete ? 'is-complete' : ''}`} aria-label={roadmap.phases[phase - 1]}>
            <h3>{phase}. {roadmap.phases[phase - 1] ?? `Phase ${phase}`}{info?.complete ? ' ✓' : ''}</h3>
            <ul>
              {steps.map((step) => {
                const s = plan.nodes[step.id]
                const implied = s.status === 'implied'
                const checked = known.includes(step.id) || implied
                return (
                  <li key={step.id} className={`outline-step is-${s.status} ${selectedId === step.id ? 'is-selected' : ''}`}>
                    <input type="checkbox" id={`known-${step.id}`} checked={checked} disabled={implied}
                      onChange={() => onToggleKnown(step.id)} aria-label={`I already know ${step.title}`} />
                    <button type="button" className="outline-open" onClick={() => onSelect(step.id)}>
                      <span className="outline-title">{KINDS[step.kind]?.icon} {step.title}</span>
                      <span className="outline-meta">
                        {KINDS[step.kind]?.label} · {step.hours}h · {STATUS_LABEL[s.status]}
                        {s.start_week != null && ` · week ${Math.floor(s.start_week) + 1}`}
                        {s.critical && ' · ★ longest chain'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
