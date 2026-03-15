import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Gesturable } from '../gesture'
import { createMockElement, firePointerDown, firePointerMove, firePointerUp } from './helpers'

describe('Gesturable', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = createMockElement()
  })

  afterEach(() => {
    el.remove()
  })

  function startGesture(
    g: Gesturable,
    target: HTMLElement,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ) {
    // First pointer activates the instance (threshold=0)
    firePointerDown(target, { clientX: p1.x, clientY: p1.y, pointerId: 1 })
    // Second pointer
    firePointerDown(target, { clientX: p2.x, clientY: p2.y, pointerId: 2 })
    // Move second pointer slightly to mark dirty, then manually call update
    firePointerMove(document, { clientX: p2.x + 1, clientY: p2.y, pointerId: 2 })
    g.update()
  }

  it('fires onGestureStart when 2 pointers are active', () => {
    const onGestureStart = vi.fn()
    const g = new Gesturable(el, { onGestureStart })

    // First pointer down
    firePointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 })
    g.update()
    expect(onGestureStart).not.toHaveBeenCalled()

    // Second pointer down
    firePointerDown(el, { clientX: 200, clientY: 200, pointerId: 2 })
    firePointerMove(document, { clientX: 201, clientY: 200, pointerId: 2 })
    g.update()

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    const event = onGestureStart.mock.calls[0][0]
    expect(event.scale).toBe(1)
    expect(event.rotation).toBe(0)

    g.destroy()
  })

  it('calculates scale when pointers move apart', () => {
    const onGestureMove = vi.fn()
    const g = new Gesturable(el, { onGestureMove })

    startGesture(g, el, { x: 100, y: 100 }, { x: 200, y: 100 })

    // Move pointers further apart (50 to 250 = 200px apart)
    firePointerMove(document, { clientX: 50, clientY: 100, pointerId: 1 })
    firePointerMove(document, { clientX: 250, clientY: 100, pointerId: 2 })
    g.update()

    expect(onGestureMove).toHaveBeenCalled()
    const event = onGestureMove.mock.calls[onGestureMove.mock.calls.length - 1][0]
    // Start distance was ~101 (100 to 201), now 200 (50 to 250), scale ≈ 1.98
    expect(event.scale).toBeGreaterThan(1.5)

    g.destroy()
  })

  it('calculates rotation when pointers rotate', () => {
    const onGestureMove = vi.fn()
    const g = new Gesturable(el, { onGestureMove })

    startGesture(g, el, { x: 100, y: 100 }, { x: 200, y: 100 })

    // Rotate second pointer ~90 degrees: p2 at (100, 200)
    // angle of (100,100)->(100,200) = atan2(100, 0) = 90 degrees
    firePointerMove(document, { clientX: 100, clientY: 200, pointerId: 2 })
    g.update()

    expect(onGestureMove).toHaveBeenCalled()
    const event = onGestureMove.mock.calls[onGestureMove.mock.calls.length - 1][0]
    expect(event.rotation).toBeCloseTo(90, 0)

    g.destroy()
  })

  it('computes center as midpoint of two pointers', () => {
    const onGestureStart = vi.fn()
    const g = new Gesturable(el, { onGestureStart })

    firePointerDown(el, { clientX: 100, clientY: 50, pointerId: 1 })
    firePointerDown(el, { clientX: 300, clientY: 150, pointerId: 2 })
    firePointerMove(document, { clientX: 301, clientY: 150, pointerId: 2 })
    g.update()

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    const event = onGestureStart.mock.calls[0][0]
    // Center of (100,50) and (301,150)
    expect(event.center.x).toBeCloseTo(200.5, 0)
    expect(event.center.y).toBe(100)

    g.destroy()
  })

  it('fires onGestureEnd when pointers drop below minimum', () => {
    const onGestureEnd = vi.fn()
    const g = new Gesturable(el, { onGestureEnd })

    startGesture(g, el, { x: 100, y: 100 }, { x: 200, y: 100 })

    // Lift second pointer
    firePointerUp(document, { clientX: 201, clientY: 100, pointerId: 2 })
    // Move remaining pointer to trigger update
    firePointerMove(document, { clientX: 101, clientY: 100, pointerId: 1 })
    g.update()

    expect(onGestureEnd).toHaveBeenCalledTimes(1)

    g.destroy()
  })

  it('has priority 15 which preempts drag (5) and resize (10)', () => {
    const g = new Gesturable(el)
    expect((g as any).priority).toBe(15)
    g.destroy()
  })
})
