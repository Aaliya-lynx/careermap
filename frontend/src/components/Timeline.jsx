import { useEffect, useState } from 'react'
import { KINDS, readyByDate } from '../format.js'
import { futureSummary } from '../graphUtils.js'

const PX = 26        // pixels per week
const labelWidth = () => (typeof window !== 'undefined' && window.innerWidth < 700 ? 140 : 300)   // width of the step names on the left: narrower on a phone

// Your plan as a timeline: one bar per step, placed and sized by the planner. A marker moves through the weeks and fills the bars.
export default function Timeline({ roadmap, plan, selectedId, onSelect }) {
  const [week, setWeek] = useState(0)
  const [playing, setPlaying] = useState(false)
  const max = plan.summary.weeks_needed

  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(() => setWeek((w) => (w >= max ? (setPlaying(false), w) : w + 1)), 320)
    return () => clearInterval(timer)
  }, [playing, max])
  useEffect(() => { if (week > max) setWeek(0) }, [max, week])

  const byId = Object.fromEntries(roadmap.nodes.map((n) => [n.id, n]))
  const rows = plan.order.map((id) => ({ step: byId[id], info: plan.nodes[id] }))
  const done = roadmap.nodes.filter((n) => ['known', 'implied'].includes(plan.nodes[n.id].status))
  const stretch = roadmap.nodes.filter((n) => plan.nodes[n.id].status === 'stretch')
  const weeks = Math.max(max, 4)
  const px = Math.max(PX, Math.floor(760 / weeks))      // short plans are stretched so the chart is never tiny
  const trackWidth = weeks * px
  const LABEL = labelWidth()
  const ticks = Array.from({ length: Math.floor(weeks / 4) + 1 }, (_, i) => i * 4)
  const now = week > 0 ? futureSummary(roadmap, plan, week) : null

  if (!rows.length) {
    return <section className="card"><h3>Timeline</h3><p className="muted">Nothing left to schedule: every step is done or assumed known.</p></section>
  }

  return (
    <div className="tl-wrap">
      <div className="mapbar">
        <div className="scrub">
          <button type="button" className="play-circle" onClick={() => { if (!playing && week >= max) setWeek(0); setPlaying(!playing) }} aria-pressed={playing}
            aria-label={playing ? 'Pause the timeline' : 'Play the timeline week by week'} title={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
          <label htmlFor="timeline-week" className="scrub-label">{week === 0 ? 'Play, or drag to a week' : `Week ${week}`}</label>
          <input id="timeline-week" type="range" min="0" max={max} value={week} onChange={(e) => { setPlaying(false); setWeek(Number(e.target.value)) }} />
          <span className="scrub-readout" aria-live="polite">
            {now ? `${readyByDate(week)} · ${now.finished} more step${now.finished === 1 ? '' : 's'} done · ${now.percent}% ready` : `Today · ${plan.summary.percent_ready}% ready`}
          </span>
        </div>
      </div>

      <div className="tl-scroll" role="region" aria-label="Timeline of your plan. Scroll sideways to see later weeks.">
        <div className="tl-inner" style={{ width: LABEL + trackWidth + 32, '--tl-label': `${LABEL}px` }}>
          <div className="tl-axis" style={{ marginLeft: LABEL, width: trackWidth }}>
            {ticks.map((w) => <span key={w} className="tl-tick" style={{ left: w * px }}>{w === 0 ? 'Now' : `Wk ${w}`}<small>{readyByDate(w).replace(/ \d{4}$/, '')}</small></span>)}
          </div>
          {rows.map(({ step, info }) => {
            const start = info.start_week ?? 0
            const end = info.end_week ?? start
            const fill = week <= start ? 0 : Math.min(1, (week - start) / Math.max(end - start, 0.1))
            const kind = KINDS[step.kind] ?? KINDS.skill
            const classes = ['tl-bar', `kind-${step.kind}`, info.critical ? 'is-critical' : '', selectedId === step.id ? 'is-selected' : '', fill >= 1 ? 'is-done' : ''].join(' ')
            return (
              <div className="tl-row" key={step.id}>
                <span className="tl-label">
                  <span className="tl-title" title={step.title}><span aria-hidden="true">{kind.icon}</span> {step.title}</span>
                  <small>{roadmap.phases[step.phase - 1] ?? `Phase ${step.phase}`}</small></span>
                <div className="tl-track" style={{ width: trackWidth, backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${px * 4 - 1}px, #1d1822 ${px * 4 - 1}px, #1d1822 ${px * 4}px)` }}>
                  <button type="button" className={classes} style={{ left: start * px, width: Math.max((end - start) * px, 34) }} onClick={() => onSelect(step.id)}
                    title={`${step.title}: weeks ${Math.floor(start) + 1} to ${Math.max(Math.ceil(end), Math.floor(start) + 1)}, ${step.hours} hours`}
                    aria-label={`${step.title}. ${kind.label}, ${step.hours} hours, weeks ${Math.floor(start) + 1} to ${Math.max(Math.ceil(end), Math.floor(start) + 1)}${info.critical ? ', on the longest chain' : ''}. Open details.`}>
                    <span className="tl-fill" style={{ width: `${fill * 100}%` }} />
                    <span className="tl-text">{step.hours}h{info.critical ? ' ★' : ''}</span>
                  </button>
                </div>
              </div>
            )
          })}
          {max > 0 && <div className="tl-marker" style={{ left: LABEL + week * px }} aria-hidden="true"><span>{week === 0 ? 'Now' : `Wk ${week}`}</span></div>}
        </div>
      </div>

      <p className="notice tl-foot">
        {done.length} step{done.length === 1 ? ' is' : 's are'} already done or assumed known and not shown.
        {stretch.length > 0 && <> {stretch.length} optional step{stretch.length === 1 ? ' is' : 's are'} left out to fit your deadline: {stretch.map((s) => s.title).join(', ')}.</>}
      </p>
    </div>
  )
}
