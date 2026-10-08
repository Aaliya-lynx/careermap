import { KINDS, STATUS_LABEL, readyByDate } from './format.js'

export function fileName(title, extension) {
  const base = (title || 'roadmap').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `careermap-${base || 'roadmap'}.${extension}`
}

export function download(name, href) {
  const link = document.createElement('a')
  link.download = name
  link.href = href
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadText(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  download(name, url)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// A readable checklist of the whole plan, one section per phase.
export function toMarkdown(roadmap, plan, known, hours) {
  const s = plan.summary
  const lines = [
    `# ${roadmap.title || 'My roadmap'}`,
    '',
    `Ready by **${s.weeks_needed === 0 ? 'today' : readyByDate(s.weeks_needed)}** at ${hours} hours a week (${s.percent_ready}% ready, ${s.remaining_hours} hours to go).`,
    '',
    '_Made with CareerMap. The plan is AI-generated: use it as a guide and confirm costs and requirements with official sources._',
  ]
  const phases = [...new Set(roadmap.nodes.map((n) => n.phase))].sort((a, b) => a - b)
  for (const phase of phases) {
    lines.push('', `## ${phase}. ${roadmap.phases[phase - 1] ?? `Phase ${phase}`}`, '')
    for (const step of roadmap.nodes.filter((n) => n.phase === phase)) {
      const info = plan.nodes[step.id]
      const done = known.includes(step.id) || info.status === 'implied'
      const when = info.start_week != null ? `, week ${Math.floor(info.start_week) + 1}` : ''
      const tag = info.status === 'stretch' ? ' (stretch)' : ''
      lines.push(`- [${done ? 'x' : ' '}] **${step.title}**${tag} (${KINDS[step.kind]?.label ?? 'Skill'}, ${step.hours} h${when}, ${STATUS_LABEL[info.status].toLowerCase()})`)
      if (step.why) lines.push(`  - ${step.why}`)
    }
  }
  return lines.join('\n') + '\n'
}
