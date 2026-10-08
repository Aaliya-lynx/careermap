export const KINDS = {
  skill: { label: 'Skill', icon: '⚡' },
  role: { label: 'Role', icon: '💼' },
  cert: { label: 'Certification', icon: '🎓' },
  project: { label: 'Project', icon: '🛠️' },
}

export const STATUS_LABEL = {
  known: 'Known',
  implied: 'Assumed known',
  todo: 'To do',
  stretch: 'Stretch',
}

// "14 Mar 2027" for today plus the given number of weeks.
export function readyByDate(weeks) {
  const date = new Date()
  date.setDate(date.getDate() + Math.round(weeks * 7))
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function weeksText(weeks) {
  if (weeks <= 0) return 'now'
  return weeks === 1 ? 'in 1 week' : `in ${weeks} weeks`
}

// The known step that makes `id` "assumed known" (a known step that needs it, directly or not).
export function assumedBecause(id, nodes, known) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  for (const k of known) {
    const seen = new Set()
    const stack = [k]
    while (stack.length) {
      for (const r of byId[stack.pop()]?.requires ?? []) {
        if (r === id) return byId[k].title
        if (!seen.has(r)) {
          seen.add(r)
          stack.push(r)
        }
      }
    }
  }
  return null
}

export const EXAMPLES = [
  'Full Stack Developer at a climate tech startup',
  'UI/UX Designer for fintech apps',
  'Data Analyst in healthcare',
]

// How you are really doing: hours of steps you finished since you started, against what your plan expected by now.
export function paceInfo({ startedAt, completed, nodes, hours, plan }) {
  const weeks = Math.max((Date.now() - startedAt) / (7 * 86400000), 0)
  const done = nodes.filter((n) => completed[n.id])
  const doneHours = done.reduce((sum, n) => sum + n.hours, 0)
  const planned = Math.round(hours * weeks)
  const settled = weeks >= 0.5
  const status = !settled ? 'new' : doneHours >= planned * 0.9 ? 'on-track' : 'behind'
  const projectedWeeks = settled && doneHours > 0 ? Math.ceil(plan.summary.remaining_hours / (doneHours / weeks)) : null
  return {
    status, doneHours, doneCount: done.length, planned, projectedWeeks,
    started: new Date(startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }
}

// The "About you" dropdowns. The backend checks answers against the same lists.
export const PROFILE_OPTIONS = [
  { key: 'education', label: 'Education', choices: ['School (grades 9 to 12)', 'Diploma / polytechnic', 'B.Tech / B.E.', 'BCA / B.Sc. / B.Com. / BA', "Master's (M.Tech, MCA, MBA, M.Sc.)", 'Working professional', 'Self-taught / other'] },
  { key: 'year', label: 'Year', choices: ['1st year', '2nd year', '3rd year', 'Final year', 'Graduated', 'Not applicable'] },
  { key: 'field', label: 'Field or specialization', choices: ['Computer science / IT', 'Electronics / electrical', 'Mechanical / civil / other engineering', 'Business / commerce', 'Science / maths', 'Arts / humanities', 'Design / media', 'Other'] },
  { key: 'projects', label: 'Projects you have built', choices: ['None yet', '1 to 2 small projects', '3 or more projects', 'Something real people use'] },
  { key: 'hackathons', label: 'Hackathons and competitions', choices: ['Never', 'Joined one or two', 'Joined several', 'Won or placed'] },
]
export const GITHUB_LINK = /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/?$/
