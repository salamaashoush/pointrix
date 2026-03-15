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
    const result = mod.modify(makeContext({ position: { x: 150, y: -10 } }))
    expect(result.position.x).toBe(100)
    expect(result.position.y).toBe(0)
  })

  it('clamps position to parent bounds', () => {
    const el = createMockElement()
    const parent = el.parentElement!
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
      x: 10, y: 10, width: 200, height: 200,
      top: 10, left: 10, right: 210, bottom: 210,
      toJSON() { return this },
    } as DOMRect)

    const mod = restrict({ bounds: 'parent' })
    const result = mod.modify(makeContext({ element: el, position: { x: 300, y: 5 } }))
    expect(result.position.x).toBe(210)
    expect(result.position.y).toBe(10)

    el.remove()
  })

  it('does not clamp when endOnly is true during move', () => {
    const mod = restrict({
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
      endOnly: true,
    })
    const result = mod.modify(makeContext({ position: { x: 200, y: 200 } }))
    expect(result.position.x).toBe(200)
    expect(result.position.y).toBe(200)
  })

  it('clamps on end even when endOnly is true', () => {
    const mod = restrict({
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
      endOnly: true,
    })
    const result = mod.onEnd!(makeContext({ position: { x: 200, y: 200 } }))
    expect(result!.position.x).toBe(100)
    expect(result!.position.y).toBe(100)
  })
})

describe('snapGrid modifier', () => {
  it('snaps position to nearest grid point', () => {
    const mod = snapGrid({ x: 50, y: 50 })
    const result = mod.modify(makeContext({ position: { x: 73, y: 28 } }))
    expect(result.position.x).toBe(50)
    expect(result.position.y).toBe(50)
  })

  it('snaps with offset', () => {
    const mod = snapGrid({ x: 50, y: 50, offset: { x: 10, y: 10 } })
    const result = mod.modify(makeContext({ position: { x: 55, y: 55 } }))
    // Nearest grid: round((55-10)/50)*50 + 10 = round(0.9)*50 + 10 = 50+10=60
    expect(result.position.x).toBe(60)
    expect(result.position.y).toBe(60)
  })

  it('respects limits', () => {
    const mod = snapGrid({ x: 50, y: 50, limits: { left: 0, right: 100, top: 0, bottom: 100 } })
    const result = mod.modify(makeContext({ position: { x: 180, y: 180 } }))
    // round(180/50)*50 = 200, clamped to 100
    expect(result.position.x).toBe(100)
    expect(result.position.y).toBe(100)
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
    const result = mod.modify(makeContext({ position: { x: 90, y: 95 } }))
    expect(result.position.x).toBe(100)
    expect(result.position.y).toBe(100)
  })

  it('does not snap when out of range', () => {
    const mod = snapTargets({
      targets: [{ x: 100, y: 100, range: 5 }],
    })
    const result = mod.modify(makeContext({ position: { x: 50, y: 50 } }))
    expect(result.position.x).toBe(50)
    expect(result.position.y).toBe(50)
  })

  it('snaps to x-only targets', () => {
    const mod = snapTargets({
      targets: [{ x: 100 }],
      range: 30,
    })
    const result = mod.modify(makeContext({ position: { x: 85, y: 200 } }))
    expect(result.position.x).toBe(100)
    expect(result.position.y).toBe(200) // y unchanged
  })

  it('snaps to y-only targets', () => {
    const mod = snapTargets({
      targets: [{ y: 100 }],
      range: 30,
    })
    const result = mod.modify(makeContext({ position: { x: 200, y: 85 } }))
    expect(result.position.x).toBe(200) // x unchanged
    expect(result.position.y).toBe(100)
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

    // Position just within range
    const result = mod.modify(makeContext({
      element: el,
      position: { x: 80, y: 80 },
    }))

    // Should move toward target
    expect(result.position.x).toBeGreaterThan(80)
    expect(result.position.y).toBeGreaterThan(80)

    el.remove()
  })

  it('snaps fully when very close (within 30% of distance)', () => {
    const el = createMockElement({ width: 0, height: 0 })
    const mod = magneticSnap({
      targets: [{ id: 'a', x: 100, y: 100 }],
      distance: 100,
      strength: 1.0,
    })

    // Position within 30% of distance (100 * 0.3 = 30)
    const result = mod.modify(makeContext({
      element: el,
      position: { x: 95, y: 95 },
    }))

    expect(result.position.x).toBe(100)
    expect(result.position.y).toBe(100)

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

    // Move close to target
    mod.modify(makeContext({ element: el, position: { x: 90, y: 90 } }))
    expect(onSnap).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))

    // Move far away
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

    const result = mod.modify(makeContext({ element: el, position: { x: 0, y: 0 } }))
    expect(result.position.x).toBe(0)
    expect(result.position.y).toBe(0)

    el.remove()
  })
})

describe('inertia modifier', () => {
  it('passes through position when not active', () => {
    const mod = inertia()
    const result = mod.modify(makeContext({ position: { x: 42, y: 77 } }))
    expect(result.position.x).toBe(42)
    expect(result.position.y).toBe(77)
  })

  it('computes exponential decay resting position on end', () => {
    const mod = inertia({ resistance: 10, endSpeed: 50 })
    const ctx = makeContext({
      position: { x: 100, y: 100 },
      velocity: { x: 500, y: 0 },
    })

    const result = mod.onEnd!(ctx)
    expect(result).toBeDefined()
    // Resting: position + v0/lambda = 100 + 500/10 = 150
    expect(result!.position.x).toBe(150)
    expect(result!.position.y).toBe(100)
    expect(result!.velocity.x).toBe(0)
  })

  it('does not activate inertia when speed is below endSpeed', () => {
    const mod = inertia({ endSpeed: 100 })
    const result = mod.onEnd!(makeContext({
      position: { x: 100, y: 100 },
      velocity: { x: 10, y: 10 },
    }))
    // Speed ~14.1 < 100, no inertia
    expect(result).toBeUndefined()
    expect(mod.isActive()).toBe(false)
  })

  it('returns smoothEnd position when smoothEnd is enabled and speed is low', () => {
    const mod = inertia({ smoothEnd: true, endSpeed: 1000 })
    const ctx = makeContext({
      position: { x: 100, y: 200 },
      velocity: { x: 10, y: 20 },
    })
    const result = mod.onEnd!(ctx)
    expect(result).toBeDefined()
    expect(result!.position.x).toBe(100)
    expect(result!.position.y).toBe(200)
    expect(result!.velocity.x).toBe(0)
  })
})

describe('autoScroll modifier', () => {
  it('does not modify position (only scrolls container)', () => {
    const container = createMockElement({
      x: 0, y: 0, width: 500, height: 500,
      top: 0, left: 0, right: 500, bottom: 500,
    })
    // Mock scrolling
    container.scrollLeft = 0
    container.scrollTop = 0

    const mod = autoScroll({ container, margin: 50, speed: 10 })
    const result = mod.modify(makeContext({
      position: { x: 250, y: 250 },
      delta: { x: 0, y: 0 },
    }))

    // Position should be unchanged — autoScroll only scrolls
    expect(result.position.x).toBe(250)
    expect(result.position.y).toBe(250)

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

    // Pointer near the right edge (at x=490, within 50px margin)
    mod.modify(makeContext({
      position: { x: 480, y: 250 },
      delta: { x: 10, y: 0 },
    }))

    // scrollLeft should have increased
    expect(container.scrollLeft).toBeGreaterThan(0)

    container.remove()
  })
})

describe('applyModifiers', () => {
  it('chains multiple modifiers sequentially', () => {
    const grid = snapGrid({ x: 50, y: 50 })
    const bounds = restrict({ bounds: { left: 0, top: 0, right: 100, bottom: 100 } })

    const ctx = makeContext({ position: { x: 73, y: 180 } })
    const result = applyModifiers([grid, bounds], ctx)

    // Grid snaps 73 -> 50, 180 -> 200; then restrict clamps 200 -> 100
    expect(result.position.x).toBe(50)
    expect(result.position.y).toBe(100)
  })

  it('returns original position when no modifiers', () => {
    const ctx = makeContext({ position: { x: 42, y: 99 } })
    const result = applyModifiers([], ctx)
    expect(result.position.x).toBe(42)
    expect(result.position.y).toBe(99)
  })
})
