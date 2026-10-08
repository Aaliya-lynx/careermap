import { useState } from 'react'
import { EXAMPLES } from '../format.js'

export default function SetupForm({ busy, onSubmit, initial }) {
  const [goal, setGoal] = useState(initial.goal)
  const [skills, setSkills] = useState(initial.skills)
  const [hours, setHours] = useState(initial.hours)
  const [budget, setBudget] = useState(initial.budget)

  function submit(event) {
    event.preventDefault()
    if (busy) return
    onSubmit({
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

      <button className="primary" type="submit" disabled={busy}>
        {busy ? 'Building your roadmap…' : 'Build my roadmap'}
      </button>
      <p className="notice">The roadmap and the advice are written by AI, so check roles, certifications and costs before you rely on them. Your input is sent to an AI service to create the roadmap; do not enter private details.</p>
    </form>
  )
}
