import { bench, describe } from 'vitest'
import { Pointrix } from '../nano'
import { Draggable } from '../drag'
import { Resizable } from '../resize'
import { Gesturable } from '../gesture'
import { applyModifiers } from '../types'
import type { Modifier } from '../types'
import { RestrictModifier } from '../modifiers/restrict'
import { SnapGridModifier } from '../modifiers/snap-grid'
import { SnapTargetsModifier } from '../modifiers/snap-targets'
import { MagneticSnapModifier } from '../modifiers/magnetic-snap'
import { QuadTree, SpatialHashGrid } from '../utils/spatial-index'
import type { SpatialItem } from '../utils/spatial-index'
import { Dropzone } from '../dropzone'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createElement(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const rect: DOMRect = {
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    top: 0,
    right: 200,
    bottom: 200,
    left: 0,
    toJSON() {
      return this
    },
  } as DOMRect
  el.getBoundingClientRect = () => rect
  return el
}

function randomItems(count: number, worldSize: number): SpatialItem[] {
  const items: SpatialItem[] = []
  for (let i = 0; i < count; i++) {
    items.push({
      id: `item-${i}`,
      x: Math.random() * worldSize,
      y: Math.random() * worldSize,
      width: 10 + Math.random() * 40,
      height: 10 + Math.random() * 40,
    })
  }
  return items
}

// ---------------------------------------------------------------------------
// 1. Instance Creation
// ---------------------------------------------------------------------------

describe('Instance Creation', () => {
  bench('Pointrix: create 1000 instances', () => {
    const instances: Pointrix[] = []
    for (let i = 0; i < 1000; i++) {
      instances.push(new Pointrix(createElement()))
    }
    for (const inst of instances) inst.destroy()
  })

  bench('Draggable: create 1000 instances', () => {
    const instances: Draggable[] = []
    for (let i = 0; i < 1000; i++) {
      instances.push(new Draggable(createElement()))
    }
    for (const inst of instances) inst.destroy()
  })

  bench('Resizable: create 1000 instances', () => {
    const instances: Resizable[] = []
    for (let i = 0; i < 1000; i++) {
      instances.push(new Resizable(createElement()))
    }
    for (const inst of instances) inst.destroy()
  })

  bench('Gesturable: create 1000 instances', () => {
    const instances: Gesturable[] = []
    for (let i = 0; i < 1000; i++) {
      instances.push(new Gesturable(createElement()))
    }
    for (const inst of instances) inst.destroy()
  })
})

// ---------------------------------------------------------------------------
// 2. Pointer Event Processing
// ---------------------------------------------------------------------------

describe('Pointer Event Processing', () => {
  // NOTE: jsdom PointerEvent dispatch is extremely slow, so we simulate the
  // per-frame computational work that happens during pointer interactions.

  bench('Simulate Draggable move: compute position + apply transform (10000)', () => {
    const el = createElement()
    const startX = 0
    const startY = 0
    for (let i = 0; i < 10000; i++) {
      const dx = i * 0.5
      const dy = i * 0.3
      const x = startX + dx
      const y = startY + dy
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
  })

  bench('Simulate Resizable move: compute size + apply styles (10000)', () => {
    const el = createElement()
    const startWidth = 200
    const startHeight = 200
    const minWidth = 50
    const minHeight = 50
    for (let i = 0; i < 10000; i++) {
      const dx = i * 0.5
      const dy = i * 0.3
      const w = Math.max(minWidth, startWidth + dx)
      const h = Math.max(minHeight, startHeight + dy)
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.style.transform = `translate3d(0px, 0px, 0)`
    }
  })

  bench('Velocity calculation throughput (10000 iterations)', () => {
    let _vx = 0
    let _vy = 0
    let prevX = 100
    let prevY = 100
    for (let i = 0; i < 10000; i++) {
      const curX = 100 + i * 0.5
      const curY = 100 + i * 0.3
      const dx = curX - prevX
      const dy = curY - prevY
      const dt = 16 // ~60fps
      if (dt > 0) {
        const newVx = (dx / dt) * 1000
        const newVy = (dy / dt) * 1000
        _vx = _vx * 0.7 + newVx * 0.3
        _vy = _vy * 0.7 + newVy * 0.3
      }
      prevX = curX
      prevY = curY
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Modifier Chain
// ---------------------------------------------------------------------------

// Modifier benches now reuse a single cached ModifierContext and call
// modifiers in place (the v1 mutation-based contract). This models the
// library's hot-path usage from drag.ts / resize.ts exactly.
describe('Modifier Chain', () => {
  const el = createElement()

  function makeCtx() {
    return {
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 1 },
      element: el,
      startPosition: { x: 0, y: 0 },
      delta: { x: 1, y: 1 },
    }
  }

  bench('Apply 1 modifier to 10000 positions', () => {
    const ctx = makeCtx()
    const mod = new RestrictModifier({ bounds: { left: 0, top: 0, right: 1000, bottom: 1000 } })
    for (let i = 0; i < 10000; i++) {
      ctx.position.x = i * 0.1
      ctx.position.y = i * 0.1
      applyModifiers([mod], ctx)
    }
  })

  bench('Apply 5 modifiers to 10000 positions', () => {
    const ctx = makeCtx()
    const mods: Modifier[] = [
      new RestrictModifier({ bounds: { left: 0, top: 0, right: 2000, bottom: 2000 } }),
      new SnapGridModifier({ x: 20, y: 20 }),
      new SnapTargetsModifier({
        targets: [
          { x: 100, y: 100 },
          { x: 500, y: 500 },
        ],
        range: 30,
      }),
      new RestrictModifier({ bounds: { left: 10, top: 10, right: 1900, bottom: 1900 } }),
      new SnapGridModifier({ x: 10, y: 10 }),
    ]

    for (let i = 0; i < 10000; i++) {
      ctx.position.x = i * 0.2
      ctx.position.y = i * 0.2
      applyModifiers(mods, ctx)
    }
  })

  bench('Restrict modifier: 10000 positions', () => {
    const ctx = makeCtx()
    const mod = new RestrictModifier({ bounds: { left: 0, top: 0, right: 800, bottom: 800 } })
    for (let i = 0; i < 10000; i++) {
      ctx.position.x = i * 0.1 - 200
      ctx.position.y = i * 0.1 - 200
      mod.modify(ctx)
    }
  })

  bench('SnapGrid modifier: 10000 positions', () => {
    const ctx = makeCtx()
    const mod = new SnapGridModifier({ x: 25, y: 25 })
    for (let i = 0; i < 10000; i++) {
      ctx.position.x = i * 0.13
      ctx.position.y = i * 0.17
      mod.modify(ctx)
    }
  })

  bench('SnapTargets modifier: 10000 positions', () => {
    const ctx = makeCtx()
    const targets = Array.from({ length: 20 }, (_, i) => ({
      x: i * 50,
      y: i * 50,
      range: 25,
    }))
    const mod = new SnapTargetsModifier({ targets, range: 25 })
    for (let i = 0; i < 10000; i++) {
      ctx.position.x = i * 0.1
      ctx.position.y = i * 0.1
      mod.modify(ctx)
    }
  })

  bench('MagneticSnap modifier: 10000 positions', () => {
    const ctx = makeCtx()
    const targets = Array.from({ length: 20 }, (_, i) => ({
      id: `mag-${i}`,
      x: i * 50,
      y: i * 50,
      strength: 0.5,
    }))
    const mod = new MagneticSnapModifier({ targets, distance: 30 })
    for (let i = 0; i < 10000; i++) {
      ctx.position.x = i * 0.1
      ctx.position.y = i * 0.1
      mod.modify(ctx)
    }
  })
})

// ---------------------------------------------------------------------------
// 4. Spatial Index
// ---------------------------------------------------------------------------

describe('Spatial Index', () => {
  const WORLD_SIZE = 10000

  bench('QuadTree: insert 10000 items', () => {
    const qt = new QuadTree<SpatialItem>({ x: 0, y: 0, width: WORLD_SIZE, height: WORLD_SIZE })
    const items = randomItems(10000, WORLD_SIZE)
    for (const item of items) {
      qt.insert(item)
    }
  })

  bench('QuadTree: query 1000 times with 10000 items', () => {
    const qt = new QuadTree<SpatialItem>({ x: 0, y: 0, width: WORLD_SIZE, height: WORLD_SIZE })
    const items = randomItems(10000, WORLD_SIZE)
    for (const item of items) qt.insert(item)

    for (let i = 0; i < 1000; i++) {
      qt.query({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        width: 100,
        height: 100,
      })
    }
  })

  bench('SpatialHashGrid: insert 10000 items', () => {
    const grid = new SpatialHashGrid<SpatialItem>(100)
    const items = randomItems(10000, WORLD_SIZE)
    for (const item of items) {
      grid.insert(item)
    }
  })

  bench('SpatialHashGrid: query 1000 times with 10000 items', () => {
    const grid = new SpatialHashGrid<SpatialItem>(100)
    const items = randomItems(10000, WORLD_SIZE)
    for (const item of items) grid.insert(item)

    for (let i = 0; i < 1000; i++) {
      grid.query({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        width: 100,
        height: 100,
      })
    }
  })

  bench('Comparison: QuadTree query vs baseline', () => {
    const qt = new QuadTree<SpatialItem>({ x: 0, y: 0, width: WORLD_SIZE, height: WORLD_SIZE })
    const items = randomItems(10000, WORLD_SIZE)
    for (const item of items) qt.insert(item)

    for (let i = 0; i < 1000; i++) {
      qt.query({
        x: (i * 10) % WORLD_SIZE,
        y: (i * 7) % WORLD_SIZE,
        width: 200,
        height: 200,
      })
    }
  })

  bench('Comparison: SpatialHashGrid query vs baseline', () => {
    const grid = new SpatialHashGrid<SpatialItem>(100)
    const items = randomItems(10000, WORLD_SIZE)
    for (const item of items) grid.insert(item)

    for (let i = 0; i < 1000; i++) {
      grid.query({
        x: (i * 10) % WORLD_SIZE,
        y: (i * 7) % WORLD_SIZE,
        width: 200,
        height: 200,
      })
    }
  })
})

// ---------------------------------------------------------------------------
// 5. Dropzone Hit Testing
// ---------------------------------------------------------------------------

describe('Dropzone Hit Testing', () => {
  bench('Check overlap for 100 dropzones with 10000 pointer positions', () => {
    const dropzones: Dropzone[] = []
    const elements: HTMLElement[] = []

    for (let i = 0; i < 100; i++) {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const left = (i % 10) * 100
      const top = Math.floor(i / 10) * 100
      const rect: DOMRect = {
        x: left,
        y: top,
        width: 90,
        height: 90,
        top,
        right: left + 90,
        bottom: top + 90,
        left,
        toJSON() {
          return this
        },
      } as DOMRect
      el.getBoundingClientRect = () => rect
      elements.push(el)
      dropzones.push(new Dropzone(el, { overlap: 'pointer' }))
    }

    const draggable = createElement()

    for (let i = 0; i < 10000; i++) {
      const pointerPos = { x: Math.random() * 1000, y: Math.random() * 1000 }
      for (const dz of dropzones) {
        dz.checkOverlap(draggable, pointerPos)
      }
    }

    for (const dz of dropzones) dz.destroy()
    for (const el of elements) el.remove()
  })
})
