import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, Handle, Panel, Position, ReactFlow, getViewportForBounds, useReactFlow } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { KINDS, STATUS_LABEL, readyByDate } from '../format.js'
import { download, fileName } from '../exports.js'

const COLUMN = 340
const ROW = 104
const TOP = 80
const NODE_W = 270
const NODE_H = 56

const LINE_COLOR = { 'edge-critical': '#d68a0c', 'edge-done': '#5db487', 'edge-stretch': '#b7bfcc', 'edge-plain': '#aab4c6' }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// The browser cannot photograph the thin SVG lines, so the picture of the map is made in two layers:
// the lines drawn here first, then the (transparent) photo of the steps on top, so the steps cover the line ends.
async function withLines(photoUrl, lines, view, width, height) {
  const photo = await loadImage(photoUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  g.fillStyle = '#fbfcfd'
  g.fillRect(0, 0, width, height)
  const at = (x, y) => [view.x + view.zoom * x, view.y + view.zoom * y]
  for (const line of lines) {
    const [sx, sy] = at(line.from.x, line.from.y)
    const [tx, ty] = at(line.to.x, line.to.y)
    const mid = (sx + tx) / 2
    g.beginPath()
    g.moveTo(sx, sy)
    g.bezierCurveTo(mid, sy, mid, ty, tx, ty)
    g.strokeStyle = LINE_COLOR[line.kind] ?? LINE_COLOR['edge-plain']
    g.lineWidth = (line.kind === 'edge-critical' ? 3.5 : 2.2) * view.zoom
    g.setLineDash(line.kind === 'edge-stretch' ? [6 * view.zoom, 7 * view.zoom] : [])
    g.globalAlpha = line.kind === 'edge-plain' ? 0.8 : 1
    g.stroke()
  }
  g.globalAlpha = 1
  g.drawImage(photo, 0, 0)
  return canvas.toDataURL('image/png')
}

function StepNode({ data }) {
  const { step, info, selected, onSelect, onToggle, dim, startHere, sim } = data
  const kind = KINDS[step.kind] ?? KINDS.skill
  const locked = info.status === 'todo' && !info.available
  const done = info.status === 'known' || info.status === 'implied'
  const classes = ['step', `is-${info.status}`, info.critical ? 'is-critical' : '', locked ? 'is-locked' : '', info.available ? 'is-available' : '',
    selected ? 'is-selected' : '', dim ? 'is-dim' : '', sim ? `sim-${sim}` : ''].join(' ')
  return (
    <div className={classes}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {startHere && <span className="start-tag">Start here</span>}
      <button type="button" className="step-icon step-check" onClick={() => onToggle(step.id)} disabled={info.status === 'implied'}
        aria-pressed={done} aria-label={info.status === 'implied' ? `${step.title} is assumed known` : `I already know ${step.title}`}
        title={info.status === 'implied' ? 'Assumed known because you know a later step' : done ? 'Click to mark as not known' : 'Click to mark as known'}>
        {done || sim === 'done' ? '✓' : kind.icon}
      </button>
      <button type="button" className="step-main" onClick={() => onSelect(step.id)} title={`${step.why || step.title} (${step.hours} hours)`}
        aria-label={`${step.title}. ${kind.label}, ${step.hours} hours. ${STATUS_LABEL[info.status]}${info.critical ? ', on the longest chain' : ''}${startHere ? ', start here' : ''}. Open details.`}>
        <span className="step-body">
          <span className="step-title">{step.title}</span>
          <span className="step-meta">
            {kind.label} · {step.hours}h
            {info.start_week != null && <> · wk {Math.floor(info.start_week) + 1}</>}
          </span>
        </span>
        {info.critical && <span className="step-flag" title="On the longest chain">★</span>}
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}

function ZoneNode({ data }) {
  const { fitBounds } = useReactFlow()
  return (
    <div className={`zone ${data.complete ? 'is-complete' : ''}`} style={{ width: data.width, height: data.height }}>
      <button type="button" className="zone-label" title="Centre the map on this phase"
        onClick={() => fitBounds({ x: data.x, y: 0, width: data.width, height: data.height }, { padding: 0.12, duration: 450 })}>
        {data.index}. {data.label}{data.complete ? ' ✓' : ''}
      </button>
    </div>
  )
}

const nodeTypes = { step: StepNode, zone: ZoneNode }

// On a phone, fitting the whole tree makes the text unreadable: start zoomed in at the first column and let the user pan.
const narrowScreen = () => window.matchMedia('(max-width: 900px)').matches

// Fitting every column on screen is only fine when the text stays readable (zoom 0.85 or more).
// Otherwise start at a readable zoom on the first column: drag to move, and "Fit all" shows everything.
function startView(columns, rows, expanded) {
  const width = expanded ? window.innerWidth - 20 : Math.min(window.innerWidth, 1500) - 60
  const height = expanded ? window.innerHeight : Math.min(820, Math.max(520, window.innerHeight * 0.74))
  const fit = Math.min(width / (columns * COLUMN), height / (TOP + rows * ROW + 10))      // zoom needed to show everything
  if (!narrowScreen() && fit >= 0.8) return { fitView: true, fitViewOptions: { padding: 0.08 } }
  return { defaultViewport: { x: 16, y: 8, zoom: narrowScreen() ? 0.8 : 0.95 } }
}

// Everything a step needs (before it) and everything it unlocks (after it).
function relatedTo(id, nodes) {
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

// In "future" mode a step you have not done yet is shown as done once its planned finish week has passed.
function simFor(info, week) {
  if (week <= 0 || info.status === 'known' || info.status === 'implied' || info.status === 'stretch') return null
  return info.end_week != null && info.end_week <= week ? 'done' : 'later'
}

function Legend({ overlay }) {
  return (
    <details className={`legend ${overlay ? 'legend-overlay' : 'legend-below'}`} open={!overlay}>
      <summary>How to read the map: what each line and colour means</summary>
      <div className="legend-body">
        <p className="legend-note">Lines run left to right: a step needs the steps on its left to be done first.</p>
        <div>
          <h4>Lines</h4>
          <ul>
            <li><i className="swatch line-amber" /> <span><strong>Gold: longest chain.</strong> These steps decide your ready-by date. Speed them up to finish sooner.</span></li>
            <li><i className="swatch line-green" /> <span><strong>Green: done.</strong> The step it comes from is already finished.</span></li>
            <li><i className="swatch line-grey" /> <span><strong>Grey: needed first.</strong> Finish the step on the left to unlock the one on the right.</span></li>
            <li><i className="swatch line-dash" /> <span><strong>Dashed: stretch.</strong> Optional, and left out to fit your deadline.</span></li>
            <li><i className="swatch line-violet" /> <span><strong>Purple: selected.</strong> What the step you tapped needs and what it unlocks.</span></li>
          </ul>
        </div>
        <div>
          <h4>Steps</h4>
          <ul>
            <li><i className="swatch box-green" /> <span><strong>Green tick:</strong> known, or assumed known.</span></li>
            <li><i className="swatch box-cyan" /> <span><strong>Blue glow:</strong> ready to start now.</span></li>
            <li><i className="swatch box-plain" /> <span><strong>Dim:</strong> waiting on earlier steps.</span></li>
            <li><i className="swatch box-amber" /> <span><strong>Gold glow and ★:</strong> on the longest chain.</span></li>
            <li><i className="swatch box-dash" /> <span><strong>Dashed:</strong> stretch step.</span></li>
          </ul>
        </div>
      </div>
    </details>
  )
}

const FILTERS = [['all', 'All'], ['skill', 'Skills'], ['project', 'Projects'], ['cert', 'Certificates'], ['role', 'Roles']]

// What the map would look like in a given week, if you keep to your plan.
function futureSummary(roadmap, plan, week) {
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

function MapControls({ roadmap, plan, filter, onFilter, week, onWeek, playing, onPlaying }) {
  const max = plan.summary.weeks_needed
  const now = week > 0 ? futureSummary(roadmap, plan, week) : null
  return (
    <div className="mapbar">
      <div className="filters" role="group" aria-label="Show only">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={`filter-chip ${filter === key ? 'is-on' : ''}`} aria-pressed={filter === key} onClick={() => onFilter(key)}>{label}</button>
        ))}
      </div>
      {max > 0 && (
        <div className="scrub">
          <button type="button" className="tool" onClick={() => { if (!playing && week >= max) onWeek(0); onPlaying(!playing) }} aria-pressed={playing}>{playing ? 'Pause' : 'Play my plan'}</button>
          <label htmlFor="week-slider" className="scrub-label">
            {week === 0 ? 'Drag to see your future' : `Week ${week}`}
          </label>
          <input id="week-slider" type="range" min="0" max={max} value={week} onChange={(e) => { onPlaying(false); onWeek(Number(e.target.value)) }} />
          <span className="scrub-readout" aria-live="polite">
            {now ? `${readyByDate(week)} · ${now.finished} more step${now.finished === 1 ? '' : 's'} done · ${now.percent}% ready` : `Today · ${plan.summary.percent_ready}% ready`}
          </span>
        </div>
      )}
    </div>
  )
}

function Tools({ title, box, lines, expanded, onToggleExpand }) {
  const { fitView } = useReactFlow()
  const [busy, setBusy] = useState(false)

  async function saveImage() {
    setBusy(true)
    try {
      const width = 2000
      const height = Math.max(600, Math.round((width * box.height) / box.width))
      const view = getViewportForBounds(box, width, height, 0.1, 2, 0.03)
      const photo = await toPng(document.querySelector('.react-flow__viewport'), {
        width, height, pixelRatio: 1,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` },
      })
      const url = await withLines(photo, lines, view, width, height)
      download(fileName(title, 'png'), url)
    } catch {
      window.alert('Sorry, the image could not be created in this browser. Try the Markdown download instead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel position="top-right" className="graph-tools">
      <button type="button" className="tool" onClick={() => fitView({ padding: 0.12, duration: 300 })}>Fit all</button>
      <button type="button" className="tool" onClick={saveImage} disabled={busy}>{busy ? 'Saving…' : 'Save image'}</button>
      <button type="button" className="tool" onClick={onToggleExpand} aria-pressed={expanded}>{expanded ? 'Exit full screen' : 'Full screen'}</button>
    </Panel>
  )
}

export default function Graph({ roadmap, plan, selectedId, onSelect, onToggleKnown, expanded, onToggleExpand }) {
  const [filter, setFilter] = useState('all')
  const [week, setWeek] = useState(0)
  const [playing, setPlaying] = useState(false)
  const maxWeek = plan.summary.weeks_needed

  // "Play my plan": move through the weeks, one step of the slider at a time.
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setWeek((w) => {
        if (w >= maxWeek) { setPlaying(false); return w }
        return w + 1
      })
    }, 380)
    return () => clearInterval(timer)
  }, [playing, maxWeek])
  useEffect(() => { if (week > maxWeek) setWeek(0) }, [maxWeek, week])

  const { nodes, edges, box, lines } = useMemo(() => {
    const byPhase = {}
    roadmap.nodes.forEach((n) => (byPhase[n.phase] ||= []).push(n))
    const phaseNumbers = Object.keys(byPhase).map(Number).sort((a, b) => a - b)
    const tallest = Math.max(...phaseNumbers.map((p) => byPhase[p].length))
    const height = TOP + tallest * ROW + 10
    const related = selectedId ? relatedTo(selectedId, roadmap.nodes) : null
    const startId = plan.order.find((id) => plan.nodes[id].available)

    const flowNodes = []
    const spot = {}
    phaseNumbers.forEach((p, column) => {
      const done = plan.phases.find((x) => x.phase === p)
      flowNodes.push({
        id: `zone-${p}`, type: 'zone', position: { x: column * COLUMN - 14, y: 0 }, zIndex: -1,
        data: { label: roadmap.phases[p - 1] ?? `Phase ${p}`, index: column + 1, x: column * COLUMN - 14, width: COLUMN - 40, height, complete: done?.complete },
        draggable: false, selectable: false, focusable: false,
      })
      byPhase[p].forEach((step, row) => {
        spot[step.id] = { x: column * COLUMN, y: TOP + row * ROW }
        flowNodes.push({
          id: step.id, type: 'step', position: { x: column * COLUMN, y: TOP + row * ROW }, draggable: false,
          data: { step, info: plan.nodes[step.id], selected: step.id === selectedId, onSelect, onToggle: onToggleKnown,
            dim: (related ? !related.has(step.id) : false) || (filter !== 'all' && step.kind !== filter),
            startHere: step.id === startId && week === 0, sim: simFor(plan.nodes[step.id], week) },
        })
      })
    })

    const path = plan.summary.critical_path
    const onPath = new Set(path.slice(1).map((id, i) => `${path[i]}->${id}`))
    const flowEdges = []
    const flowLines = []
    roadmap.nodes.forEach((n) => n.requires.forEach((r) => {
      const from = plan.nodes[r]
      const critical = onPath.has(`${r}->${n.id}`)
      const finished = from.status === 'known' || from.status === 'implied'
      const stretch = plan.nodes[n.id].status === 'stretch'
      const kind = critical ? 'edge-critical' : finished ? 'edge-done' : stretch ? 'edge-stretch' : 'edge-plain'
      const focus = related ? (related.has(r) && related.has(n.id) ? 'edge-focus' : 'edge-dim') : ''
      flowLines.push({ kind, from: { x: spot[r].x + NODE_W, y: spot[r].y + NODE_H / 2 }, to: { x: spot[n.id].x, y: spot[n.id].y + NODE_H / 2 } })
      flowEdges.push({ id: `${r}->${n.id}`, source: r, target: n.id, type: 'smoothstep', animated: critical, className: `${kind} ${focus}` })
    }))
    return { nodes: flowNodes, edges: flowEdges, box: { x: -14, y: 0, width: phaseNumbers.length * COLUMN - 26, height }, lines: flowLines }
  }, [roadmap, plan, selectedId, onSelect, onToggleKnown, filter, week])

  return (
    <div className="graph-wrap">
    {!expanded && <MapControls roadmap={roadmap} plan={plan} filter={filter} onFilter={setFilter} week={week} onWeek={setWeek} playing={playing} onPlaying={setPlaying} />}
    <div className={`graph ${expanded ? 'is-full' : ''}`} role="region"
      aria-label="Interactive roadmap. Drag to pan, scroll or pinch to zoom, and press Tab to move between steps.">
      <ReactFlow key={expanded ? 'full' : 'normal'} nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        {...startView(new Set(roadmap.nodes.map((n) => n.phase)).size, Math.max(...Object.values(roadmap.nodes.reduce((c, n) => ({ ...c, [n.phase]: (c[n.phase] || 0) + 1 }), {}))), expanded)}
        minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        onPaneClick={() => selectedId && onSelect(null)} proOptions={{ hideAttribution: true }}>
        <Background gap={28} size={1.2} color="#e3e8f0" />
        <Controls showInteractive={false} />
        <Tools title={roadmap.title} box={box} lines={lines} expanded={expanded} onToggleExpand={onToggleExpand} />
        {expanded && (
          <Panel position="bottom-center" className="mapbar-overlay">
            <MapControls roadmap={roadmap} plan={plan} filter={filter} onFilter={setFilter} week={week} onWeek={setWeek} playing={playing} onPlaying={setPlaying} />
          </Panel>
        )}
      </ReactFlow>
      {expanded && <Legend overlay />}
      {selectedId && <p className="focus-hint" role="status">Showing what this step needs and what it unlocks. Tap empty space to clear.</p>}
    </div>
    {!expanded && <Legend />}
    </div>
  )
}
