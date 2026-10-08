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

export function downloadText(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  download(name, url)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const readyLine = (plan, hours) => {
  const s = plan.summary
  return `Ready by ${s.weeks_needed === 0 ? 'today' : readyByDate(s.weeks_needed)} at ${hours} hours a week (${s.percent_ready}% ready, ${s.remaining_hours} hours to go)`
}
const DISCLAIMER = 'Made with CareerMap. The plan is AI-generated: use it as a guide and confirm costs and requirements with official sources.'
const phasesOf = (roadmap) => [...new Set(roadmap.nodes.map((n) => n.phase))].sort((a, b) => a - b)

// What to show for one step, shared by the PDF and the text file.
function describe(step, plan, known) {
  const info = plan.nodes[step.id]
  const done = known.includes(step.id) || info.status === 'implied'
  const when = info.start_week != null ? `week ${Math.floor(info.start_week) + 1}` : null
  const meta = [KINDS[step.kind]?.label ?? 'Skill', `${step.hours} h`, when, STATUS_LABEL[info.status].toLowerCase()].filter(Boolean).join(', ')
  return { done, meta, stretch: info.status === 'stretch', info }
}

// A plain text checklist that opens in any editor.
export function toPlainText(roadmap, plan, known, hours) {
  const lines = [roadmap.title || 'My roadmap', '='.repeat(Math.min((roadmap.title || 'My roadmap').length, 70)), '', readyLine(plan, hours), '', DISCLAIMER]
  for (const phase of phasesOf(roadmap)) {
    lines.push('', `${phase}. ${roadmap.phases[phase - 1] ?? `Phase ${phase}`}`, '-'.repeat(30))
    for (const step of roadmap.nodes.filter((n) => n.phase === phase)) {
      const d = describe(step, plan, known)
      lines.push(`[${d.done ? 'x' : ' '}] ${step.title}${d.stretch ? ' (stretch)' : ''}  (${d.meta})`)
      if (step.why) lines.push(`      ${step.why}`)
    }
  }
  return lines.join('\r\n') + '\r\n'
}

// The built-in PDF font only has Latin characters, so swap anything else for a plain equivalent.
const safe = (text) => String(text ?? '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/[·•]/g, '-').replace(/★/g, '*')
  .normalize('NFKD').replace(/[^\x20-\x7E -ÿ]/g, '')

// A real PDF with checkboxes, made in the browser. The PDF library is loaded only when this is used.
export async function downloadPdf(roadmap, plan, known, hours) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PAGE_H = 297
  const MARGIN = 18
  const WIDTH = 210 - 2 * MARGIN
  let y = MARGIN

  const need = (height) => { if (y + height > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN } }
  const write = (text, { size = 10, bold = false, color = [26, 34, 51], gap = 1.5, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(safe(text), WIDTH - indent)
    const lineHeight = size * 0.44
    need(lines.length * lineHeight + gap)
    for (const line of lines) {
      doc.text(line, MARGIN + indent, y + size * 0.3)
      y += lineHeight
    }
    y += gap
  }

  write(roadmap.title || 'My roadmap', { size: 20, bold: true, gap: 2 })
  write(readyLine(plan, hours), { size: 12, bold: true, color: [110, 60, 140], gap: 2 })
  write(DISCLAIMER, { size: 8.5, color: [110, 110, 120], gap: 5 })

  for (const phase of phasesOf(roadmap)) {
    need(14)
    write(`${phase}. ${roadmap.phases[phase - 1] ?? `Phase ${phase}`}`, { size: 13, bold: true, gap: 1 })
    doc.setDrawColor(200, 200, 205)
    doc.line(MARGIN, y, MARGIN + WIDTH, y)
    y += 3
    for (const step of roadmap.nodes.filter((n) => n.phase === phase)) {
      const d = describe(step, plan, known)
      const why = step.why ? safe(step.why) : ''
      need(16 + (why.length > 90 ? 5 : 0))
      // checkbox
      doc.setDrawColor(90, 90, 100)
      doc.setLineWidth(0.3)
      doc.rect(MARGIN, y + 0.4, 3.8, 3.8)
      if (d.done) {
        doc.setDrawColor(40, 140, 100)
        doc.setLineWidth(0.6)
        doc.line(MARGIN + 0.8, y + 2.4, MARGIN + 1.7, y + 3.4)
        doc.line(MARGIN + 1.7, y + 3.4, MARGIN + 3.1, y + 1.2)
      }
      write(`${step.title}${d.stretch ? ' (stretch)' : ''}`, { size: 10.5, bold: true, gap: 0.6, indent: 6.5 })
      write(d.meta, { size: 9, color: [90, 100, 115], gap: 0.6, indent: 6.5 })
      if (why) write(why, { size: 9, color: [90, 100, 115], gap: 3, indent: 6.5 })
      else y += 2.4
    }
    y += 2
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(130, 130, 140)
    doc.text(`CareerMap  -  page ${page} of ${pages}`, MARGIN, PAGE_H - 9)
  }
  doc.save(fileName(roadmap.title, 'pdf'))
}
