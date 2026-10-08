import { useState } from 'react'
import { EXAMPLES, GITHUB_LINK, PROFILE_OPTIONS } from '../format.js'

export default function SetupForm({ busy, onSubmit, initial }) {
  const [goal, setGoal] = useState(initial.goal)
  const [skills, setSkills] = useState(initial.skills)
  const [hours, setHours] = useState(initial.hours)
  const [budget, setBudget] = useState(initial.budget)
  const [profile, setProfile] = useState(initial.profile ?? {})
  const github = (profile.github ?? '').trim()
  const githubBad = github !== '' && !GITHUB_LINK.test(github)

  function submit(event) {
    event.preventDefault()
    if (busy || githubBad) return
    onSubmit({
      profile: { ...profile, github },
      goal: goal.trim(),
      skills,
      known_skills: skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      hours_per_week: Number(hours) || 8,
      weeks_budget: budget ? Number(budget) : null,
    })
  }

  return (
    <form className="setup" onSubmit={submit}>
      <div className="field">
        <label htmlFor="goal">Your dream job, as specific as you can</label>
        <input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} minLength={3} maxLength={200} required
          placeholder="e.g. Full Stack Developer at a climate tech startup" autoComplete="off" />
        <div className="chips" aria-label="Examples">
          {EXAMPLES.map((example) => (
            <button type="button" key={example} className="chip" onClick={() => setGoal(example)}>{example}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="skills">Skills you already have <span className="optional">(optional, separate with commas)</span></label>
        <input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} maxLength={400}
          placeholder="e.g. HTML, CSS, basic Python" autoComplete="off" />
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
            <label htmlFor="p-github">GitHub profile link</label>
            <input id="p-github" value={profile.github ?? ''} onChange={(e) => setProfile({ ...profile, github: e.target.value })} maxLength={100}
              placeholder="https://github.com/your-name" autoComplete="off" aria-invalid={githubBad} />
            {githubBad && <small className="field-error" role="alert">Use a link like https://github.com/your-name</small>}
          </div>
        </div>
        <p className="notice">Your choices help the AI skip what you already have. We do not open your GitHub: the link is only kept in this browser so you can find it again.</p>
      </details>

      <div className="row">
        <div className="field">
          <label htmlFor="hours">Hours per week</label>
          <input id="hours" type="number" min="1" max="80" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="budget">Finish within <span className="optional">(weeks, optional)</span></label>
          <input id="budget" type="number" min="1" max="520" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 24" />
        </div>
      </div>

      <button className="primary" type="submit" disabled={busy || githubBad}>
        {busy ? 'Building your roadmap…' : 'Build my roadmap'}
      </button>
      <p className="notice">Use your plan as a guide and confirm costs and requirements with official sources. Your answers are sent to an AI service to build it, so please leave out private details.</p>
    </form>
  )
}
