import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeCertificates, createRoadmap, getAdvice, getPaths, replan } from './api.js'
import { downloadPdf, downloadText, fileName, toPlainText } from './exports.js'
import { paceInfo, readyByDate, weeksText } from './format.js'
import { buildNarration } from './narrate.js'
import { clearMe, loadLibrary, loadMe, newId, saveLibrary, saveMe, upsert } from './store.js'
import { decodeShare, readShared, shareUrl } from './share.js'
import Certificates from './components/Certificates.jsx'
import Dashboard from './components/Dashboard.jsx'
import Graph from './components/Graph.jsx'
import Compare from './components/Compare.jsx'
import HomeHero from './components/HomeHero.jsx'
import Library from './components/Library.jsx'
import Listen from './components/Listen.jsx'
import Outline from './components/Outline.jsx'
import Paths from './components/Paths.jsx'
import SkillTree from './components/SkillTree.jsx'
import Timeline from './components/Timeline.jsx'
import SetupForm from './components/SetupForm.jsx'
import SidePanel from './components/SidePanel.jsx'
import Toast from './components/Toast.jsx'

const LOADING_STEPS = [
  'Reading your target role…',
  'Finding the real skills, certifications and projects it needs…',
  'Putting the steps in the right order…',
  'Estimating the hours for each step…',
  'Almost there…',
]

const SECTIONS = [['roadmap', 'Roadmap'], ['certs', 'Certificates'], ['progress', 'Progress'], ['you', 'About you'], ['explore', 'Explore']]
const VIEWS = [['tree', 'Skill tree'], ['map', 'Map'], ['timeline', 'Timeline'], ['outline', 'Outline']]

export default function App() {
  const first = useRef(null)
  if (first.current === null) {
    const library = loadLibrary()
    first.current = { library, entry: library[0] ?? null }
  }
  const start = first.current.entry
  const [me, setMe] = useState(loadMe)           // details remembered from last time
  const [formKey, setFormKey] = useState(0)
  const [library, setLibrary] = useState(first.current.library)
  const [activeId, setActiveId] = useState(start?.id ?? null)
  const [form, setForm] = useState({ goal: start?.goal ?? '', skills: start?.skills ?? me.skills ?? '', hours: start?.hours ?? me.hours ?? 8, budget: start?.budget ?? '', profile: start?.profile ?? me.profile ?? {} })
  const [roadmap, setRoadmap] = useState(start?.roadmap ?? null)
  const [known, setKnown] = useState(start?.known ?? [])
  const [completed, setCompleted] = useState(start?.completed ?? {})
  const [startedAt, setStartedAt] = useState(start?.startedAt ?? Date.now())
  const [hours, setHours] = useState(start?.hours ?? 8)
  const [budget, setBudget] = useState(start?.budget ?? '')
  const [plan, setPlan] = useState(start?.plan ?? null)
  const [evidence, setEvidence] = useState(start?.evidence ?? {})        // step id -> certificate that shows it
  const [certResult, setCertResult] = useState(start?.certResult ?? null)
  const [certBusy, setCertBusy] = useState(false)
  const [certError, setCertError] = useState('')
  const [paths, setPaths] = useState(start?.paths ?? null)         // typical routes into the job (AI, illustrative)
  const [pathBusy, setPathBusy] = useState(false)
  const [pathError, setPathError] = useState('')
  const [highlight, setHighlight] = useState(null)                  // a route shown on the map
  const [busy, setBusy] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [advice, setAdvice] = useState({})
  const [toast, setToast] = useState(null)
  const [view, setView] = useState('tree')                     // how the roadmap is drawn: tree, map, timeline or outline
  const [section, setSection] = useState('roadmap')            // which part of the roadmap page is showing
  const [explore, setExplore] = useState('paths')              // inside Explore: paths or compare
  const [expanded, setExpanded] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const swipe = useRef(null)
  const wheelLock = useRef(0)
  const [page, setPage] = useState('home')          // 'home' = the start page, 'roadmap' = the plan; switching never loses either
  const skipReplan = useRef(false)
  const completedPhases = useRef(null)   // phases that were complete last time: a new one triggers a celebration

  // Save this roadmap in "My roadmaps" (this browser only) whenever something about it changes.
  useEffect(() => {
    if (!roadmap || !activeId) return
    const summary = plan ? { weeks_needed: plan.summary.weeks_needed, percent_ready: plan.summary.percent_ready } : null
    const entry = { id: activeId, title: roadmap.title || form.goal, goal: form.goal, skills: form.skills, profile: form.profile, roadmap, known, completed,
      evidence, certResult, paths, startedAt, hours, budget, plan, summary, updatedAt: Date.now() }
    setLibrary((current) => {
      const next = upsert(current, entry)
      saveLibrary(next)
      return next
    })
  }, [roadmap, activeId, known, completed, evidence, certResult, paths, startedAt, hours, budget, plan, form.goal, form.skills, form.profile])

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

  // Rotating progress messages while the AI works (it takes about 20 seconds).
  useEffect(() => {
    if (!busy) return
    setLoadingStep(0)
    const timer = setInterval(() => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 4500)
    return () => clearInterval(timer)
  }, [busy])

  useEffect(() => {
    if (!expanded) return
    const onKey = (event) => event.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

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
        setPage('roadmap')
        setActiveId(newId())
        setForm({ goal: shared.roadmap.title, skills: '', hours: shared.hours, budget: shared.budget })
        setRoadmap({ ...shared.roadmap, nodes: data.nodes })
        setKnown(data.known)
        setCompleted({})
        setEvidence({})
        setCertResult(null)
        setPaths(null)
        setStartedAt(Date.now())
        setHours(shared.hours)
        setBudget(shared.budget)
        setPlan(data.plan)
      } catch (error) {
        setMessage(error.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function openEntry(entry) {
    setPage('roadmap')
    completedPhases.current = null
    setActiveId(entry.id)
    setForm({ goal: entry.goal, skills: entry.skills ?? '', hours: entry.hours, budget: entry.budget, profile: entry.profile ?? {} })
    setRoadmap(entry.roadmap)
    setKnown(entry.known)
    setCompleted(entry.completed ?? {})
    setEvidence(entry.evidence ?? {})
    setCertResult(entry.certResult ?? null)
    setCertError('')
    setPaths(entry.paths ?? null)
    setPathError('')
    setHighlight(null)
    setStartedAt(entry.startedAt ?? entry.updatedAt ?? Date.now())
    setHours(entry.hours)
    setBudget(entry.budget)
    setPlan(entry.plan ?? null)
    setSelectedId(null)
    setAdvice({})
    setMessage('')
    setShowLibrary(false)
    setExpanded(false)
  }

  function deleteEntry(id) {
    const entry = library.find((e) => e.id === id)
    if (!window.confirm(`Delete "${entry?.title || 'this roadmap'}" from this browser? This cannot be undone.`)) return
    const next = library.filter((e) => e.id !== id)
    setLibrary(next)
    saveLibrary(next)
    if (id === activeId) startOver()
  }

  async function build(values) {
    setBusy(true)
    setMessage('')
    try {
      const remembered = { profile: values.profile, skills: values.skills, hours: values.hours_per_week }
      saveMe(remembered)
      setMe(remembered)
      const data = await createRoadmap({
        goal: values.goal, known_skills: values.known_skills,
        hours_per_week: values.hours_per_week, weeks_budget: values.weeks_budget, profile: values.profile,
      })
      skipReplan.current = true
      completedPhases.current = null
      setPage('roadmap')
      setActiveId(newId())
      setForm({ goal: values.goal, skills: values.skills, hours: values.hours_per_week, budget: values.weeks_budget ?? '', profile: values.profile })
      setRoadmap(data.roadmap)
      setKnown(data.known)
      setCompleted({})
      setEvidence({})
      setCertResult(null)
      setPaths(null)
      setHighlight(null)
      setStartedAt(Date.now())
      setHours(values.hours_per_week)
      setBudget(values.weeks_budget ?? '')
      setPlan(data.plan)
      if (data.from_cache) setToast({ text: 'The AI is busy, so this is a saved example roadmap for this role.' })
      setAdvice({})
      setSelectedId(null)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  // "New roadmap" only clears the screen: everything you built stays in "My roadmaps".
  // A new form keeps what you told us last time, but never the job.
  const freshForm = () => ({ goal: '', skills: me.skills ?? '', hours: me.hours ?? 8, budget: '', profile: me.profile ?? {} })

  function forgetMe() {
    clearMe()
    setMe({})
    setForm({ goal: '', skills: '', hours: 8, budget: '', profile: {} })
    setFormKey((k) => k + 1)
  }

  function startOver(keepDetails = false) {
    completedPhases.current = null
    setHighlight(null)
    setActiveId(null)
    setRoadmap(null)
    setPlan(null)
    setSelectedId(null)
    setExpanded(false)
    setMessage('')
    setForm(keepDetails === true ? { ...form, hours, budget } : freshForm())
  }

  const toggleKnown = useCallback((id) => {
    setKnown((current) => {
      const adding = !current.includes(id)
      setCompleted((done) => {
        const next = { ...done }
        if (adding) next[id] = Date.now()
        else delete next[id]
        return next
      })
      if (!adding) setEvidence((e) => { const next = { ...e }; delete next[id]; return next })
      return adding ? [...current, id] : current.filter((k) => k !== id)
    })
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

  // Read certificates (photos and/or typed names), mark the steps they cover as known, and show the career suggestions.
  async function readCertificates({ certificates, images }) {
    setCertBusy(true)
    setCertError('')
    try {
      const data = await analyzeCertificates({
        goal: roadmap.title || form.goal,
        steps: roadmap.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind })),
        known_titles: roadmap.nodes.filter((n) => known.includes(n.id)).map((n) => n.title),
        certificates, images,
      })
      const fresh = {}
      for (const match of data.matches) for (const id of match.covers) if (!known.includes(id)) fresh[id] = match.certificate
      const ids = Object.keys(fresh)
      if (ids.length) {
        setKnown((current) => [...new Set([...current, ...ids])])
        setEvidence((current) => ({ ...current, ...fresh }))
        setToast({ text: `${ids.length} step${ids.length > 1 ? 's' : ''} counted from your certificate (self-reported).` })
      }
      setCertResult((previous) => ({
        read: [...new Map([...(previous?.read ?? []), ...data.read].map((r) => [r.title, r])).values()],
        matches: [...(previous?.matches ?? []), ...data.matches],
        careers: data.careers,
      }))
      return true
    } catch (error) {
      setCertError(error.message)
      return false
    } finally {
      setCertBusy(false)
    }
  }

  // Start a fresh roadmap for a suggested career: the goal is filled in and you press Build.
  function useCareer(title) {
    startOver()
    setForm({ goal: title, skills: '', hours, budget: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadPaths() {
    setPathBusy(true)
    setPathError('')
    try {
      const data = await getPaths({ goal: roadmap.title || form.goal, steps: roadmap.nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind })) })
      setPaths(data.paths)
    } catch (error) {
      setPathError(error.message)
    } finally {
      setPathBusy(false)
    }
  }

  function openSection(key) {
    setSection(key)
    setExpanded(false)
    setSelectedId(null)
  }

  function showRouteOnMap(path) {
    setHighlight({ name: path.name, ids: path.steps_used })
    setView('map')
    setSection('roadmap')
    setTimeout(() => document.querySelector('.graph')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  async function copyShareLink() {
    const url = await shareUrl({ roadmap, known, hours, budget })
    try {
      await navigator.clipboard.writeText(url)
      setToast({ text: 'Link copied. Anyone with it can open this roadmap.' })
    } catch {
      window.prompt('Copy this link to share your roadmap:', url)
    }
  }

  async function savePdf() {
    try {
      await downloadPdf(roadmap, plan, known, hours)
      setToast({ text: 'PDF downloaded.' })
    } catch {
      setToast({ text: 'The PDF could not be made in this browser. Try the text file instead.' })
    }
  }

  function saveText() {
    downloadText(fileName(roadmap.title, 'txt'), toPlainText(roadmap, plan, known, hours))
    setToast({ text: 'Text file downloaded.' })
  }

  const showHome = page === 'home' || !roadmap
  const goPage = (next) => {
    if (next === 'roadmap' && !roadmap) return
    setExpanded(false)
    setPage(next)
    window.scrollTo({ top: 0 })
  }
  const goHome = (event) => { event?.preventDefault(); goPage('home') }
  // Swiping or scrolling sideways moves between the pages, but never when the gesture belongs to the map, a slider, a field or a side-scrolling list.
  const ownsSideways = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (node.classList?.contains('react-flow') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) return true
      const overflowX = getComputedStyle(node).overflowX
      if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 2) return true
    }
    return false
  }
  const swipeStart = (e) => {
    swipe.current = !roadmap || expanded || e.touches.length !== 1 || ownsSideways(e.target) ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const swipeEnd = (e) => {
    const from = swipe.current
    swipe.current = null
    if (!from) return
    const dx = e.changedTouches[0].clientX - from.x
    const dy = e.changedTouches[0].clientY - from.y
    if (Math.abs(dx) >= 70 && Math.abs(dx) >= Math.abs(dy) * 1.6) goPage(dx < 0 ? 'roadmap' : 'home')
  }
  const swipeWheel = (e) => {
    if (!roadmap || expanded || Math.abs(e.deltaX) < 40 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5 || ownsSideways(e.target)) return
    if (Date.now() - wheelLock.current < 700) return
    wheelLock.current = Date.now()
    goPage(e.deltaX > 0 ? 'roadmap' : 'home')
  }
  const step = roadmap?.nodes.find((n) => n.id === selectedId)
  const summary = plan?.summary
  const pace = roadmap && plan ? paceInfo({ startedAt, completed, nodes: roadmap.nodes, hours, plan }) : null

  return (
    <div className={`app ${expanded ? 'has-full' : ''} ${showHome ? 'on-home' : ''}`}>
      <header className="top">
        <a className="brand" href="/" aria-label="CareerMap home" onClick={goHome}><span className="logo" aria-hidden="true">◈</span> CareerMap</a>
        <nav className="top-actions" aria-label="Main">
          {library.length > 0 && <button type="button" className="ghost" onClick={() => setShowLibrary(true)}>My roadmaps ({library.length})</button>}
          {roadmap && !showHome && <button type="button" className="ghost" onClick={() => startOver()}>+ New roadmap</button>}
        </nav>
      </header>

      <div className={roadmap ? 'pager' : undefined} onTouchStart={swipeStart} onTouchEnd={swipeEnd} onWheel={swipeWheel}>
      <div className={roadmap ? `pager-track ${showHome ? 'at-home' : 'at-plan'}` : undefined}>
      <div className={roadmap ? 'pager-page' : undefined} inert={roadmap && !showHome ? true : undefined}>
        <main className="hero">
          <HomeHero />
          {library.length > 0 && (
            <section className="resume" aria-label="Continue a saved roadmap">
              <h2>Pick up where you left off</h2>
              <ul>
                {library.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button type="button" className="resume-item" onClick={() => openEntry(item)}>
                      <strong>{item.title || item.goal}</strong>
                      <span className="muted">{item.summary ? `${item.summary.percent_ready}% ready · ready by ${item.summary.weeks_needed === 0 ? 'today' : readyByDate(item.summary.weeks_needed)}` : 'Open'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <SetupForm key={`${formKey}-${roadmap ? 'fresh' : activeId ?? 'new'}`} busy={busy} onSubmit={build} onForget={forgetMe} initial={roadmap ? freshForm() : form} />
          {busy && <p className="loading" role="status">{LOADING_STEPS[loadingStep]}</p>}
          {message && <p className="callout warn" role="alert">{message}</p>}
        </main>
      </div>

      {roadmap && (
        <div className="pager-page" inert={showHome ? true : undefined}>
        <main className="workspace">
          <section className="ready" aria-live="polite">
            <div className="ready-main">
              <p className="eyebrow">{roadmap.title || form.goal}</p>
              {summary ? (
                <>
                  <p className="ready-date"><span className="muted-label">Ready by</span> {summary.weeks_needed === 0 ? 'today' : readyByDate(summary.weeks_needed)}</p>
                  <div className="ready-meter" role="img" aria-label={`${summary.percent_ready} percent ready`}><span style={{ width: `${Math.max(summary.percent_ready, 2)}%` }} /></div>
                  <ul className="ready-facts">
                    <li><strong>{summary.percent_ready}%</strong> ready</li>
                    <li>{weeksText(summary.weeks_needed)}</li>
                    <li><strong>{summary.remaining_hours}</strong> hours to go</li>
                  </ul>
                </>
              ) : <p className="muted">Planning…</p>}
              <div className="ready-actions">
                <Listen getLines={() => buildNarration(roadmap, plan, hours)} disabled={!plan} />
                <span className="ready-label">Save or share</span>
                <button type="button" className="ghost" onClick={copyShareLink}>Copy share link</button>
                <button type="button" className="ghost" onClick={savePdf} disabled={!plan}>Download PDF</button>
                <button type="button" className="ghost" onClick={saveText} disabled={!plan}>Download text</button>
              </div>
            </div>

            <div className="plan-settings" role="group" aria-label="Plan settings">
              <h3>Plan settings</h3>
              <div className="ps-hours">
              <label htmlFor="hours-slider">Hours per week <strong>{hours} h</strong></label>
              <input id="hours-slider" type="range" min="1" max="40" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              <div className="hours-presets" aria-label="Quick choices">
                {[5, 10, 15, 20, 30].map((h) => (
                  <button key={h} type="button" className={`chip ${hours === h ? 'is-on' : ''}`} onClick={() => setHours(h)}>{h} h</button>
                ))}
              </div>
              </div>
              <div className="ps-deadline">
              <label htmlFor="budget-input">Deadline <span className="optional">(optional)</span></label>
              <div className="deadline">
                <input id="budget-input" type="number" min="1" max="520" value={budget} placeholder="no deadline" onChange={(e) => setBudget(e.target.value)} />
                <span className="muted">weeks</span>
                {budget !== '' && budget != null && <button type="button" className="linklike" onClick={() => setBudget('')}>Clear</button>}
              </div>
              </div>
              {summary && !summary.within_budget && (
                <div className="callout warn fix" role="alert">
                  <p><strong>{summary.weeks_budget} weeks is too short.</strong> This plan needs about {summary.weeks_needed} at {hours} h a week.</p>
                  <div className="fix-actions">
                    <button type="button" className="ghost" onClick={() => setBudget(String(summary.weeks_needed))}>Use {summary.weeks_needed} weeks</button>
                    <button type="button" className="ghost" onClick={() => setBudget('')}>No deadline</button>
                  </div>
                </div>
              )}
              {summary && summary.stretch_ids.length > 0 && <p className="stretch-note">{summary.stretch_ids.length} optional step{summary.stretch_ids.length > 1 ? 's' : ''} moved to “stretch” to fit.</p>}
              <p className="notice">The date updates as you change these. No waiting.</p>
            </div>
          </section>

          {message && <p className="callout warn" role="alert">{message}</p>}

          {plan ? (
            <>
              <nav className="sections" role="tablist" aria-label="Parts of your roadmap">
                {SECTIONS.map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={section === key} className={section === key ? 'is-on' : ''} onClick={() => openSection(key)}>{label}</button>
                ))}
              </nav>

              {section === 'roadmap' && (
                <>
                  <div className="viewrow">
                    <div className="viewbar" role="tablist" aria-label="How to see the roadmap">
                      {VIEWS.map(([key, label]) => (
                        <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-on' : ''} onClick={() => { setView(key); if (key !== 'tree' && key !== 'map') setExpanded(false) }}>{label}</button>
                      ))}
                    </div>
                    {(view === 'map' || view === 'tree') && <p className="map-tip">
                      <span className="tip-desktop">Drag the map to move it. Scroll the page as usual; hold Ctrl and scroll (or pinch) to zoom, and use “Fit all” to see everything.</span>
                      <span className="tip-phone">One finger scrolls the page. Use two fingers to move or zoom the map, or tap Full screen.</span>
                    </p>}
                  </div>
                  <div className="stage">
                    {view === 'tree'
                      ? <SkillTree roadmap={roadmap} plan={plan} selectedId={selectedId} onSelect={setSelectedId} onToggleKnown={toggleKnown}
                          highlight={highlight} onClearHighlight={() => setHighlight(null)} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
                      : view === 'timeline'
                        ? <Timeline roadmap={roadmap} plan={plan} selectedId={selectedId} onSelect={setSelectedId} />
                        : view === 'map'
                          ? <Graph roadmap={roadmap} plan={plan} selectedId={selectedId} onSelect={setSelectedId} onToggleKnown={toggleKnown}
                              highlight={highlight} onClearHighlight={() => setHighlight(null)} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
                          : <Outline roadmap={roadmap} plan={plan} known={known} selectedId={selectedId} onSelect={setSelectedId} onToggleKnown={toggleKnown} />}
                    {step && (
                      <SidePanel step={step} info={plan.nodes[step.id]} roadmap={roadmap} known={known} completedAt={completed[step.id]} evidenceTitle={evidence[step.id]}
                        advice={advice[step.id] ?? {}} onClose={() => setSelectedId(null)} onToggleKnown={toggleKnown} onAdvice={loadAdvice} />
                    )}
                  </div>
                </>
              )}

              {section === 'certs' && (
                <Certificates steps={roadmap.nodes} result={certResult} evidence={evidence} busy={certBusy} error={certError}
                  onAnalyze={readCertificates} onUseCareer={useCareer} />
              )}

              {section === 'progress' && <Dashboard roadmap={roadmap} plan={plan} pace={pace} onSelect={(id) => { setSelectedId(id); setSection('roadmap') }} />}

              {section === 'you' && (
          <section className="where card" aria-label="Where you are now">
              <h3>Where you are now</h3>
              {!roadmap.where_you_are && !form.profile?.github && <p className="muted">This roadmap was built without knowing about you, so it assumes you are starting fresh.</p>}
              {roadmap.where_you_are && (
                <div className="where-cols">
                  {[['have', 'Already have'], ['strengthen', 'Strengthen'], ['next', 'Recommended next']].map(([key, title]) => (
                    roadmap.where_you_are[key]?.length > 0 && (
                      <div key={key} className={`where-col ${key}`}>
                        <h4>{title}</h4>
                        <ul>{roadmap.where_you_are[key].map((item) => <li key={item}>{item}</li>)}</ul>
                      </div>
                    )
                  ))}
                </div>
              )}
              {form.profile?.github && <p className="muted">GitHub: <a href={form.profile.github} target="_blank" rel="noreferrer noopener">{form.profile.github.replace('https://', '')}</a></p>}
              {roadmap.where_you_are && <p className="notice">Based on the choices you made. Self-reported, so check it matches what you really have.</p>}
              <button type="button" className="ghost" onClick={() => startOver(true)}>{roadmap.where_you_are ? 'Change my details' : 'Add details about me'}</button>
            </section>
              )}

              {section === 'explore' && (
                <>
                  <div className="viewbar" role="tablist" aria-label="Explore">
                    <button type="button" role="tab" aria-selected={explore === 'paths'} className={explore === 'paths' ? 'is-on' : ''} onClick={() => setExplore('paths')}>Typical paths</button>
                    <button type="button" role="tab" aria-selected={explore === 'compare'} className={explore === 'compare' ? 'is-on' : ''} onClick={() => setExplore('compare')}>Compare two roles</button>
                  </div>
                  {explore === 'paths'
                    ? <Paths paths={paths} busy={pathBusy} error={pathError} onLoad={loadPaths} onShowOnMap={showRouteOnMap} />
                    : <Compare roadmap={roadmap} others={library.filter((e) => e.id !== activeId)} hours={hours} />}
                </>
              )}
            </>
          ) : <p className="loading" role="status">Loading your plan…</p>}
          <p className="notice footer-note">Use it as a guide and confirm costs and requirements with official sources. Your roadmaps are saved only in this browser.</p>
        </main>
        </div>
      )}
      </div>
      </div>

      {roadmap && !expanded && (
        <nav className="pager-nav" aria-label="Pages">
          {showHome
            ? <button type="button" className="pager-arrow right" aria-label="Go to my roadmap" title="My roadmap" onClick={() => goPage('roadmap')}>›</button>
            : <button type="button" className="pager-arrow left" aria-label="Go to the start page" title="Start page" onClick={() => goPage('home')}>‹</button>}
          <div className="pager-dots">
            <button type="button" className={showHome ? 'is-on' : ''} aria-current={showHome ? 'page' : undefined} onClick={() => goPage('home')}>Start</button>
            <button type="button" className={showHome ? '' : 'is-on'} aria-current={showHome ? undefined : 'page'} onClick={() => goPage('roadmap')}>My roadmap</button>
          </div>
        </nav>
      )}


      {showLibrary && <Library items={library} activeId={activeId} onOpen={(id) => openEntry(library.find((e) => e.id === id))}
        onDelete={deleteEntry} onClose={() => setShowLibrary(false)} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
