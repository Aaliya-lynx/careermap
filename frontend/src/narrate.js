// The spoken explanation of a plan. It is written by plain code from your real plan, so it costs no AI call
// and it always agrees with what is on the screen.

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

export function spokenDate(weeks) {
  const date = new Date()
  date.setDate(date.getDate() + Math.round(weeks * 7))
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// An array of short sentences (the speaker reads them one by one, which is more reliable than one long text).
export function buildNarration(roadmap, plan, hours) {
  const byId = Object.fromEntries(roadmap.nodes.map((n) => [n.id, n]))
  const s = plan.summary
  const lines = [`Here is your plan for ${roadmap.title || 'your dream job'}.`]

  if (s.weeks_needed === 0) {
    lines.push('Good news: you already have everything on this roadmap.')
  } else {
    lines.push(`At ${hours} hours a week, you could be ready by ${spokenDate(s.weeks_needed)}. That is about ${s.weeks_needed} weeks, or ${s.remaining_hours} hours of work.`)
    lines.push(`You are already ${s.percent_ready} percent of the way there.`)
  }

  const startId = plan.order.find((id) => plan.nodes[id].available)
  if (startId) lines.push(`Start with ${byId[startId].title}.`)
  const week = plan.focus.this_week.map((id) => byId[id].title).slice(0, 3)
  if (week.length) lines.push(`This week, focus on ${list(week)}.`)

  const phases = [...new Set(roadmap.nodes.map((n) => n.phase))].sort((a, b) => a - b).map((p) => roadmap.phases[p - 1]).filter(Boolean)
  if (phases.length) lines.push(`The plan has ${phases.length} phases: ${list(phases)}.`)

  const chain = s.critical_path.map((id) => byId[id].title)
  if (chain.length) lines.push(`The longest chain, which sets your date, runs through ${list(chain.slice(0, 4))}${chain.length > 4 ? ' and more' : ''}.`)

  if (!s.within_budget) lines.push(`Heads up: the essential steps need ${s.weeks_needed} weeks, more than your ${s.weeks_budget} week limit.`)
  if (s.stretch_ids.length) lines.push(`${s.stretch_ids.length} optional ${s.stretch_ids.length === 1 ? 'step is' : 'steps are'} left out to fit your deadline.`)

  lines.push('Tap any step to see what it needs, and to get a project idea. This plan was made with AI, so check costs and requirements on official sites.')
  return lines
}
