// Small helpers shared by the map, the skill tree and the timeline.

// Everything a step needs (before it) and everything it unlocks (after it).
export function relatedTo(id, nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const related = new Set([id])
  const up = [id]
  while (up.length) for (const r of byId[up.pop()].requires) if (!related.has(r)) { related.add(r); up.push(r) }
  const down = [id]
  while (down.length) {
    const current = down.pop()
    for (const n of nodes) if (n.requires.includes(current) && !related.has(n.id)) { related.add(n.id); down.push(n.id) }
  }
  return related
}

// What your progress would be in a given week, if you keep to the plan.
export function futureSummary(roadmap, plan, week) {
  let done = 0
  let total = 0
  let finished = 0
  for (const step of roadmap.nodes) {
    const info = plan.nodes[step.id]
    if (info.status === 'stretch') continue
    total += step.hours
    if (info.status === 'known' || info.status === 'implied') done += step.hours
    else if (info.end_week != null && info.end_week <= week) { done += step.hours; finished += 1 }
  }
  return { percent: total ? Math.round((100 * done) / total) : 0, finished }
}
