import { useMemo } from 'react'
import { Background, Controls, Handle, Position, ReactFlow } from '@xyflow/react'
import { KINDS, STATUS_LABEL } from '../format.js'

const COLUMN = 330
const ROW = 128
const TOP = 90

function StepNode({ data }) {
  const { step, info, selected, onSelect } = data
  const kind = KINDS[step.kind] ?? KINDS.skill
  const locked = info.status === 'todo' && !info.available
  const classes = ['step', `is-${info.status}`, info.critical ? 'is-critical' : '', locked ? 'is-locked' : '',
    info.available ? 'is-available' : '', selected ? 'is-selected' : ''].join(' ')
  return (
    <button type="button" className={classes} onClick={() => onSelect(step.id)}
      aria-label={`${step.title}. ${kind.label}, ${step.hours} hours. ${STATUS_LABEL[info.status]}${info.critical ? ', on the longest chain' : ''}. Open details.`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
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

export default function Graph({ roadmap, plan, selectedId, onSelect }) {
  const { nodes, edges } = useMemo(() => {
    const byPhase = {}
    roadmap.nodes.forEach((n) => (byPhase[n.phase] ||= []).push(n))
    const phaseNumbers = Object.keys(byPhase).map(Number).sort((a, b) => a - b)
    const tallest = Math.max(...phaseNumbers.map((p) => byPhase[p].length))
    const height = TOP + tallest * ROW + 10

    const flowNodes = []
    phaseNumbers.forEach((p, column) => {
      const done = plan.phases.find((x) => x.phase === p)
      flowNodes.push({
        id: `zone-${p}`, type: 'zone', position: { x: column * COLUMN - 14, y: 0 }, zIndex: -1,
        data: { label: roadmap.phases[p - 1] ?? `Phase ${p}`, index: column + 1, width: COLUMN - 40, height, complete: done?.complete },
        draggable: false, selectable: false, focusable: false,
      })
      byPhase[p].forEach((step, row) => {
        flowNodes.push({
          id: step.id, type: 'step', position: { x: column * COLUMN, y: TOP + row * ROW }, draggable: false,
          data: { step, info: plan.nodes[step.id], selected: step.id === selectedId, onSelect },
        })
      })
    })

    const path = plan.summary.critical_path
    const onPath = new Set(path.slice(1).map((id, i) => `${path[i]}->${id}`))
    const flowEdges = []
    roadmap.nodes.forEach((n) => n.requires.forEach((r) => {
      const from = plan.nodes[r]
      const critical = onPath.has(`${r}->${n.id}`)
      const finished = from.status === 'known' || from.status === 'implied'
      const stretch = plan.nodes[n.id].status === 'stretch'
      flowEdges.push({
        id: `${r}->${n.id}`, source: r, target: n.id, type: 'smoothstep', animated: critical,
        className: critical ? 'edge-critical' : finished ? 'edge-done' : stretch ? 'edge-stretch' : 'edge-plain',
      })
    }))
    return { nodes: flowNodes, edges: flowEdges }
  }, [roadmap, plan, selectedId, onSelect])

  return (
    <div className="graph" role="region" aria-label="Interactive roadmap. Drag to pan, scroll or pinch to zoom, and press Tab to move between steps.">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        {...(narrowScreen() ? { defaultViewport: { x: 10, y: 6, zoom: 0.8 } } : { fitView: true, fitViewOptions: { padding: 0.12 } })}
        minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        proOptions={{ hideAttribution: true }}>
        <Background gap={28} size={1} color="rgba(140,160,220,0.14)" />
        <Controls showInteractive={false} />
</ReactFlow>
      <ul className="legend" aria-label="Legend">
        <li><i className="dot dot-known" /> Known</li>
        <li><i className="dot dot-available" /> Ready to start</li>
        <li><i className="dot dot-critical" /> Longest chain</li>
        <li><i className="dot dot-stretch" /> Stretch (over budget)</li>
      </ul>
    </div>
  )
}
