import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, Handle, Panel, Position, ReactFlow, useReactFlow } from '@xyflow/react'
import { KINDS, STATUS_LABEL } from '../format.js'
import { relatedTo } from '../graphUtils.js'
import { fanLayout } from '../fanLayout.js'

const ORB_W = 170    // width of a step (its medallion and its name)
const CORE = 90      // width of the medallion itself
const CENTRE = { left: ORB_W / 2, top: CORE / 2, opacity: 0, pointerEvents: 'none' }   // lines join at the middle of the medallion

// A step as a medallion on the fan. Locked steps show a padlock, ready ones pulse, finished ones are ticked.
// The coloured number is its place in the suggested order, and the colour is its branch.
function Orb({ data }) {
  const { step, info, number, selected, dim, fresh, startHere, onSelect, onToggle } = data
  const kind = KINDS[step.kind] ?? KINDS.skill
  const done = info.status === 'known' || info.status === 'implied'
  const state = done ? 'known' : info.status === 'stretch' ? 'stretch' : info.available ? 'available' : 'locked'
  const classes = ['orb', `kind-${step.kind}`, `is-${state}`, info.critical ? 'is-critical' : '', selected ? 'is-selected' : '', dim ? 'is-dim' : '', fresh ? 'just-unlocked' : ''].join(' ')
  const stateText = done ? 'unlocked' : state === 'available' ? 'ready to unlock' : state === 'stretch' ? 'stretch step' : 'locked until its prerequisites are done'
  return (
    <div className={classes}>
      <Handle type="target" position={Position.Top} isConnectable={false} style={CENTRE} />
      <Handle type="source" position={Position.Top} isConnectable={false} style={CENTRE} />
      <button type="button" className="orb-core" onClick={() => onSelect(step.id)} title={`${step.why || step.title} (${step.hours} hours)`}
        aria-label={`Step ${number}: ${step.title}. ${kind.label}, ${step.hours} hours, ${stateText}${info.critical ? ', on the longest chain' : ''}. Open details.`}>
        <span aria-hidden="true">{done ? '✓' : state === 'locked' ? '🔒' : kind.icon}</span>
      </button>
      <span className="orb-num" aria-hidden="true">{number}</span>
      {startHere && <span className="start-tag orb-start">Start here</span>}
      {info.status !== 'implied' && (
        <button type="button" className="orb-tick" onClick={() => onToggle(step.id)} aria-pressed={done}
          aria-label={done ? `Mark ${step.title} as not known` : `I already know ${step.title}`} title={done ? 'Click to lock it again' : 'Click to unlock it: I already know this'}>
          {done ? '↺' : '✓'}
        </button>
      )}
      <span className="orb-label">{step.title}</span>
      <span className="orb-meta">{kind.label} · {step.hours}h{info.critical ? ' ★' : ''}</span>
    </div>
  )
}

// The start of the climb, at the bottom of the fan.
function RootNode() {
  return (
    <div className="fan-root" aria-label="You are here. Start of the roadmap.">
      <Handle type="source" position={Position.Top} isConnectable={false} style={{ left: '50%', top: '50%', opacity: 0, pointerEvents: 'none' }} />
      <span className="fan-root-dot" aria-hidden="true">◈</span>
      <span className="fan-root-label">You are here</span>
    </div>
  )
}

// Curved arcs, one for each phase, with the phase name under the left end of its arc.
function RingsNode({ data }) {
  const { width, height, root, rings, names } = data
  return (
    <svg className="fan-rings" width={width} height={height} aria-hidden="true">
      <line x1={root.x - rings[rings.length - 1].radius - 40} y1={root.y} x2={root.x + rings[rings.length - 1].radius + 40} y2={root.y} className="fan-base" />
      {rings.map((ring) => (
        <g key={ring.index}>
          <path className="fan-arc" d={`M ${root.x - ring.radius} ${root.y} A ${ring.radius} ${ring.radius} 0 0 1 ${root.x + ring.radius} ${root.y}`} />
          <text className="fan-ring-name" transform={`rotate(-90 ${root.x - ring.radius - 12} ${root.y - 10})`} x={root.x - ring.radius - 12} y={root.y - 10}>
            {ring.index + 1} · {names[ring.index].length > 28 ? `${names[ring.index].slice(0, 27)}…` : names[ring.index]}
          </text>
        </g>
      ))}
    </svg>
  )
}

const nodeTypes = { orb: Orb, root: RootNode, rings: RingsNode }
const touchScreen = () => window.matchMedia('(pointer: coarse)').matches

function Tools({ expanded, onToggleExpand }) {
  const { fitView } = useReactFlow()
  return (
    <Panel position="top-right" className="graph-tools">
      <button type="button" className="tool" onClick={() => fitView({ padding: 0.1, duration: 300 })}>Fit all</button>
      <button type="button" className="tool" onClick={onToggleExpand} aria-pressed={expanded}>{expanded ? 'Exit full screen' : 'Full screen'}</button>
    </Panel>
  )
}

function TreeLegend({ overlay }) {
  return (
    <details className={`legend ${overlay ? 'legend-overlay' : 'legend-below'}`} open={false}>
      <summary>How to read the skill tree</summary>
      <div className="legend-body">
        <p className="legend-note">Start at the bottom and follow the numbers outward: each arc is a phase, and a step sits near the steps it builds on. The colour of a number tells you the kind of step. A step unlocks when everything it needs is done.</p>
        <ul className="legend-kinds">
          <li><i className="swatch kind-dot kind-skill" /> <span><strong>Skills</strong></span></li>
          <li><i className="swatch kind-dot kind-project" /> <span><strong>Projects</strong></span></li>
          <li><i className="swatch kind-dot kind-cert" /> <span><strong>Certifications</strong></span></li>
          <li><i className="swatch kind-dot kind-role" /> <span><strong>Roles</strong></span></li>
        </ul>
        <ul>
          <li><i className="swatch orb-swatch is-known" /> <span><strong>Green tick:</strong> unlocked (known, or assumed known).</span></li>
          <li><i className="swatch orb-swatch is-available" /> <span><strong>Pulsing mauve ring:</strong> ready to unlock now.</span></li>
          <li><i className="swatch orb-swatch is-locked" /> <span><strong>Padlock:</strong> locked until the steps it needs are done.</span></li>
        </ul>
        <ul>
          <li><i className="swatch orb-swatch is-critical" /> <span><strong>Gold ring and ★:</strong> on the longest chain, which sets your date.</span></li>
          <li><i className="swatch line-green" /> <span><strong>Lit green line:</strong> the step it comes from is unlocked.</span></li>
          <li><i className="swatch orb-swatch is-stretch" /> <span><strong>Dashed ring:</strong> optional stretch step, left out of your plan.</span></li>
        </ul>
      </div>
    </details>
  )
}

export default function SkillTree({ roadmap, plan, selectedId, onSelect, onToggleKnown, highlight, onClearHighlight, expanded, onToggleExpand }) {
  const [fresh, setFresh] = useState(() => new Set())
  const previous = useRef(null)

  // Steps that just became unlocked get a short burst, so ticking something feels like a reward.
  useEffect(() => {
    const now = new Set(roadmap.nodes.filter((n) => ['known', 'implied'].includes(plan.nodes[n.id].status)).map((n) => n.id))
    const before = previous.current
    previous.current = now
    if (!before) return undefined
    const added = [...now].filter((id) => !before.has(id))
    if (!added.length) return undefined
    setFresh(new Set(added))
    const timer = setTimeout(() => setFresh(new Set()), 1500)
    return () => clearTimeout(timer)
  }, [plan, roadmap])

  const { nodes, edges, size } = useMemo(() => {
    const fan = fanLayout(roadmap.nodes, plan.order)
    const byId = Object.fromEntries(roadmap.nodes.map((n) => [n.id, n]))
    const related = selectedId ? relatedTo(selectedId, roadmap.nodes) : null
    const lit = highlight ? new Set(highlight.ids) : null
    const startId = plan.order.find((id) => plan.nodes[id].available)
    const names = fan.rings.map((ring) => roadmap.phases[ring.phase - 1] ?? `Phase ${ring.phase}`)

    const flowNodes = [
      { id: 'fan-rings', type: 'rings', position: { x: 0, y: 0 }, zIndex: -1, draggable: false, selectable: false, focusable: false,
        data: { width: fan.size.width, height: fan.size.height, root: fan.root, rings: fan.rings, names } },
      { id: 'fan-root', type: 'root', position: { x: fan.root.x - 48, y: fan.root.y - 48 }, draggable: false, selectable: false, focusable: false, data: {} },
      ...fan.orbs.map((o) => {
        const step = byId[o.id]
        return {
          id: step.id, type: 'orb', position: { x: o.x - ORB_W / 2, y: o.y - CORE / 2 }, draggable: false,
          data: { step, info: plan.nodes[step.id], number: o.number, selected: step.id === selectedId, fresh: fresh.has(step.id), startHere: step.id === startId,
            dim: (related ? !related.has(step.id) : false) || (lit ? !lit.has(step.id) : false), onSelect, onToggle: onToggleKnown },
        }
      }),
    ]

    const path = plan.summary.critical_path
    const onPath = new Set(path.slice(1).map((id, i) => `${path[i]}->${id}`))
    const flowEdges = []
    roadmap.nodes.forEach((n) => {
      if (!n.requires.length) flowEdges.push({ id: `fan-root->${n.id}`, source: 'fan-root', target: n.id, type: 'straight', className: 'edge-plain edge-root' })
      n.requires.forEach((r) => {
        const critical = onPath.has(`${r}->${n.id}`)
        const unlocked = ['known', 'implied'].includes(plan.nodes[r].status)
        const kind = critical ? 'edge-critical' : unlocked ? 'edge-done' : plan.nodes[n.id].status === 'stretch' ? 'edge-stretch' : 'edge-plain'
        const focus = related ? (related.has(r) && related.has(n.id) ? 'edge-focus' : 'edge-dim') : ''
        flowEdges.push({ id: `${r}->${n.id}`, source: r, target: n.id, type: 'straight', animated: false, className: `${kind} ${focus} ${unlocked ? 'edge-lit' : ''}` })
      })
    })
    return { nodes: flowNodes, edges: flowEdges, size: fan.size }
  }, [roadmap, plan, selectedId, onSelect, onToggleKnown, highlight, fresh])

  // The tree grows upwards: open on the bottom tier at a readable size.
  const zoom = 0.85
  const viewW = expanded ? window.innerWidth : Math.min(window.innerWidth, 1500) - 60
  const viewH = expanded ? window.innerHeight : Math.min(820, Math.max(520, window.innerHeight * 0.74))
  const start = { x: Math.max(8, (viewW - size.width * zoom) / 2), y: Math.min(8, viewH - size.height * zoom - 16), zoom }

  const level = plan.phases.filter((p) => p.complete).length + 1
  const next = plan.order.find((id) => plan.nodes[id].available)

  return (
    <div className="graph-wrap">
      <div className={`graph tree ${expanded ? 'is-full' : ''}`} role="region"
        aria-label="Skill tree. Start at the bottom and follow the numbers outward. Drag to pan, hold Control and scroll or pinch to zoom, and press Tab to move between steps.">
        <ReactFlow key={expanded ? 'full' : 'normal'} nodes={nodes} edges={edges} nodeTypes={nodeTypes} {...(expanded ? { defaultViewport: start } : { fitView: true, fitViewOptions: { padding: 0.06, minZoom: window.innerWidth < 700 ? 0.45 : 0.3, maxZoom: 0.9 } })}
          minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          zoomOnScroll={expanded} preventScrolling={expanded} zoomActivationKeyCode={['Control', 'Meta']} panOnDrag={expanded || !touchScreen()}
          onPaneClick={() => selectedId && onSelect(null)} proOptions={{ hideAttribution: true }}>
          <Background gap={32} size={1.6} color="#e3d3ee" />
          <Controls showInteractive={false} />
          <Tools expanded={expanded} onToggleExpand={onToggleExpand} />
          <Panel position="bottom-right" className="level-badge">
            <strong>Level {level}</strong>
            <span className="xp" role="img" aria-label={`${plan.summary.percent_ready} percent ready`}><span style={{ width: `${plan.summary.percent_ready}%` }} /></span>
            <span className="muted">{plan.summary.percent_ready}% XP{next ? ` · next unlock: ${roadmap.nodes.find((n) => n.id === next)?.title}` : ' · everything unlocked'}</span>
          </Panel>
        </ReactFlow>
        {highlight && (
          <p className="path-banner" role="status" style={{ top: 'auto', bottom: 12 }}>Route: <strong>{highlight.name}</strong>
            <button type="button" className="tool" onClick={onClearHighlight}>Show all steps</button></p>
        )}
        {selectedId && <p className="focus-hint" role="status">Showing what this step needs and unlocks. Tap empty space to clear.</p>}
        {expanded && <TreeLegend overlay />}
      </div>
      {!expanded && <TreeLegend />}
    </div>
  )
}
