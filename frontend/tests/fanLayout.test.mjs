// Tests for the fan-shaped skill tree layout. Run with: npm test   (uses Node's built-in test runner, no extra packages)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { DR, END_MARGIN, fanLayout, spread } from '../src/fanLayout.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = JSON.parse(readFileSync(path.join(here, '..', '..', 'backend', 'demo_cache.json'), 'utf8'))   // real AI roadmaps

const node = (id, kind = 'skill', phase = 1, requires = []) => ({ id, title: id, kind, phase, hours: 10, requires, essential: true, why: '' })
const orderOf = (nodes) => [...nodes].sort((a, b) => a.phase - b.phase).map((n) => n.id)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const fixtures = Object.entries(cache).map(([name, entry]) => [name, entry.roadmap.nodes])
fixtures.push(['small sample', [node('a'), node('b', 'skill', 1), node('c', 'cert', 1), node('d', 'skill', 2, ['a', 'b']), node('e', 'project', 2, ['d']), node('f', 'role', 3, ['e'])]])
fixtures.push(['crowded ring', Array.from({ length: 9 }, (_, i) => node(`s${i}`, 'skill', 1)).concat([node('top', 'role', 2, ['s0', 's8'])])])

for (const [name, nodes] of fixtures) {
  test(`${name}: every step gets one position and a unique number in plan order`, () => {
    const layout = fanLayout(nodes, orderOf(nodes))
    assert.equal(layout.orbs.length, nodes.length)
    assert.deepEqual(new Set(layout.orbs.map((o) => o.id)), new Set(nodes.map((n) => n.id)))
    const order = orderOf(nodes)
    for (const o of layout.orbs) {
      assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y))
      assert.equal(o.number, order.indexOf(o.id) + 1)
    }
  })

  test(`${name}: no two steps sit on top of each other`, () => {
    const { orbs } = fanLayout(nodes, orderOf(nodes))
    let closest = Infinity
    for (let i = 0; i < orbs.length; i += 1) for (let j = i + 1; j < orbs.length; j += 1) closest = Math.min(closest, dist(orbs[i], orbs[j]))
    assert.ok(closest >= 125, `closest pair is only ${Math.round(closest)} px apart`)
  })

  test(`${name}: rings grow outward with the phases and every step sits on its ring`, () => {
    const layout = fanLayout(nodes, orderOf(nodes))
    for (let i = 1; i < layout.rings.length; i += 1) assert.ok(layout.rings[i].radius - layout.rings[i - 1].radius >= DR - 0.001)
    const byPhase = Object.fromEntries(layout.rings.map((r) => [r.phase, r.radius]))
    for (const o of layout.orbs) {
      const step = nodes.find((n) => n.id === o.id)
      assert.ok(Math.abs(Math.hypot(o.x - layout.root.x, o.y - layout.root.y) - byPhase[step.phase]) < 0.5)
    }
  })

  test(`${name}: everything fits inside the canvas, in the fan above the start node`, () => {
    const layout = fanLayout(nodes, orderOf(nodes))
    for (const o of layout.orbs) {
      assert.ok(o.x > 60 && o.x < layout.size.width - 60, `x ${o.x} outside ${layout.size.width}`)
      assert.ok(o.y > 60 && o.y < layout.root.y, `y ${o.y} not above the start node`)
      assert.ok(o.u >= END_MARGIN - 1e-6 && o.u <= Math.PI - END_MARGIN + 1e-6)
    }
  })
}

test('real roadmaps stay compact enough to read: about 2000 x 1100 or smaller', () => {
  for (const [name, nodes] of fixtures.slice(0, 3)) {
    const { size } = fanLayout(nodes, orderOf(nodes))
    assert.ok(size.width <= 2000 && size.height <= 1100, `${name} is ${Math.round(size.width)} x ${Math.round(size.height)}`)
  }
})

test('the same input always gives the same layout', () => {
  const nodes = fixtures[0][1]
  assert.deepEqual(fanLayout(nodes, orderOf(nodes)), fanLayout(nodes, orderOf(nodes)))
})

test('the fan uses its width, and the lines between linked steps stay short', () => {
  for (const [name, nodes] of fixtures.slice(0, 3)) {
    const layout = fanLayout(nodes, orderOf(nodes))
    const at = Object.fromEntries(layout.orbs.map((o) => [o.id, o]))
    const lines = nodes.flatMap((n) => n.requires.filter((r) => at[r]).map((r) => dist(at[n.id], at[r])))
    const average = lines.reduce((a, b) => a + b, 0) / lines.length
    const angles = layout.orbs.map((o) => o.u)
    assert.ok(average < 450, `${name}: lines average ${Math.round(average)} px`)
    assert.ok(Math.max(...angles) - Math.min(...angles) > 1.4, `${name}: the steps only cover ${(Math.max(...angles) - Math.min(...angles)).toFixed(2)} rad of the fan`)
  }
})

test('a single step lays out in the middle, and ring order follows the phases', () => {
  const one = fanLayout([node('only')], ['only'])
  assert.equal(one.orbs.length, 1)
  assert.ok(Math.abs(one.orbs[0].u - Math.PI / 2) < 1e-9)
  const gappy = fanLayout([node('a', 'skill', 2), node('b', 'skill', 7, ['a'])], ['a', 'b'])
  assert.deepEqual(gappy.rings.map((r) => r.phase), [2, 7])             // phases do not have to be 1, 2, 3...
})

test('steps that need other steps are placed near them, so chains do not cross', () => {
  const nodes = [node('l1', 'skill', 1), node('r1', 'skill', 1), node('l2', 'skill', 2, ['l1']), node('r2', 'skill', 2, ['r1'])]
  const layout = fanLayout(nodes, ['l1', 'r1', 'l2', 'r2'])
  const at = Object.fromEntries(layout.orbs.map((o) => [o.id, o]))
  assert.ok((at.l1.x < at.r1.x) === (at.l2.x < at.r2.x))
})

test('spread() keeps the order, the least gap and the limits', () => {
  const out = spread([1, 1, 1, 1], 0.5, 0, 3)
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i] - out[i - 1] >= 0.5 - 1e-9)
  assert.ok(out[0] >= 0 && out[out.length - 1] <= 3)
  assert.deepEqual(spread([1.5], 0.5, 0, 3), [1.5])
})
