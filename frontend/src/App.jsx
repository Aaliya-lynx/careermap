import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoadmap, getAdvice, replan } from './api.js'
import { readyByDate, weeksText } from './format.js'
import Graph from './components/Graph.jsx'
import Dashboard from './components/Dashboard.jsx'
import SetupForm from './components/SetupForm.jsx'
import SidePanel from './components/SidePanel.jsx'
import Toast from './components/Toast.jsx'
import { decodeShare, readShared, shareUrl } from './share.js'

const STORAGE_KEY = 'careermap.v1'

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved && saved.roadmap?.nodes?.length ? saved : null
  } catch {
    return null
  }
}

export default function App() {
  const saved = useRef(loadSaved()).current
  const [form, setForm] = useState({ goal: saved?.goal ?? '', skills: saved?.skills ?? '', hours: saved?.hours ?? 8, budget: saved?.budget ?? '' })
  const [roadmap, setRoadmap] = useState(saved?.roadmap ?? null)
  const [known, setKnown] = useState(saved?.known ?? [])
  const [hours, setHours] = useState(saved?.hours ?? 8)
  const [budget, setBudget] = useState(saved?.budget ?? '')
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [advice, setAdvice] = useState({})
  const [toast, setToast] = useState(null)
  const skipReplan = useRef(false)
  const completedPhases = useRef(null)   // phases that were complete last time: a new one triggers a celebration

  // Save progress in this browser only.
  useEffect(() => {
    if (!roadmap) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ goal: form.goal, skills: form.skills, hours, budget, roadmap, known }))
    } catch { /* storage may be blocked: the app still works */ }
  }, [roadmap, known, hours, budget, form.goal, form.skills])

  // Whenever hours, budget or known skills change, ask the server for a new plan (plain code, no AI).
  useEffect(() => {
    if (!roadmap) return
    if (skipReplan.current) {
      skipReplan.current = false
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      replan({ nodes: roadmap.nodes, known, hours_per_week: Number(hours) || 8, weeks_budget: budget ? Number(budget) : null }, controller.signal)
        .then((data) => { setPlan(data.plan); setMessage('') })
        .catch((error) => { if (error.name !== 'AbortError') setMessage(error.message) })
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [roadmap, known, hours, budget])

  useEffect(() => {
    if (!plan || !roadmap) return
    const now = new Set(plan.phases.filter((p) => p.complete).map((p) => p.phase))
    const before = completedPhases.current
    completedPhases.current = now
    if (!before) return
    for (const phase of now) {
      if (!before.has(phase)) {
        setToast({ text: `Phase ${phase} complete${roadmap.phases[phase - 1] ? `: ${roadmap.phases[phase - 1]}` : ''}. Nice work!`, celebrate: true })
        break
      }
    }
  }, [plan, roadmap])

  // Open a shared link (#r=...). The steps are cleaned by the server before they are used.
  useEffect(() => {
    if (!window.location.hash.startsWith('#r=')) return
    let cancelled = false
    ;(async () => {
      const shared = readShared(await decodeShare(window.location.hash.slice(3)))
      window.history.replaceState(null, '', window.location.pathname)
      if (!shared) { setMessage('That share link could not be opened.'); return }
      try {
        const data = await replan({ nodes: shared.roadmap.nodes, known: shared.known, hours_per_week: shared.hours, weeks_budget: shared.budget ? Number(shared.budget) : null })
        if (cancelled) return
        skipReplan.current = true
        completedPhases.current = null
        setForm({ goal: shared.roadmap.title, skills: '', hours: shared.hours, budget: shared.budget })
        setRoadmap({ ...shared.roadmap, nodes: data.nodes })
        setKnown(data.known)
        setHours(shared.hours)
        setBudget(shared.budget)
        setPlan(data.plan)
      } catch (error) {
        setMessage(error.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function copyShareLink() {
    const url = await shareUrl({ roadmap, known, hours, budget })
    try {
      await navigator.clipboard.writeText(url)
      setToast({ text: 'Link copied. Anyone with it can open this roadmap.' })
    } catch {
      window.prompt('Copy this link to share your roadmap:', url)
    }
  }

  async function build(values) {
    setBusy(true)
    setMessage('')
    try {
      const data = await createRoadmap({
        goal: values.goal, known_skills: values.known_skills,
        hours_per_week: values.hours_per_week, weeks_budget: values.weeks_budget,
      })
      skipReplan.current = true
      completedPhases.current = null
      setForm({ goal: values.goal, skills: values.skills, hours: values.hours_per_week, budget: values.weeks_budget ?? '' })
      setRoadmap(data.roadmap)
      setKnown(data.known)
      setHours(values.hours_per_week)
      setBudget(values.weeks_budget ?? '')
      setPlan(data.plan)
      setAdvice({})
      setSelectedId(null)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  function startOver() {
    completedPhases.current = null
    setRoadmap(null)
    setPlan(null)
    setSelectedId(null)
    setMessage('')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  const toggleKnown = useCallback((id) => {
    setKnown((current) => (current.includes(id) ? current.filter((k) => k !== id) : [...current, id]))
  }, [])

  async function loadAdvice(step) {
    setAdvice((a) => ({ ...a, [step.id]: { loading: true } }))
    try {
      const data = await getAdvice({ goal: roadmap.title || form.goal, node: { title: step.title, kind: step.kind, why: step.why } })
      setAdvice((a) => ({ ...a, [step.id]: { data } }))
    } catch (error) {
      setAdvice((a) => ({ ...a, [step.id]: { error: error.message } }))
    }
  }

  const step = roadmap?.nodes.find((n) => n.id === selectedId)
  const summary = plan?.summary

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="/" aria-label="CareerMap home"><span className="logo" aria-hidden="true">◈</span> CareerMap</a>
        {roadmap && <button type="button" className="ghost" onClick={startOver}>New roadmap</button>}
      </header>

      {!roadmap && (
        <main className="hero">
          <h1>Your dream job, <span className="grad">reverse-engineered.</span></h1>
          <p className="lead">Tell us the exact role. We build your skill tree and tell you the date you could be ready, then it re-plans live as your hours and skills change.</p>
          <SetupForm busy={busy} onSubmit={build} initial={form} />
          {busy && <p className="loading" role="status">Mapping the steps, real roles and certifications for you. This can take up to half a minute.</p>}
          {message && <p className="callout warn" role="alert">{message}</p>}
        </main>
      )}

      {roadmap && (
        <main className="workspace">
          <section className="ready" aria-live="polite">
            <div>
              <p className="eyebrow">{roadmap.title || form.goal}</p>
              {summary ? (
                <>
                  <p className="ready-date"><span className="muted-label">Ready by</span> {summary.weeks_needed === 0 ? 'today' : readyByDate(summary.weeks_needed)}</p>
                  <p className="muted">{weeksText(summary.weeks_needed)} · {summary.percent_ready}% ready · {summary.remaining_hours} hours to go</p>
                  {!summary.within_budget && (
                    <p className="callout warn">Needs {summary.weeks_needed} weeks, over your {summary.weeks_budget}-week limit. Raise your weekly hours or lower the goal.</p>
                  )}
                  {summary.stretch_ids.length > 0 && <p className="callout">{summary.stretch_ids.length} optional step{summary.stretch_ids.length > 1 ? 's' : ''} moved to “stretch” to fit your limit.</p>}
                </>
              ) : <p className="muted">Planning…</p>}
            </div>
            <div className="controls">
              <label htmlFor="hours-slider">Hours per week: <strong>{hours}</strong></label>
              <input id="hours-slider" type="range" min="1" max="40" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              <label htmlFor="budget-input">Finish within (weeks)</label>
              <input id="budget-input" type="number" min="1" max="520" value={budget} placeholder="no limit"
                onChange={(e) => setBudget(e.target.value)} />
              <button type="button" className="ghost share" onClick={copyShareLink}>Copy share link</button>
            </div>
          </section>

          {message && <p className="callout warn" role="alert">{message}</p>}

          {plan && <Dashboard roadmap={roadmap} plan={plan} onSelect={setSelectedId} />}

          {plan ? (
            <div className="stage">
              <Graph roadmap={roadmap} plan={plan} selectedId={selectedId} onSelect={setSelectedId} />
              {step && (
                <SidePanel step={step} info={plan.nodes[step.id]} roadmap={roadmap} known={known}
                  advice={advice[step.id] ?? {}} onClose={() => setSelectedId(null)} onToggleKnown={toggleKnown} onAdvice={loadAdvice} />
              )}
            </div>
          ) : <p className="loading" role="status">Loading your plan…</p>}
          <p className="notice footer-note">Roadmap and advice are written by AI and can be wrong. Check roles, certifications and costs. Your progress is saved only in this browser.</p>
        </main>
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
