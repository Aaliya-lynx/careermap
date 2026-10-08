import { useMemo, useState } from 'react'
import { Background, Controls, Handle, Panel, Position, ReactFlow, getViewportForBounds, useReactFlow } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { KINDS, STATUS_LABEL } from '../format.js'
import { download, fileName } from '../exports.js'

const COLUMN = 340
const ROW = 132
const TOP = 90
const NODE_W = 270
const NODE_H = 56

const LINE_COLOR = { 'edge-critical': '#ffb547', 'edge-done': '#3ddc97', 'edge-stretch': '#5b6794', 'edge-plain': '#4a5a8a' }

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
  g.fillStyle = '#0b1020'
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
  const { step, info, selected, onSelect, dim, startHere } = data
  const kind = KINDS[step.kind] ?? KINDS.skill
  const locked = info.status === 'todo' && !info.available
  const classes = ['step', `is-${info.status}`, info.critical ? 'is-critical' : '', locked ? 'is-locked' : '',
    info.available ? 'is-available' : '', selected ? 'is-selected' : '', dim ? 'is-dim' : ''].join(' ')
  return (
    <button type="button" className={classes} onClick={() => onSelect(step.id)}
      aria-label={`${step.title}. ${kind.label}, ${step.hours} hours. ${STATUS_LABEL[info.status]}${info.critical ? ', on the longest chain' : ''}${startHere ? ', start here' : ''}. Open details.`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {startHere && <span className="start-tag">Start here</span>}
      <span className="step-icon" aria-hidden="true">{info.status === 'known' || info.status === 'implied' ? '✓' : kind.icon}</span>
      <span className="step-body">
        <span className="step-title">{step.title}</span>
        <span className="step-meta">
          {kind.label} · {step.hours}h
          {info.start_week != null && <> · wk {Math.floor(info.start_week) + 1}</>}
        </span>
      </span>
      {info.critical && <span className="step-flag" title="On the longest chain">★</span>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </button>
  )
}

function ZoneNode({ data }) {
  return (
    <div className={`zone ${data.complete ? 'is-complete' : ''}`} style={{ width: data.width, height: data.height }}>
      <span className="zone-label">{data.index}. {data.label}{data.complete ? ' ✓' : ''}</span>
    </div>
  )
}

const nodeTypes = { step: StepNode, zone: ZoneNode }

// On a phone, fitting the whole tree makes the text unreadable: start zoomed in at the first column and let the user pan.
const narrowScreen = () => window.matchMedia('(max-width: 900px)').matches

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

export default function Graph({ roadmap, plan, selectedId, onSelect, expanded, onToggleExpand }) {
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
        data: { label: roadmap.phases[p - 1] ?? `Phase ${p}`, index: column + 1, width: COLUMN - 40, height, complete: done?.complete },
        draggable: false, selectable: false, focusable: false,
      })
      byPhase[p].forEach((step, row) => {
        spot[step.id] = { x: column * COLUMN, y: TOP + row * ROW }
        flowNodes.push({
          id: step.id, type: 'step', position: { x: column * COLUMN, y: TOP + row * ROW }, draggable: false,
          data: { step, info: plan.nodes[step.id], selected: step.id === selectedId, onSelect,
            dim: related ? !related.has(step.id) : false, startHere: step.id === startId },
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
  }, [roadmap, plan, selectedId, onSelect])

  return (
    <div className="graph-wrap">
    <div className={`graph ${expanded ? 'is-full' : ''}`} role="region"
      aria-label="Interactive roadmap. Drag to pan, scroll or pinch to zoom, and press Tab to move between steps.">
      <ReactFlow key={expanded ? 'full' : 'normal'} nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        {...(narrowScreen() ? { defaultViewport: { x: 10, y: 6, zoom: 0.8 } } : { fitView: true, fitViewOptions: { padding: 0.12 } })}
        minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        onPaneClick={() => selectedId && onSelect(null)} proOptions={{ hideAttribution: true }}>
        <Background gap={28} size={1} color="rgba(140,160,220,0.14)" />
        <Controls showInteractive={false} />
        <Tools title={roadmap.title} box={box} lines={lines} expanded={expanded} onToggleExpand={onToggleExpand} />
      </ReactFlow>
      {expanded && <Legend overlay />}
      {selectedId && <p className="focus-hint" role="status">Showing what this step needs and what it unlocks. Tap empty space to clear.</p>}
    </div>
    {!expanded && <Legend />}
    </div>
  )
}
