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
