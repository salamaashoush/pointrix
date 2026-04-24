import { describe, it, expect, vi } from 'vitest'
import { restrict } from '../modifiers/restrict'
import { snapGrid } from '../modifiers/snap-grid'
import { snapTargets } from '../modifiers/snap-targets'
import { magneticSnap } from '../modifiers/magnetic-snap'
import { inertia } from '../modifiers/inertia'
import { autoScroll } from '../modifiers/auto-scroll'
import { applyModifiers } from '../types'
import type { ModifierContext } from '../types'
import { createMockElement } from './helpers'

// The modifier contract is now in-place: each modifier mutates `ctx.position`,
// `ctx.velocity`, and `ctx.size`. Tests assert on the mutated context, not a
// returned value.

function makeContext(overrides: Partial<ModifierContext> = {}): ModifierContext {
  return {
    position: { x: 50, y: 50 },
    velocity: { x: 0, y: 0 },
    element: overrides.element ?? createMockElement(),
    startPosition: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('restrict modifier', () => {
  it('clamps position to custom bounds', () => {
    const mod = restrict({ bounds: { left: 0, top: 0, right: 100, bottom: 100 } })
    const ctx = makeContext({ position: { x: 150, y: -10 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(0)
  })

  it('clamps position to parent bounds', () => {
    // Element 100x100 at (50,50) inside parent 400x400 at (0,0)
    const el = createMockElement({ x: 50, y: 50, width: 100, height: 100, top: 50, left: 50, right: 150, bottom: 150 })
    const parent = el.parentElement!
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, width: 400, height: 400,
      top: 0, left: 0, right: 400, bottom: 400,
      toJSON() { return this },
    } as DOMRect)

    const mod = restrict({ bounds: 'parent' })
    // startPosition=0 means element base is at (50,50).
    // Transform bounds: left = 0-50 = -50, right = 400-50-100 = 250
    // Position 300 should clamp to 250
    const ctx = makeContext({ element: el, position: { x: 300, y: -100 }, startPosition: { x: 0, y: 0 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(250)
    expect(ctx.position.y).toBe(-50)

    el.remove()
  })

  it('does not clamp when endOnly is true during move', () => {
    const mod = restrict({
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
      endOnly: true,
    })
    const ctx = makeContext({ position: { x: 200, y: 200 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(200)
    expect(ctx.position.y).toBe(200)
  })

  it('clamps on end even when endOnly is true', () => {
    const mod = restrict({
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
      endOnly: true,
    })
    const ctx = makeContext({ position: { x: 200, y: 200 } })
    mod.onEnd!(ctx)
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(100)
  })
})

describe('snapGrid modifier', () => {
  it('snaps position to nearest grid point', () => {
    const mod = snapGrid({ x: 50, y: 50 })
    const ctx = makeContext({ position: { x: 73, y: 28 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(50)
    expect(ctx.position.y).toBe(50)
  })

  it('snaps with offset', () => {
    const mod = snapGrid({ x: 50, y: 50, offset: { x: 10, y: 10 } })
    const ctx = makeContext({ position: { x: 55, y: 55 } })
    mod.modify(ctx)
    // Nearest grid: round((55-10)/50)*50 + 10 = round(0.9)*50 + 10 = 50+10=60
    expect(ctx.position.x).toBe(60)
    expect(ctx.position.y).toBe(60)
  })

  it('respects limits', () => {
    const mod = snapGrid({ x: 50, y: 50, limits: { left: 0, right: 100, top: 0, bottom: 100 } })
    const ctx = makeContext({ position: { x: 180, y: 180 } })
    mod.modify(ctx)
    // round(180/50)*50 = 200, clamped to 100
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(100)
  })
})

describe('snapTargets modifier', () => {
  it('snaps to the closest target within range', () => {
    const mod = snapTargets({
      targets: [
        { x: 100, y: 100, range: 30 },
        { x: 200, y: 200, range: 30 },
      ],
    })
    const ctx = makeContext({ position: { x: 90, y: 95 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(100)
  })

  it('does not snap when out of range', () => {
    const mod = snapTargets({
      targets: [{ x: 100, y: 100, range: 5 }],
    })
    const ctx = makeContext({ position: { x: 50, y: 50 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(50)
    expect(ctx.position.y).toBe(50)
  })

  it('snaps to x-only targets', () => {
    const mod = snapTargets({
      targets: [{ x: 100 }],
      range: 30,
    })
    const ctx = makeContext({ position: { x: 85, y: 200 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(200) // y unchanged
  })

  it('snaps to y-only targets', () => {
    const mod = snapTargets({
      targets: [{ y: 100 }],
      range: 30,
    })
    const ctx = makeContext({ position: { x: 200, y: 85 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(200) // x unchanged
    expect(ctx.position.y).toBe(100)
  })
})

describe('magneticSnap modifier', () => {
  it('pulls position toward a nearby target', () => {
    const el = createMockElement({ width: 0, height: 0 })
    const mod = magneticSnap({
      targets: [{ id: 'a', x: 100, y: 100 }],
      distance: 50,
      strength: 0.5,
    })

    const ctx = makeContext({ element: el, position: { x: 80, y: 80 } })
    mod.modify(ctx)

    // Should move toward target
    expect(ctx.position.x).toBeGreaterThan(80)
    expect(ctx.position.y).toBeGreaterThan(80)

    el.remove()
  })

  it('snaps fully when very close (within 30% of distance)', () => {
    const el = createMockElement({ width: 0, height: 0 })
    const mod = magneticSnap({
      targets: [{ id: 'a', x: 100, y: 100 }],
      distance: 100,
      strength: 1.0,
    })

    const ctx = makeContext({ element: el, position: { x: 95, y: 95 } })
    mod.modify(ctx)

    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(100)

    el.remove()
  })

  it('fires onSnap and onUnsnap callbacks', () => {
    const el = createMockElement({ width: 0, height: 0 })
    const onSnap = vi.fn()
    const onUnsnap = vi.fn()
    const mod = magneticSnap({
      targets: [{ id: 'a', x: 100, y: 100 }],
      distance: 50,
      onSnap,
      onUnsnap,
    })

    mod.modify(makeContext({ element: el, position: { x: 90, y: 90 } }))
    expect(onSnap).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))

    mod.modify(makeContext({ element: el, position: { x: 500, y: 500 } }))
    expect(onUnsnap).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))

    el.remove()
  })

  it('does not move position when target is out of range', () => {
    const el = createMockElement({ width: 0, height: 0 })
    const mod = magneticSnap({
      targets: [{ id: 'a', x: 100, y: 100 }],
      distance: 10,
    })

    const ctx = makeContext({ element: el, position: { x: 0, y: 0 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(0)
    expect(ctx.position.y).toBe(0)

    el.remove()
  })
})

describe('inertia modifier', () => {
  it('passes through position when not active', () => {
    const mod = inertia()
    const ctx = makeContext({ position: { x: 42, y: 77 } })
    mod.modify(ctx)
    expect(ctx.position.x).toBe(42)
    expect(ctx.position.y).toBe(77)
  })

  it('computes exponential decay resting position on end', () => {
    const mod = inertia({ resistance: 10, endSpeed: 50 })
    const ctx = makeContext({
      position: { x: 100, y: 100 },
      velocity: { x: 500, y: 0 },
    })
    mod.onEnd!(ctx)
    // Resting: position + v0/lambda = 100 + 500/10 = 150
    expect(ctx.position.x).toBe(150)
    expect(ctx.position.y).toBe(100)
    expect(ctx.velocity.x).toBe(0)
    expect(ctx.velocity.y).toBe(0)
  })

  it('does not activate inertia when speed is below endSpeed', () => {
    const mod = inertia({ endSpeed: 100 })
    const ctx = makeContext({
      position: { x: 100, y: 100 },
      velocity: { x: 10, y: 10 },
    })
    mod.onEnd!(ctx)
    // Speed ~14.1 < 100, no inertia applied — position and velocity unchanged.
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(100)
    expect(ctx.velocity.x).toBe(10)
    expect(ctx.velocity.y).toBe(10)
    expect(mod.isActive()).toBe(false)
  })

  it('zeroes velocity in smoothEnd mode when speed is below endSpeed', () => {
    const mod = inertia({ smoothEnd: true, endSpeed: 1000 })
    const ctx = makeContext({
      position: { x: 100, y: 200 },
      velocity: { x: 10, y: 20 },
    })
    mod.onEnd!(ctx)
    // Position stays, velocity zeros out — smoothEnd "settles in place".
    expect(ctx.position.x).toBe(100)
    expect(ctx.position.y).toBe(200)
    expect(ctx.velocity.x).toBe(0)
    expect(ctx.velocity.y).toBe(0)
  })
})

describe('autoScroll modifier', () => {
  it('does not modify position (only scrolls container)', () => {
    const container = createMockElement({
      x: 0, y: 0, width: 500, height: 500,
      top: 0, left: 0, right: 500, bottom: 500,
    })
    container.scrollLeft = 0
    container.scrollTop = 0

    const mod = autoScroll({ container, margin: 50, speed: 10 })
    const ctx = makeContext({
      position: { x: 250, y: 250 },
      delta: { x: 0, y: 0 },
    })
    mod.modify(ctx)

    expect(ctx.position.x).toBe(250)
    expect(ctx.position.y).toBe(250)

    container.remove()
  })

  it('scrolls container when pointer is near edge', () => {
    const container = createMockElement({
      x: 0, y: 0, width: 500, height: 500,
      top: 0, left: 0, right: 500, bottom: 500,
    })
    container.scrollLeft = 0
    container.scrollTop = 0

    const mod = autoScroll({ container, margin: 50, speed: 10, acceleration: 5 })

    mod.modify(makeContext({
      position: { x: 480, y: 250 },
      delta: { x: 10, y: 0 },
    }))

    expect(container.scrollLeft).toBeGreaterThan(0)

    container.remove()
  })
})

describe('applyModifiers', () => {
  it('chains multiple modifiers sequentially (mutates the shared context)', () => {
    const grid = snapGrid({ x: 50, y: 50 })
    const bounds = restrict({ bounds: { left: 0, top: 0, right: 100, bottom: 100 } })

    const ctx = makeContext({ position: { x: 73, y: 180 } })
    const returned = applyModifiers([grid, bounds], ctx)

    // Grid snaps 73 -> 50, 180 -> 200; then restrict clamps 200 -> 100
    expect(ctx.position.x).toBe(50)
    expect(ctx.position.y).toBe(100)
    // applyModifiers returns the same context reference for convenience.
    expect(returned).toBe(ctx)
  })

  it('returns original position when no modifiers', () => {
    const ctx = makeContext({ position: { x: 42, y: 99 } })
    applyModifiers([], ctx)
    expect(ctx.position.x).toBe(42)
    expect(ctx.position.y).toBe(99)
  })
})
