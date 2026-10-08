// The layout of the skill tree: a fan that opens upward from a start node at the bottom.
//   - each phase is an arc (a ring); the first phase is closest to the start and the last phase is the outermost
//   - on every ring a step sits near the steps it builds on, so the lines fan out like branches and cross as little as possible
//   - each step gets a number: its place in the plan's suggested order
// Pure arithmetic, no React, so it is easy to test.

export const R0 = 200          // radius of the first ring
export const DR = 150          // least distance between two rings
export const MIN_GAP = 140     // least distance between two neighbouring steps on the same ring
const SPACING = 180            // the distance we would like between neighbours when there is room, so the fan uses its width
export const END_MARGIN = 0.1  // empty angle at both ends of the fan (radians)
const SIDE_PAD = 150
const TOP_PAD = 90
const BOTTOM_PAD = 120         // room below the start node for the ring names

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length

// Move sorted wanted positions as little as possible so that neighbours are at least `gap` apart (the order is kept).
// The row is then slid back inside [low, high] if it sticks out; callers make sure the row is short enough to fit.
export function spread(wanted, gap, low, high) {
  if (!wanted.length) return []
  const shifted = wanted.map((w, i) => w - i * gap)
  const blocks = []                                   // pool adjacent violators: make the shifted values non-decreasing
  for (const value of shifted) {
    blocks.push({ sum: value, count: 1 })
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]
      const a = blocks[blocks.length - 2]
      if (a.sum / a.count <= b.sum / b.count) break
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, count: a.count + b.count })
    }
  }
  let x = blocks.flatMap((b) => Array(b.count).fill(b.sum / b.count)).map((v, i) => v + i * gap)
  if (x[0] < low) { const by = low - x[0]; x = x.map((v) => v + by) }
  if (x[x.length - 1] > high) { const by = x[x.length - 1] - high; x = x.map((v) => v - by) }
  return x
}

// `nodes` are the roadmap steps; `order` lists their ids in the plan's suggested order (used for the numbers).
// Angles are measured from the left end of the fan (0) to its right end (pi).
export function fanLayout(nodes, order = []) {
  const sequence = order.length ? order : [...nodes].sort((a, b) => a.phase - b.phase).map((n) => n.id)
  const phases = [...new Set(nodes.map((n) => n.phase))].sort((a, b) => a - b)
  const low = END_MARGIN
  const high = Math.PI - END_MARGIN
  const middle = Math.PI / 2

  const angleOf = {}
  const rings = []
  const spots = []                          // { id, u, ring }
  phases.forEach((phase, ring) => {
    const here = nodes.filter((n) => n.phase === phase)
    // Where each step would like to be: right above the steps it needs (or in the middle if it needs nothing yet).
    const wanted = (step) => {
      const known = step.requires.map((r) => angleOf[r]).filter((a) => a != null)
      return known.length ? mean(known) : middle
    }
    const sorted = [...here].sort((a, b) => wanted(a) - wanted(b) || sequence.indexOf(a.id) - sequence.indexOf(b.id) || a.id.localeCompare(b.id))
    // Far enough out that neighbours on this ring are never closer than MIN_GAP, even when the ring is full.
    const base = R0 + ring * DR
    const previous = rings.length ? rings[rings.length - 1].radius : -Infinity
    const radius = Math.max(base, previous + DR, (MIN_GAP * Math.max(sorted.length - 1, 0)) / (high - low))
    const gap = Math.min(SPACING / radius, (high - low) / Math.max(sorted.length - 1, 1))
    const spots1 = sorted.length ? spread(sorted.map(wanted), gap, low, high) : []
    sorted.forEach((step, i) => {
      angleOf[step.id] = spots1[i]
      spots.push({ id: step.id, u: spots1[i], ring })
    })
    rings.push({ index: ring, phase, radius })
  })

  const outer = rings.length ? rings[rings.length - 1].radius : R0
  const width = 2 * (outer + SIDE_PAD)
  const height = TOP_PAD + outer + BOTTOM_PAD
  const root = { x: width / 2, y: TOP_PAD + outer }
  const at = (radius, u) => ({ x: root.x - radius * Math.cos(u), y: root.y - radius * Math.sin(u) })

  const orbs = spots.map((s) => ({ id: s.id, ring: s.ring, u: s.u, number: sequence.indexOf(s.id) + 1, ...at(rings[s.ring].radius, s.u) }))
  return { orbs, rings, root, size: { width, height } }
}
