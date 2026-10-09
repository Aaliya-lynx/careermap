import { useRef, useState } from 'react'
import { EXAMPLES, GITHUB_LINK, PROFILE_OPTIONS } from '../format.js'

export default function SetupForm({ busy, onSubmit, onForget, initial }) {
  const [goal, setGoal] = useState(initial.goal)
  const [skills, setSkills] = useState(initial.skills)
  const [hours, setHours] = useState(initial.hours)
  const [budget, setBudget] = useState(initial.budget)
  const [profile, setProfile] = useState(initial.profile ?? {})
  const formRef = useRef(null)
  const github = (profile.github ?? '').trim()
  const githubBad = github !== '' && !GITHUB_LINK.test(github)

  function build() {
    if (busy || githubBad || !formRef.current.reportValidity()) return     // the button no longer submits natively, so check the fields here
    onSubmit({
      profile: { ...profile, github },
      goal: goal.trim(),
      skills,
      known_skills: skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      hours_per_week: Number(hours) || 8,
      weeks_budget: budget ? Number(budget) : null,
    })
  }

  const visibleFields = (form) => [...form.querySelectorAll('input, select')].filter((el) => !el.disabled && el.offsetParent !== null)

  // Moves to the field after `from`. Returns false when `from` is the last one.
  function focusNext(form, from) {
    const fields = visibleFields(form)
    const next = fields[fields.indexOf(from) + 1]
    if (!next) return false
    next.focus()
    if (next.tagName === 'INPUT') next.select?.()
    return true
  }

  // Enter moves to the next field; only Enter in the last field (or the button) builds the roadmap.
  function nextOnEnter(event) {
    if (event.key !== 'Enter' || !['INPUT', 'SELECT'].includes(event.target.tagName) || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!focusNext(event.currentTarget, event.target)) build()
  }

  // Phone keyboards send their Enter / Go key as a form submit, not as a key press: treat it the same way.
  function submitFromKeyboard(event) {
    event.preventDefault()
    if (!focusNext(event.currentTarget, document.activeElement)) build()
  }

  return (
    <form className="setup" ref={formRef} onSubmit={submitFromKeyboard} onKeyDown={nextOnEnter}>
      <div className="field">
        <label htmlFor="goal">Your dream job, as specific as you can</label>
        <input id="goal" value={goal} onChange={(e) => { e.target.setCustomValidity(''); setGoal(e.target.value) }} minLength={2} maxLength={200} required
          onInvalid={(e) => e.target.setCustomValidity('Please type a job title, for example: Data Analyst.')}
          placeholder="e.g. Full Stack Developer at a climate tech startup" autoComplete="off" enterKeyHint="next" />
        <div className="chips" aria-label="Examples">
          {EXAMPLES.slice(0, 6).map((example) => (
            <button type="button" key={example} className="chip" onClick={() => setGoal(example)}>{example}</button>
          ))}
        </div>
        <select className="more-examples" aria-label="More example jobs" value="" onChange={(e) => { if (e.target.value) setGoal(e.target.value) }}>
          <option value="">More example jobs, technical and non-technical…</option>
          {EXAMPLES.slice(6).map((example) => <option key={example} value={example}>{example}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="skills">Skills you already have <span className="optional">(optional, separate with commas)</span></label>
        <input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} maxLength={400}
          placeholder="e.g. HTML, CSS, basic Python" autoComplete="off" enterKeyHint="next" />
      </div>

      <details className="about" open>
        <summary>Tell us about yourself <span className="optional">(optional: a better-fitting roadmap)</span></summary>
        <div className="about-grid">
          {PROFILE_OPTIONS.map(({ key, label, choices }) => (
            <div className="field" key={key}>
              <label htmlFor={`p-${key}`}>{label}</label>
              <select id={`p-${key}`} value={profile[key] ?? ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}>
                <option value="">Prefer not to say</option>
                {choices.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ))}
          <div className="field">
            <label htmlFor="p-github">GitHub profile link <span className="optional">(optional, skip it if you do not code)</span></label>
            <input id="p-github" value={profile.github ?? ''} onChange={(e) => setProfile({ ...profile, github: e.target.value })} maxLength={100}
              placeholder="https://github.com/your-name" autoComplete="off" enterKeyHint="next" aria-invalid={githubBad} />
            {githubBad && <small className="field-error" role="alert">Use a link like https://github.com/your-name</small>}
          </div>
        </div>
        <p className="notice">Your choices help tailor the roadmap, and are remembered on this device so you only fill them in once. Your GitHub link stays in this browser: it is not opened or sent to the AI.</p>
        {(Object.values(profile).some(Boolean) || skills) && <button type="button" className="linklike" onClick={onForget}>Forget my details on this device</button>}
      </details>

      <div className="row">
        <div className="field">
          <label htmlFor="hours">Hours per week</label>
          <input id="hours" type="number" min="1" max="80" value={hours} onChange={(e) => setHours(e.target.value)} enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="budget">Finish within <span className="optional">(weeks, optional)</span></label>
          <input id="budget" type="number" min="1" max="520" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 24" enterKeyHint="go" />
        </div>
      </div>

      <button className="primary" type="button" onClick={build} disabled={busy || githubBad}>
        {busy ? 'Building your roadmap…' : 'Build my roadmap'}
      </button>
      <p className="notice">Use your plan as a guide and confirm costs and requirements with official sources. Your answers are sent to an AI service to build it, so please leave out private details.</p>
    </form>
  )
}
