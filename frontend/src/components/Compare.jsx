import { useState } from 'react'
import { compareRoles, createRoadmap } from '../api.js'
import { KINDS } from '../format.js'

const hoursOf = (nodes) => nodes.reduce((sum, n) => sum + n.hours, 0)

function StepCard({ step, side }) {
  const kind = KINDS[step.kind] ?? KINDS.skill
  return (
    <div className={`cmp-step ${side}`}>
      <span aria-hidden="true">{kind.icon}</span>
      <span><strong>{step.title}</strong><small>{kind.label} · {step.hours} h</small></span>
    </div>
  )
}

// Two dream roles side by side. The AI says which steps are really the same skill; the counting is plain code.
export default function Compare({ roadmap, others, hours }) {
  const [otherId, setOtherId] = useState('')
  const [typed, setTyped] = useState('')
  const [other, setOther] = useState(null)       // { title, nodes } of the second role
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function run(second) {
    setBusy('Comparing the two paths…')
    const data = await compareRoles({
      goal_a: roadmap.title || 'First role', steps_a: roadmap.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind })),
      goal_b: second.title || 'Second role', steps_b: second.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind })),
    })
    setOther(second)
    setResult(data)
  }

  async function go(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    try {
      if (typed.trim().length >= 3) {
        setBusy('Building the second roadmap (about 20 seconds)…')
        const built = await createRoadmap({ goal: typed.trim(), known_skills: [], hours_per_week: Number(hours) || 8, weeks_budget: null })
        await run({ title: built.roadmap.title || typed.trim(), nodes: built.roadmap.nodes })
      } else if (otherId) {
        const entry = others.find((e) => e.id === otherId)
        await run({ title: entry.roadmap.title || entry.goal, nodes: entry.roadmap.nodes })
      }
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy('')
    }
  }

  const ready = (typed.trim().length >= 3 || otherId) && !busy
  const a = roadmap.nodes
  const b = other?.nodes ?? []
  const pairs = result ? result.shared.filter((p) => a.some((n) => n.id === p.a) && b.some((n) => n.id === p.b)) : []
  const byA = Object.fromEntries(a.map((n) => [n.id, n]))
  const byB = Object.fromEntries(b.map((n) => [n.id, n]))
  const usedA = new Set(pairs.map((p) => p.a))
  const usedB = new Set(pairs.map((p) => p.b))
  const onlyA = a.filter((n) => !usedA.has(n.id))
  const onlyB = b.filter((n) => !usedB.has(n.id))
  const sharedHoursA = pairs.reduce((sum, p) => sum + byA[p.a].hours, 0)
  const sharedHoursB = pairs.reduce((sum, p) => sum + byB[p.b].hours, 0)
  const coverA = result && hoursOf(a) ? Math.round((100 * sharedHoursA) / hoursOf(a)) : 0
  const coverB = result && hoursOf(b) ? Math.round((100 * sharedHoursB) / hoursOf(b)) : 0

  return (
    <section className="compare" aria-label="Compare two dream roles">
      <form className="card cmp-form" onSubmit={go}>
        <h3>Compare two dream roles</h3>
        <p className="muted">See where two paths overlap, so you can do the shared steps first. Compare <strong>{roadmap.title}</strong> with another role.</p>
        <div className="cmp-pick">
          {others.length > 0 && (
            <div>
              <label htmlFor="cmp-saved">One of your saved roadmaps</label>
              <select id="cmp-saved" value={otherId} onChange={(e) => { setOtherId(e.target.value); setTyped('') }}>
                <option value="">Choose…</option>
                {others.map((e) => <option key={e.id} value={e.id}>{e.title || e.goal}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="cmp-typed">{others.length > 0 ? 'Or type another job' : 'Type the other job'}</label>
            <input id="cmp-typed" value={typed} onChange={(e) => { setTyped(e.target.value); setOtherId('') }} maxLength={200} placeholder="e.g. Data Scientist" autoComplete="off" />
          </div>
        </div>
        <button type="submit" className="primary" disabled={!ready}>{busy || 'Compare the two paths'}</button>
        {error && <p className="callout warn" role="alert">{error}</p>}
        <p className="notice">Typing a new job builds a second roadmap first, which takes about 20 seconds.</p>
      </form>

      {result && (
        <>
          <article className="card cmp-summary" aria-live="polite">
            <h3>Where they overlap</h3>
            <div className="cmp-bar" role="img" aria-label={`${onlyA.length} steps only for the first role, ${pairs.length} shared, ${onlyB.length} only for the second`}>
              <span className="only-a" style={{ flexGrow: Math.max(onlyA.length, 0.4) }}>{onlyA.length}</span>
              <span className="shared" style={{ flexGrow: Math.max(pairs.length, 0.4) }}>{pairs.length}</span>
              <span className="only-b" style={{ flexGrow: Math.max(onlyB.length, 0.4) }}>{onlyB.length}</span>
            </div>
            <p className="cmp-legend"><span>Only {roadmap.title}</span><span>Shared</span><span>Only {other.title}</span></p>
            {result.summary && <p>{result.summary}</p>}
            <p className="muted">
              {pairs.length === 0
                ? 'These two paths barely overlap, so each one is a separate climb.'
                : `${coverA}% of the work for ${roadmap.title} also counts toward ${other.title} (${sharedHoursA} hours), and ${coverB}% the other way round.`}
            </p>
          </article>

          {pairs.length > 0 && (
            <article className="card" aria-label="Shared steps, side by side">
              <h3>Do these first: they count for both</h3>
              <ul className="cmp-pairs">
                {pairs.map((p) => (
                  <li key={`${p.a}-${p.b}`}>
                    <StepCard step={byA[p.a]} side="left" />
                    <span className="cmp-link" title={p.why || 'Same skill'}>⇄<small>{p.why}</small></span>
                    <StepCard step={byB[p.b]} side="right" />
                  </li>
                ))}
              </ul>
            </article>
          )}

          <div className="cmp-cols">
            <article className="card">
              <h3>Only for {roadmap.title}</h3>
              {onlyA.length ? onlyA.map((n) => <StepCard key={n.id} step={n} side="left" />) : <p className="muted">Everything here is shared.</p>}
            </article>
            <article className="card">
              <h3>Only for {other.title}</h3>
              {onlyB.length ? onlyB.map((n) => <StepCard key={n.id} step={n} side="right" />) : <p className="muted">Everything here is shared.</p>}
            </article>
          </div>
        </>
      )}
    </section>
  )
}
