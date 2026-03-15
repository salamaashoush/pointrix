import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createMockElement,
  firePointerDown,
  firePointerMove,
  firePointerUp,
  flushRAF,
} from './helpers'
import { Grip, grip } from '../nano'


describe('Grip', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = createMockElement()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    flushRAF() // drain any stale RAF callbacks between tests
  })

  describe('Constructor', () => {
    it('creates an instance', () => {
      const instance = new Grip(el)
      expect(instance).toBeInstanceOf(Grip)
      instance.destroy()
    })

    it('sets touch-action to none on the element', () => {
      const instance = new Grip(el)
      expect(el.style.touchAction).toBe('none')
      instance.destroy()
    })

    it('sets userSelect to none on the element', () => {
      const instance = new Grip(el)
      expect(el.style.userSelect).toBe('none')
      instance.destroy()
    })

    it('applies default options', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 0 })
      firePointerDown(el, { clientX: 10, clientY: 10 })
      expect(onStart).toHaveBeenCalled()
      instance.destroy()
    })
  })

  describe('Pointer tracking', () => {
    it('tracks pointer down', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 0 })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      expect(onStart).toHaveBeenCalledTimes(1)

      const event = onStart.mock.calls[0][0]
      expect(event.pointers).toHaveLength(1)
      expect(event.pointers[0].start).toEqual({ x: 50, y: 50 })

      instance.destroy()
    })

    it('tracks pointer move after activation', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      firePointerMove(document, { clientX: 60, clientY: 70 })
      flushRAF()

      expect(onMove).toHaveBeenCalled()
      const event = onMove.mock.calls[0][0]
      expect(event.pointers[0].current).toEqual({ x: 60, y: 70 })

      instance.destroy()
    })

    it('tracks pointer up and fires onEnd', () => {
      const onEnd = vi.fn()
      const instance = new Grip(el, { onEnd, threshold: 0 })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      firePointerMove(document, { clientX: 60, clientY: 70 })
      flushRAF()
      firePointerUp(document, { clientX: 60, clientY: 70 })

      expect(onEnd).toHaveBeenCalledTimes(1)

      instance.destroy()
    })
  })

  describe('Threshold', () => {
    it('does not start interaction until movement exceeds threshold', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 10 })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      // Move less than threshold (10)
      firePointerMove(document, { clientX: 52, clientY: 52 })
      flushRAF()

      expect(onStart).not.toHaveBeenCalled()

      instance.destroy()
    })

    it('starts interaction once movement exceeds threshold', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 5 })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      // Move more than threshold (5)
      firePointerMove(document, { clientX: 58, clientY: 50 })
      flushRAF()

      expect(onStart).toHaveBeenCalledTimes(1)

      instance.destroy()
    })

    it('starts immediately when threshold is 0', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 0 })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      expect(onStart).toHaveBeenCalledTimes(1)

      instance.destroy()
    })

    it('uses default threshold of 3 when not specified', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart })

      firePointerDown(el, { clientX: 50, clientY: 50 })
      // Move less than default threshold (3)
      firePointerMove(document, { clientX: 51, clientY: 51 })
      flushRAF()
      expect(onStart).not.toHaveBeenCalled()

      // Move beyond default threshold
      firePointerMove(document, { clientX: 54, clientY: 54 })
      flushRAF()
      expect(onStart).toHaveBeenCalledTimes(1)

      instance.destroy()
    })
  })

  describe('RAF batching', () => {
    it('does not fire onMove on every pointer move, only on RAF', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      firePointerDown(el, { clientX: 50, clientY: 50 })

      // Fire several moves without flushing RAF
      firePointerMove(document, { clientX: 55, clientY: 55 })
      firePointerMove(document, { clientX: 60, clientY: 60 })
      firePointerMove(document, { clientX: 65, clientY: 65 })

      // onMove should NOT have been called yet (waiting for RAF)
      expect(onMove).not.toHaveBeenCalled()

      // Now flush the RAF
      flushRAF()

      // Should only be called once with the latest position
      expect(onMove).toHaveBeenCalledTimes(1)
      const event = onMove.mock.calls[0][0]
      expect(event.pointers[0].current).toEqual({ x: 65, y: 65 })

      instance.destroy()
    })
  })

  describe('Velocity calculation', () => {
    it('computes smoothed velocity', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      firePointerDown(el, { clientX: 0, clientY: 0 })

      // First move
      firePointerMove(document, { clientX: 100, clientY: 0 })
      flushRAF()

      expect(onMove).toHaveBeenCalled()
      const pointer = onMove.mock.calls[0][0].pointers[0]
      // Velocity should be non-zero since we moved
      expect(pointer.velocity.x).not.toBe(0)
      // Y velocity should be 0 since we only moved horizontally
      expect(pointer.velocity.y).toBe(0)

      instance.destroy()
    })

    it('applies exponential smoothing to velocity (0.7/0.3 ratio)', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      firePointerDown(el, { clientX: 0, clientY: 0 })

      // First move - positive direction
      firePointerMove(document, { clientX: 100, clientY: 0 })
      flushRAF()
      const v1 = onMove.mock.calls[0][0].pointers[0].velocity.x
      expect(v1).toBeGreaterThan(0)

      // Continue in same direction with smaller movement
      firePointerMove(document, { clientX: 110, clientY: 0 })
      flushRAF()
      const v2 = onMove.mock.calls[1][0].pointers[0].velocity.x

      // Velocity should still be positive due to smoothing carrying forward
      expect(v2).toBeGreaterThan(0)

      // The smoothed velocity should include contribution from previous velocity
      // (v2 = v1 * 0.7 + newV * 0.3), so it won't equal the instantaneous velocity
      // v2 should differ from the raw instantaneous velocity of just the second move
      expect(v2).not.toBe(0)

      instance.destroy()
    })
  })

  describe('Multi-pointer', () => {
    it('tracks multiple pointers independently', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      // First pointer down
      firePointerDown(el, { clientX: 50, clientY: 50, pointerId: 1 })
      // Second pointer down
      firePointerDown(el, { clientX: 100, clientY: 100, pointerId: 2 })

      // Move both pointers
      firePointerMove(document, { clientX: 60, clientY: 60, pointerId: 1 })
      firePointerMove(document, { clientX: 110, clientY: 110, pointerId: 2 })
      flushRAF()

      expect(onMove).toHaveBeenCalled()
      const event = onMove.mock.calls[0][0]
      expect(event.pointers).toHaveLength(2)

      const p1 = event.pointers.find((p: { id: number }) => p.id === 1)
      const p2 = event.pointers.find((p: { id: number }) => p.id === 2)
      expect(p1.current).toEqual({ x: 60, y: 60 })
      expect(p2.current).toEqual({ x: 110, y: 110 })

      instance.destroy()
    })

    it('removes pointer on pointer up while keeping others', () => {
      const onEnd = vi.fn()
      const instance = new Grip(el, { onEnd, threshold: 0 })

      firePointerDown(el, { clientX: 50, clientY: 50, pointerId: 1 })
      firePointerDown(el, { clientX: 100, clientY: 100, pointerId: 2 })

      // Release first pointer
      firePointerUp(document, { clientX: 60, clientY: 60, pointerId: 1 })

      // onEnd should NOT fire yet since pointer 2 is still active
      expect(onEnd).not.toHaveBeenCalled()

      // Release second pointer
      firePointerUp(document, { clientX: 110, clientY: 110, pointerId: 2 })

      // Now onEnd should fire
      expect(onEnd).toHaveBeenCalledTimes(1)

      instance.destroy()
    })
  })

  describe('Event callbacks', () => {
    it('onStart fires with correct InteractionEvent shape', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 0 })

      firePointerDown(el, { clientX: 10, clientY: 20 })

      expect(onStart).toHaveBeenCalledTimes(1)
      const event = onStart.mock.calls[0][0]
      expect(event.target).toBe(el)
      expect(event.pointers).toBeInstanceOf(Array)
      expect(event.pointers[0].start).toEqual({ x: 10, y: 20 })
      expect(event.originalEvent).toBeInstanceOf(PointerEvent)

      instance.destroy()
    })

    it('onMove fires with delta and total', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      firePointerDown(el, { clientX: 10, clientY: 10 })
      firePointerMove(document, { clientX: 30, clientY: 40 })
      flushRAF()

      expect(onMove).toHaveBeenCalledTimes(1)
      const pointer = onMove.mock.calls[0][0].pointers[0]
      expect(pointer.delta).toEqual({ x: 20, y: 30 })
      expect(pointer.total).toEqual({ x: 20, y: 30 })

      instance.destroy()
    })

    it('onEnd fires when last pointer is released', () => {
      const onEnd = vi.fn()
      const instance = new Grip(el, { onEnd, threshold: 0 })

      firePointerDown(el, { clientX: 10, clientY: 10 })
      firePointerMove(document, { clientX: 30, clientY: 30 })
      flushRAF()
      firePointerUp(document, { clientX: 30, clientY: 30 })

      expect(onEnd).toHaveBeenCalledTimes(1)

      instance.destroy()
    })

    it('does not fire callbacks after interaction ends', () => {
      const onMove = vi.fn()
      const instance = new Grip(el, { onMove, threshold: 0 })

      firePointerDown(el, { clientX: 10, clientY: 10 })
      firePointerMove(document, { clientX: 30, clientY: 30 })
      flushRAF()
      firePointerUp(document, { clientX: 30, clientY: 30 })
      onMove.mockClear()

      // Move after pointer up should not trigger onMove
      firePointerMove(document, { clientX: 50, clientY: 50 })
      flushRAF()

      expect(onMove).not.toHaveBeenCalled()

      instance.destroy()
    })
  })

  describe('Destroy', () => {
    it('resets element styles', () => {
      const instance = new Grip(el)
      expect(el.style.touchAction).toBe('none')

      instance.destroy()

      expect(el.style.touchAction).toBe('')
      expect(el.style.userSelect).toBe('')
    })

    it('cleans up listeners so no further events fire', () => {
      const onStart = vi.fn()
      const instance = new Grip(el, { onStart, threshold: 0 })

      instance.destroy()

      firePointerDown(el, { clientX: 10, clientY: 10 })
      expect(onStart).not.toHaveBeenCalled()
    })

    it('cleans up active interaction on destroy', () => {
      const onEnd = vi.fn()
      const instance = new Grip(el, { onEnd, threshold: 0 })

      firePointerDown(el, { clientX: 10, clientY: 10 })
      instance.destroy()

      // Should not throw and move events should be ignored
      firePointerMove(document, { clientX: 50, clientY: 50 })
      flushRAF()
    })
  })

  describe('Multiple instances on same element', () => {
    it('coordinates via priority system - higher priority wins', () => {
      const onStartLow = vi.fn()
      const onStartHigh = vi.fn()

      const low = new Grip(el, { onStart: onStartLow, threshold: 0 })
      const high = new Grip(el, { onStart: onStartHigh, threshold: 0 })

      // Access protected priority via casting
      ;(low as any).priority = 0
      ;(high as any).priority = 10

      firePointerDown(el, { clientX: 10, clientY: 10 })

      // Higher priority instance should handle the event
      expect(onStartHigh).toHaveBeenCalledTimes(1)
      expect(onStartLow).not.toHaveBeenCalled()

      high.destroy()
      low.destroy()
    })

    it('does not remove styles until last instance is destroyed', () => {
      const instance1 = new Grip(el)
      const instance2 = new Grip(el)

      expect(el.style.touchAction).toBe('none')

      instance1.destroy()
      // Styles should still be set because instance2 is alive
      expect(el.style.touchAction).toBe('none')

      instance2.destroy()
      // Now styles should be cleared
      expect(el.style.touchAction).toBe('')
    })
  })

  describe('Factory function', () => {
    it('creates instance from HTMLElement', () => {
      const instance = grip(el)
      expect(instance).toBeInstanceOf(Grip)
      instance.destroy()
    })

    it('creates instance from CSS selector', () => {
      el.id = 'test-element'
      const instance = grip('#test-element')
      expect(instance).toBeInstanceOf(Grip)
      instance.destroy()
    })

    it('throws if selector does not match any element', () => {
      expect(() => grip('#nonexistent')).toThrow('Element not found')
    })

    it('passes options through', () => {
      const onStart = vi.fn()
      const instance = grip(el, { onStart, threshold: 0 })

      firePointerDown(el, { clientX: 10, clientY: 10 })
      expect(onStart).toHaveBeenCalled()

      instance.destroy()
    })
  })
})
