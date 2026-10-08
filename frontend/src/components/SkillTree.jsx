import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, Handle, Panel, Position, ReactFlow, useReactFlow } from '@xyflow/react'
import { KINDS, STATUS_LABEL } from '../format.js'
import { relatedTo } from '../graphUtils.js'

const SLOT = 176     // horizontal room for one medallion
const TIER = 210     // vertical room for one tier
const ORB_W = 150
const TOP_PAD = 84   // headroom for the level badge

// A step as a game-style medallion. Locked steps show a padlock, ready ones pulse, finished ones are ticked.
function Orb({ data }) {
  const { step, info, selected, dim, fresh, startHere, onSelect, onToggle } = data
  const kind = KINDS[step.kind] ?? KINDS.skill
  const done = info.status === 'known' || info.status === 'implied'
  const state = done ? 'known' : info.status === 'stretch' ? 'stretch' : info.available ? 'available' : 'locked'
  const classes = ['orb', `is-${state}`, info.critical ? 'is-critical' : '', selected ? 'is-selected' : '', dim ? 'is-dim' : '', fresh ? 'just-unlocked' : ''].join(' ')
  const stateText = done ? 'unlocked' : state === 'available' ? 'ready to unlock' : state === 'stretch' ? 'stretch step' : 'locked until its prerequisites are done'
  return (
    <div className={classes}>
      <Handle type="target" position={Position.Bottom} isConnectable={false} />
      <Handle type="source" position={Position.Top} isConnectable={false} />
      <button type="button" className="orb-core" onClick={() => onSelect(step.id)} title={`${step.why || step.title} (${step.hours} hours)`}
        aria-label={`${step.title}. ${kind.label}, ${step.hours} hours, ${stateText}${info.critical ? ', on the longest chain' : ''}. Open details.`}>
        <span aria-hidden="true">{done ? '✓' : state === 'locked' ? '🔒' : kind.icon}</span>
      </button>
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

function TierNode({ data }) {
  return (
    <div className={`tier ${data.complete ? 'is-complete' : ''}`} style={{ width: data.width, height: data.height }}>
      <span className="tier-label">Tier {data.index} · {data.label}{data.complete ? ' ✓' : ''}</span>
    </div>
  )
}

const nodeTypes = { orb: Orb, tier: TierNode }
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
        <p className="legend-note">Start at the bottom and climb. A step unlocks when everything below it that it needs is done.</p>
        <ul>
          <li><i className="swatch orb-swatch is-known" /> <span><strong>Green tick:</strong> unlocked (known, or assumed known).</span></li>
          <li><i className="swatch orb-swatch is-available" /> <span><strong>Pulsing mauve ring:</strong> ready to unlock now.</span></li>
          <li><i className="swatch orb-swatch is-locked" /> <span><strong>Padlock:</strong> locked until the steps below it are done.</span></li>
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
    const phases = [...new Set(roadmap.nodes.map((n) => n.phase))].sort((a, b) => a - b)
    const byPhase = Object.fromEntries(phases.map((p) => [p, roadmap.nodes.filter((n) => n.phase === p)]))
    const widest = Math.max(...phases.map((p) => byPhase[p].length))
    const width = Math.max(widest * SLOT, 520)
    const height = phases.length * TIER
    const related = selectedId ? relatedTo(selectedId, roadmap.nodes) : null
    const lit = highlight ? new Set(highlight.ids) : null
    const startId = plan.order.find((id) => plan.nodes[id].available)

    // Place each tier, lowest first; order the steps of a tier by where their prerequisites sit, so lines cross less.
    const centreOf = {}
    const flowNodes = []
    phases.forEach((phase, tier) => {
      const steps = [...byPhase[phase]]
      const average = (step) => {
        const placed = step.requires.map((r) => centreOf[r]).filter((x) => x != null)
        return placed.length ? placed.reduce((a, b) => a + b, 0) / placed.length : width / 2
      }
      if (tier > 0) steps.sort((a, b) => average(a) - average(b))
      const y = (phases.length - 1 - tier) * TIER + TOP_PAD
      flowNodes.push({
        id: `tier-${phase}`, type: 'tier', position: { x: -40, y: y - 20 }, zIndex: -1, draggable: false, selectable: false, focusable: false,
        data: { index: tier + 1, label: roadmap.phases[phase - 1] ?? `Phase ${phase}`, width: width + 80, height: TIER - 14, complete: plan.phases.find((p) => p.phase === phase)?.complete },
      })
      steps.forEach((step, i) => {
        const cx = width / 2 + (i - (steps.length - 1) / 2) * SLOT
        centreOf[step.id] = cx
        flowNodes.push({
          id: step.id, type: 'orb', position: { x: cx - ORB_W / 2, y: y + 22 }, draggable: false,
          data: { step, info: plan.nodes[step.id], selected: step.id === selectedId, fresh: fresh.has(step.id), startHere: step.id === startId,
            dim: (related ? !related.has(step.id) : false) || (lit ? !lit.has(step.id) : false), onSelect, onToggle: onToggleKnown },
        })
      })
    })

    const path = plan.summary.critical_path
    const onPath = new Set(path.slice(1).map((id, i) => `${path[i]}->${id}`))
    const flowEdges = []
    roadmap.nodes.forEach((n) => n.requires.forEach((r) => {
      const critical = onPath.has(`${r}->${n.id}`)
      const unlocked = ['known', 'implied'].includes(plan.nodes[r].status)
      const kind = critical ? 'edge-critical' : unlocked ? 'edge-done' : plan.nodes[n.id].status === 'stretch' ? 'edge-stretch' : 'edge-plain'
      const focus = related ? (related.has(r) && related.has(n.id) ? 'edge-focus' : 'edge-dim') : ''
      flowEdges.push({ id: `${r}->${n.id}`, source: r, target: n.id, type: 'smoothstep', animated: false, className: `${kind} ${focus} ${unlocked ? 'edge-lit' : ''}` })
    }))
    return { nodes: flowNodes, edges: flowEdges, size: { width: width + 80, height: height + TOP_PAD } }
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
        aria-label="Skill tree. Start at the bottom and climb. Drag to pan, hold Control and scroll or pinch to zoom, and press Tab to move between steps.">
        <ReactFlow key={expanded ? 'full' : 'normal'} nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultViewport={start}
          minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          zoomOnScroll={expanded} preventScrolling={expanded} zoomActivationKeyCode={['Control', 'Meta']} panOnDrag={expanded || !touchScreen()}
          onPaneClick={() => selectedId && onSelect(null)} proOptions={{ hideAttribution: true }}>
          <Background gap={32} size={1.4} color="#2a232f" />
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
