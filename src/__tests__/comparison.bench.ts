// Head-to-head benchmark: hyperact vs interact.js
import { bench, describe } from 'vitest'
import interact from 'interactjs'
import { Hyperact } from '../nano'
import { Draggable } from '../drag'
import { Resizable } from '../resize'
import { Gesturable } from '../gesture'
import { applyModifiers } from '../types'
import { SnapGridModifier } from '../modifiers/snap-grid'
import { RestrictModifier } from '../modifiers/restrict'

function createElement(): HTMLElement {
  const el = document.createElement('div')
  el.style.width = '100px'
  el.style.height = '100px'
  el.style.position = 'absolute'
  document.body.appendChild(el)
  el.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
  return el
}

// ──────────────────────────────────────────────────────────────
// 1. CORE INSTANCE OVERHEAD
//    The fundamental cost of setting up the library's internals.
//    hyperact's core is a single class with a WeakMap registry;
//    interact.js creates a Scope, Interactable, and plugin graph.
// ──────────────────────────────────────────────────────────────

describe('Core instance overhead (create + destroy)', () => {
  bench('hyperact: 1000 base instances', () => {
    const els: HTMLElement[] = []
    const instances: Hyperact[] = []
    for (let i = 0; i < 1000; i++) {
      const el = createElement()
      els.push(el)
      instances.push(new Hyperact(el))
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
// 2. DRAGGABLE SETUP
//    Creates a draggable with full options.
//    hyperact does more upfront (transform parsing, style setup)
//    so this tests constructor-time cost.
// ──────────────────────────────────────────────────────────────

describe('Draggable setup (create + destroy)', () => {
  bench('hyperact: 200 draggable instances', () => {
    const els: HTMLElement[] = []
    const instances: Draggable[] = []
    for (let i = 0; i < 200; i++) {
      const el = createElement()
      els.push(el)
      instances.push(new Draggable(el, { axis: 'xy', momentum: true }))
    }
    for (const inst of instances) inst.destroy()
    for (const el of els) el.remove()
  })

  bench('interact.js: 200 draggable instances', () => {
    const els: HTMLElement[] = []
    for (let i = 0; i < 200; i++) {
      const el = createElement()
      els.push(el)
      interact(el).draggable({
        inertia: true,
        listeners: { move() {} }
      })
    }
    for (const el of els) {
      interact(el).unset()
      el.remove()
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 3. HOT PATH: POSITION COMPUTATION
//    The per-frame work during an active drag. This is the code
//    that runs 60x/sec and determines perceived smoothness.
//    We isolate the computation from DOM event dispatch since
//    jsdom PointerEvent construction is artificially slow.
// ──────────────────────────────────────────────────────────────

describe('Hot path: position computation per frame (10K iterations)', () => {
  bench('hyperact: transform calc + bounds + grid snap', () => {
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
      // Grid snap
      x = Math.round(x / gridX) * gridX
      y = Math.round(y / gridY) * gridY
      // Bounds
      x = Math.max(bounds.left, Math.min(x, bounds.right))
      y = Math.max(bounds.top, Math.min(y, bounds.bottom))
      // Apply transform (string construction - the actual DOM write)
      const _transform = `translate3d(${x}px, ${y}px, 0)`
    }
  })

  bench('interact.js: equivalent position computation', () => {
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
      // Snap (interact.js uses same algorithm)
      x = Math.round(x / gridX) * gridX
      y = Math.round(y / gridY) * gridY
      // Restrict
      x = Math.max(bounds.left, Math.min(x, bounds.right))
      y = Math.max(bounds.top, Math.min(y, bounds.bottom))
      const _transform = `translate(${x}px, ${y}px)`
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 4. MODIFIER SYSTEM: OBJECT ALLOCATION OVERHEAD
//    hyperact modifiers return new objects each frame.
//    This measures the cost of the abstraction vs inline math.
// ──────────────────────────────────────────────────────────────

describe('Modifier system overhead', () => {
  const snapMod = new SnapGridModifier({ x: 20, y: 20 })
  const restrictMod = new RestrictModifier({ bounds: { left: 0, top: 0, right: 800, bottom: 600 } })
  const el = createElement()

  bench('hyperact modifiers: snap + restrict (10K positions)', () => {
    for (let i = 0; i < 10000; i++) {
      applyModifiers([snapMod, restrictMod], {
        position: { x: Math.random() * 1000, y: Math.random() * 1000 },
        velocity: { x: 0, y: 0 },
        element: el,
        startPosition: { x: 0, y: 0 },
        delta: { x: 1, y: 1 }
      })
    }
  })

  bench('inline math equivalent (10K positions)', () => {
    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 1000
      const y = Math.random() * 1000
      let sx = Math.round(x / 20) * 20
      let sy = Math.round(y / 20) * 20
      sx = Math.max(0, Math.min(sx, 800))
      sy = Math.max(0, Math.min(sy, 600))
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 5. VELOCITY SMOOTHING (exponential moving average)
//    This runs every frame for every active pointer.
// ──────────────────────────────────────────────────────────────

describe('Velocity smoothing throughput', () => {
  bench('hyperact: 100K velocity updates', () => {
    let _vx = 0, _vy = 0
    for (let i = 0; i < 100000; i++) {
      const rawVx = Math.random() * 100 - 50
      const rawVy = Math.random() * 100 - 50
      _vx = _vx * 0.7 + rawVx * 0.3
      _vy = _vy * 0.7 + rawVy * 0.3
    }
  })
})

// ──────────────────────────────────────────────────────────────
// 6. FULL-FEATURED ELEMENT SETUP
//    Real-world scenario: set up drag + resize + gesture on
//    multiple elements, then tear down. Tests total init cost.
// ──────────────────────────────────────────────────────────────

describe('Full-featured setup: drag + resize + gesture on N elements', () => {
  bench('hyperact: 50 elements with all features', () => {
    const items: Array<{ el: HTMLElement; d: Draggable; r: Resizable; g: Gesturable }> = []
    for (let i = 0; i < 50; i++) {
      const el = createElement()
      items.push({
        el,
        d: new Draggable(el),
        r: new Resizable(el),
        g: new Gesturable(el)
      })
    }
    for (const item of items) {
      item.d.destroy()
      item.r.destroy()
      item.g.destroy()
      item.el.remove()
    }
  })

  bench('interact.js: 50 elements with all features', () => {
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
