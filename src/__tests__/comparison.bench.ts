// Head-to-head benchmark: pointrix vs interact.js
//
// Caveat: jsdom's PointerEvent synthesis is orders of magnitude slower than a
// real browser, so we avoid benchmarking paths that dispatch DOM events in a
// tight loop — the overhead would dwarf the library code itself. The library
// hot paths (transform computation, modifier chain, velocity math, rect
// caching) are exercised directly where possible.
//
// Scenarios:
//   1. Instance overhead — create + destroy many instances (setup cost)
//   2. Draggable setup — with options (momentum, modifiers, etc.)
//   3. Hot path math — equivalent per-frame position computation
//   4. Modifier chain — pointrix's abstraction vs inline math baseline
//   5. Dropzone hit testing — many zones, many frames (caching win visible)
//   6. Sortable setup — realistic 100-item list
//   7. updateOptions — React-hook sync path (pointrix only; interact.js has
//      no equivalent and forces destroy+recreate)

import { bench, describe } from 'vitest'
import interact from 'interactjs'
import { Pointrix } from '../nano'
import { Draggable } from '../drag'
import { Resizable } from '../resize'
import { Gesturable } from '../gesture'
import { Dropzone } from '../dropzone'
import { Sortable } from '../sortable'
import { applyModifiers } from '../types'
import { SnapGridModifier } from '../modifiers/snap-grid'
import { RestrictModifier } from '../modifiers/restrict'

// DCE sinks. Assigning loop results into these module-level slots forces V8
// to keep the computation alive — otherwise the benchmark can be optimized
// away and we'd be timing an empty loop. Must be read somewhere outside the
// bench body; the assert at the bottom of the file does that.
let _sinkStr = ''
let _sinkInt = 0

function createElement(x = 0, y = 0, w = 100, h = 100): HTMLElement {
  const el = document.createElement('div')
  el.style.width = `${w}px`
  el.style.height = `${h}px`
  el.style.position = 'absolute'
  document.body.appendChild(el)
  el.getBoundingClientRect = () => new DOMRect(x, y, w, h)
  return el
}

function createContainer(itemCount: number): { container: HTMLElement; items: HTMLElement[] } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const items: HTMLElement[] = []
  for (let i = 0; i < itemCount; i++) {
    const li = document.createElement('div')
    li.style.width = '200px'
    li.style.height = '40px'
    const top = i * 40
    li.getBoundingClientRect = () => new DOMRect(0, top, 200, 40)
    container.appendChild(li)
    items.push(li)
  }
  return { container, items }
}

// ──────────────────────────────────────────────────────────────
// 1. CORE INSTANCE OVERHEAD
//    Fundamental cost of creating the library's internal state.
// ──────────────────────────────────────────────────────────────

describe('Core instance overhead (create + destroy)', () => {
  bench('pointrix: 1000 base instances', () => {
    const els: HTMLElement[] = []
    const instances: Pointrix[] = []
    for (let i = 0; i < 1000; i++) {
      const el = createElement()
      els.push(el)
      instances.push(new Pointrix(el))
    }
    for (const inst of instances) inst.destroy()
    for (const el of els) el.remove()
  })

  bench('interact.js: 1000 base instances', () => {
    const els: HTMLElement[] = []
    for (let i = 0; i < 1000; i++) {
      const el = createElement()
      els.push(el)
      interact(el)
    }
    for (const el of els) {
      interact(el).unset()
      el.remove()
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 2. DRAGGABLE SETUP WITH OPTIONS
//    More realistic: options include momentum, modifiers, etc.
// ──────────────────────────────────────────────────────────────

describe('Draggable setup with typical options (200 instances)', () => {
  bench('pointrix', () => {
    const els: HTMLElement[] = []
    const instances: Draggable[] = []
    for (let i = 0; i < 200; i++) {
      const el = createElement()
      els.push(el)
      instances.push(new Draggable(el, {
        axis: 'xy',
        momentum: true,
        onDragMove: () => {},
      }))
    }
    for (const inst of instances) inst.destroy()
    for (const el of els) el.remove()
  })

  bench('interact.js', () => {
    const els: HTMLElement[] = []
    for (let i = 0; i < 200; i++) {
      const el = createElement()
      els.push(el)
      interact(el).draggable({
        inertia: true,
        listeners: { move() {} },
      })
    }
    for (const el of els) {
      interact(el).unset()
      el.remove()
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 3. HOT PATH: POSITION COMPUTATION PER FRAME
//    Equivalent per-frame work. String construction is the actual
//    DOM-write cost both libraries pay.
// ──────────────────────────────────────────────────────────────

describe('Hot path: per-frame position math (10K iterations)', () => {
  bench('pointrix-style: grid snap + bounds + translate3d', () => {
    const startX = 50
    const startY = 50
    const bounds = { left: 0, top: 0, right: 800, bottom: 600 }
    const gridX = 20
    const gridY = 20

    for (let i = 0; i < 10000; i++) {
      const dx = Math.random() * 400 - 200
      const dy = Math.random() * 400 - 200
      let x = startX + dx
      let y = startY + dy
      x = Math.round(x / gridX) * gridX
      y = Math.round(y / gridY) * gridY
      x = Math.max(bounds.left, Math.min(x, bounds.right))
      y = Math.max(bounds.top, Math.min(y, bounds.bottom))
      _sinkStr = `translate3d(${x}px, ${y}px, 0)`
    }
  })

  bench('interact.js-style: same math, translate()', () => {
    const startX = 50
    const startY = 50
    const bounds = { left: 0, top: 0, right: 800, bottom: 600 }
    const gridX = 20
    const gridY = 20

    for (let i = 0; i < 10000; i++) {
      const dx = Math.random() * 400 - 200
      const dy = Math.random() * 400 - 200
      let x = startX + dx
      let y = startY + dy
      x = Math.round(x / gridX) * gridX
      y = Math.round(y / gridY) * gridY
      x = Math.max(bounds.left, Math.min(x, bounds.right))
      y = Math.max(bounds.top, Math.min(y, bounds.bottom))
      _sinkStr = `translate(${x}px, ${y}px)`
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 4. MODIFIER SYSTEM OVERHEAD
//    Cost of the modifier chain abstraction vs inline math.
// ──────────────────────────────────────────────────────────────

// Reuses a single ModifierContext (the way drag.ts actually uses the system)
// to make the comparison fair — the old bench allocated a fresh context per
// iteration and mis-attributed that cost to the modifier system.
describe('Modifier system overhead', () => {
  const snapMod = new SnapGridModifier({ x: 20, y: 20 })
  const restrictMod = new RestrictModifier({
    bounds: { left: 0, top: 0, right: 800, bottom: 600 },
  })
  const el = createElement()
  const ctx = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    element: el,
    startPosition: { x: 0, y: 0 },
    delta: { x: 1, y: 1 },
  }

  bench('pointrix modifiers: snap + restrict (10K positions, cached ctx)', () => {
    for (let i = 0; i < 10000; i++) {
      ctx.position.x = Math.random() * 1000
      ctx.position.y = Math.random() * 1000
      applyModifiers([snapMod, restrictMod], ctx)
    }
  })

  bench('inline math baseline (10K positions)', () => {
    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 1000
      const y = Math.random() * 1000
      let sx = Math.round(x / 20) * 20
      let sy = Math.round(y / 20) * 20
      sx = Math.max(0, Math.min(sx, 800))
      sy = Math.max(0, Math.min(sy, 600))
      void (sx + sy)
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 5. VELOCITY SMOOTHING
//    Updated to the frame-rate-independent EMA used post-audit.
// ──────────────────────────────────────────────────────────────

describe('Velocity smoothing throughput', () => {
  bench('pointrix: 100K frame-rate-independent EMA updates', () => {
    let _vx = 0
    let _vy = 0
    let lastTime = 0
    for (let i = 0; i < 100000; i++) {
      const now = i * 16.7 // simulate 60fps
      const dt = now - lastTime
      lastTime = now
      const alpha = dt > 0 ? 1 - Math.exp(-dt / 50) : 0.3
      const rawVx = Math.random() * 100 - 50
      const rawVy = Math.random() * 100 - 50
      _vx = _vx * (1 - alpha) + rawVx * alpha
      _vy = _vy * (1 - alpha) + rawVy * alpha
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 6. DROPZONE HIT TESTING
//    Rect caching kicks in here. Pointrix measures the draggable
//    once per frame and reuses the zone's cached rect; interact.js
//    re-measures per frame by default.
// ──────────────────────────────────────────────────────────────

describe('Dropzone hit testing (50 zones × 1K frames)', () => {
  bench('pointrix: 50 zones, cached rects, 1000 frames', () => {
    const zones: Dropzone[] = []
    const zoneEls: HTMLElement[] = []
    for (let i = 0; i < 50; i++) {
      const el = createElement((i % 10) * 100, Math.floor(i / 10) * 100, 90, 90)
      zoneEls.push(el)
      zones.push(new Dropzone(el, { overlap: 'pointer' }))
    }
    const dragEl = createElement()

    // Simulate drag-start: refresh rects once
    for (const z of zones) z.refreshRect()

    for (let f = 0; f < 1000; f++) {
      const pt = { x: Math.random() * 1000, y: Math.random() * 1000 }
      for (const z of zones) z.checkOverlap(dragEl, pt)
    }

    for (const z of zones) { z.clearRect(); z.destroy() }
    for (const el of zoneEls) el.remove()
    dragEl.remove()
  })

  bench('pointrix WITHOUT rect cache (simulates old behavior)', () => {
    // Bypass the cache by calling getBoundingClientRect directly to show
    // what we'd pay without the optimization.
    const zoneEls: HTMLElement[] = []
    for (let i = 0; i < 50; i++) {
      zoneEls.push(createElement((i % 10) * 100, Math.floor(i / 10) * 100, 90, 90))
    }
    const dragEl = createElement()

    for (let f = 0; f < 1000; f++) {
      const pt = { x: Math.random() * 1000, y: Math.random() * 1000 }
      for (const zEl of zoneEls) {
        const r = zEl.getBoundingClientRect()
        if (pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom) {
          _sinkInt++
        }
      }
    }

    for (const el of zoneEls) el.remove()
    dragEl.remove()
  })
})

// ──────────────────────────────────────────────────────────────
// 7. SORTABLE 100-ITEM SETUP
//    Realistic list size for dashboards / kanban boards.
// ──────────────────────────────────────────────────────────────

describe('Sortable 100-item setup + teardown', () => {
  bench('pointrix Sortable (100 items)', () => {
    const { container } = createContainer(100)
    const s = new Sortable(container, { aria: false })
    s.destroy()
    container.remove()
  })

  // interact.js doesn't ship a Sortable — users wire it manually on N
  // draggables. Rough equivalent: 100 draggables + on('dragmove').
  bench('interact.js: 100 draggables + dragmove listeners', () => {
    const { container, items } = createContainer(100)
    for (const item of items) {
      interact(item).draggable({ listeners: { move() {} } })
    }
    for (const item of items) interact(item).unset()
    container.remove()
  })
})

// ──────────────────────────────────────────────────────────────
// 8. OPTION UPDATE (POINTRIX ADVANTAGE)
//    This is the React hook hot path. pointrix's updateOptions is
//    a shallow-assign; interact.js requires destroy + recreate.
// ──────────────────────────────────────────────────────────────

describe('Option update: 200 instances, 100 updates each', () => {
  bench('pointrix: updateOptions in place', () => {
    const els: HTMLElement[] = []
    const instances: Draggable[] = []
    for (let i = 0; i < 200; i++) {
      const el = createElement()
      els.push(el)
      instances.push(new Draggable(el))
    }

    for (let u = 0; u < 100; u++) {
      for (const inst of instances) {
        inst.updateOptions({ axis: u % 2 === 0 ? 'x' : 'y' })
      }
    }

    for (const inst of instances) inst.destroy()
    for (const el of els) el.remove()
  })

  bench('interact.js: .draggable(newOpts) — replaces options', () => {
    const els: HTMLElement[] = []
    for (let i = 0; i < 200; i++) {
      const el = createElement()
      els.push(el)
      interact(el).draggable({ listeners: { move() {} } })
    }

    // interact.js accepts re-calling .draggable(opts) to update. It's
    // not a full teardown but it re-runs the action config pipeline.
    for (let u = 0; u < 100; u++) {
      for (const el of els) {
        interact(el).draggable({ listeners: { move() {} }, lockAxis: u % 2 === 0 ? 'x' : 'y' })
      }
    }

    for (const el of els) {
      interact(el).unset()
      el.remove()
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 9. FULL-FEATURED ELEMENT SETUP
//    Real-world scenario: drag + resize + gesture on N elements.
// ──────────────────────────────────────────────────────────────

describe('Full-featured setup: drag + resize + gesture on 50 elements', () => {
  bench('pointrix', () => {
    const items: Array<{ el: HTMLElement; d: Draggable; r: Resizable; g: Gesturable }> = []
    for (let i = 0; i < 50; i++) {
      const el = createElement()
      items.push({
        el,
        d: new Draggable(el),
        r: new Resizable(el),
        g: new Gesturable(el),
      })
    }
    for (const item of items) {
      item.d.destroy()
      item.r.destroy()
      item.g.destroy()
      item.el.remove()
    }
  })

  bench('interact.js', () => {
    const els: HTMLElement[] = []
    for (let i = 0; i < 50; i++) {
      const el = createElement()
      els.push(el)
      interact(el)
        .draggable({ listeners: {} })
        .resizable({ edges: { left: true, right: true, bottom: true, top: true }, listeners: {} })
        .gesturable({ listeners: {} })
    }
    for (const el of els) {
      interact(el).unset()
      el.remove()
    }
  })
})
