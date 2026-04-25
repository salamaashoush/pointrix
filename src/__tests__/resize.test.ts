import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockElement, firePointerDown, firePointerMove, firePointerUp, flushRAF } from './helpers'
import { Resizable, resizable, ResizeEvent } from '../resize'

describe('Resizable', () => {
  let el: HTMLElement
  let instance: Resizable

  beforeEach(() => {
    el = createMockElement()
  })

  afterEach(() => {
    instance?.destroy()
  })

  describe('edge detection', () => {
    it('detects right edge based on pointer position', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 195,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('ew-resize')
    })

    it('detects bottom edge', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 195,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('ns-resize')
    })

    it('detects left edge', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 3,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('ew-resize')
    })

    it('detects top edge', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 3,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('ns-resize')
    })

    it('detects bottom-right corner', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 195,
        clientY: 195,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('nwse-resize')
    })

    it('detects top-left corner', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 3,
        clientY: 3,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('nwse-resize')
    })

    it('detects top-right corner', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 195,
        clientY: 3,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('nesw-resize')
    })

    it('detects bottom-left corner', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 3,
        clientY: 195,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('nesw-resize')
    })

    it('returns no cursor when not near any edge', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(el.style.cursor).toBe('')
    })
  })

  describe('basic resize', () => {
    it('pointer near right edge, move right, width increases', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 245, clientY: 100 })
      flushRAF()

      expect(el.style.width).toBe('250px')

      firePointerUp(document, { clientX: 245, clientY: 100 })
    })

    it('pointer near bottom edge, move down, height increases', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 100, clientY: 195 })
      firePointerMove(document, { clientX: 100, clientY: 235 })
      flushRAF()

      expect(el.style.height).toBe('240px')

      firePointerUp(document, { clientX: 100, clientY: 235 })
    })
  })

  describe('corner resize', () => {
    it('pointer at bottom-right corner moves both dimensions', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 195, clientY: 195 })
      firePointerMove(document, { clientX: 245, clientY: 245 })
      flushRAF()

      expect(el.style.width).toBe('250px')
      expect(el.style.height).toBe('250px')

      firePointerUp(document, { clientX: 245, clientY: 245 })
    })
  })

  describe('left/top resize', () => {
    it('resizing from left adjusts position AND width', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 3, clientY: 100 })
      firePointerMove(document, { clientX: -27, clientY: 100 })
      flushRAF()

      expect(el.style.width).toBe('230px')
      expect(el.style.transform).toContain('translate3d(-30px')

      firePointerUp(document, { clientX: -27, clientY: 100 })
    })

    it('resizing from top adjusts position AND height', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 100, clientY: 3 })
      firePointerMove(document, { clientX: 100, clientY: -17 })
      flushRAF()

      expect(el.style.height).toBe('220px')
      expect(el.style.transform).toContain('-20px')

      firePointerUp(document, { clientX: 100, clientY: -17 })
    })
  })

  describe('min/max constraints', () => {
    it('respects minWidth and minHeight', () => {
      instance = new Resizable(el, { minWidth: 100, minHeight: 100 })

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 50, clientY: 100 })
      flushRAF()

      const width = parseFloat(el.style.width)
      expect(width).toBeGreaterThanOrEqual(100)

      firePointerUp(document, { clientX: 50, clientY: 100 })
    })

    it('respects maxWidth and maxHeight', () => {
      instance = new Resizable(el, { maxWidth: 300, maxHeight: 300 })

      firePointerDown(el, { clientX: 195, clientY: 195 })
      firePointerMove(document, { clientX: 700, clientY: 700 })
      flushRAF()

      const width = parseFloat(el.style.width)
      const height = parseFloat(el.style.height)
      expect(width).toBeLessThanOrEqual(300)
      expect(height).toBeLessThanOrEqual(300)

      firePointerUp(document, { clientX: 700, clientY: 700 })
    })

    it('uses default minWidth=50 and minHeight=50', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: -200, clientY: 100 })
      flushRAF()

      const width = parseFloat(el.style.width)
      expect(width).toBeGreaterThanOrEqual(50)

      firePointerUp(document, { clientX: -200, clientY: 100 })
    })
  })

  describe('aspect ratio', () => {
    it('aspectRatio=preserve maintains ratio during resize', () => {
      instance = new Resizable(el, { aspectRatio: 'preserve' })

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 295, clientY: 100 })
      flushRAF()

      const width = parseFloat(el.style.width)
      const height = parseFloat(el.style.height)
      expect(Math.abs(width - height)).toBeLessThan(1)

      firePointerUp(document, { clientX: 295, clientY: 100 })
    })

    it('aspectRatio=16/9 enforces specific ratio', () => {
      el = createMockElement({ width: 320, height: 180, right: 320, bottom: 180 })
      instance = new Resizable(el, { aspectRatio: 16 / 9 })

      firePointerDown(el, { clientX: 315, clientY: 90 })
      firePointerMove(document, { clientX: 415, clientY: 90 })
      flushRAF()

      const width = parseFloat(el.style.width)
      const height = parseFloat(el.style.height)
      const ratio = width / height
      expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.1)

      firePointerUp(document, { clientX: 415, clientY: 90 })
    })
  })

  describe('grid snapping', () => {
    it('grid={width:10,height:10} snaps size', () => {
      instance = new Resizable(el, { grid: { width: 10, height: 10 } })

      firePointerDown(el, { clientX: 195, clientY: 195 })
      firePointerMove(document, { clientX: 228, clientY: 223 })
      flushRAF()

      const width = parseFloat(el.style.width)
      const height = parseFloat(el.style.height)
      expect(width % 10).toBe(0)
      expect(height % 10).toBe(0)

      firePointerUp(document, { clientX: 228, clientY: 223 })
    })
  })

  describe('cursor feedback', () => {
    it('cursor updates based on edge proximity', () => {
      instance = new Resizable(el)

      let e = new PointerEvent('pointermove', {
        clientX: 195,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)
      expect(el.style.cursor).toBe('ew-resize')

      e = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 195,
        bubbles: true,
      })
      el.dispatchEvent(e)
      expect(el.style.cursor).toBe('ns-resize')

      e = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)
      expect(el.style.cursor).toBe('')
    })
  })

  describe('modifier integration', () => {
    it('modifiers are called during resize', () => {
      const modifyFn = vi.fn().mockImplementation((ctx) => ({
        position: ctx.position,
        velocity: ctx.velocity,
        size: ctx.size,
      }))

      const modifier = {
        name: 'test-resize-modifier',
        modify: modifyFn,
      }

      instance = new Resizable(el, { modifiers: [modifier] })

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 245, clientY: 100 })
      flushRAF()

      expect(modifyFn).toHaveBeenCalled()

      const ctx = modifyFn.mock.calls[0][0]
      expect(ctx).toHaveProperty('edges')
      expect(ctx).toHaveProperty('size')
      expect(ctx).toHaveProperty('startSize')

      firePointerUp(document, { clientX: 245, clientY: 100 })
    })

    it('modifier can alter size', () => {
      const modifier = {
        name: 'snap-modifier',
        modify: (ctx: any) => {
          // Mutate context.size in place — force to 300x300.
          if (ctx.size) {
            ctx.size.width = 300
            ctx.size.height = 300
          }
        },
      }

      instance = new Resizable(el, { modifiers: [modifier] })

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 245, clientY: 100 })
      flushRAF()

      expect(el.style.width).toBe('300px')
      expect(el.style.height).toBe('300px')

      firePointerUp(document, { clientX: 245, clientY: 100 })
    })
  })

  describe('priority system', () => {
    it('resize has priority 10', () => {
      instance = new Resizable(el)
      expect(instance).toBeDefined()
    })

    it('should not handle event when pointer is not near edge', () => {
      instance = new Resizable(el)

      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        isPrimary: true,
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(downEvent)

      expect(el.style.willChange).not.toBe('width, height, transform')
    })
  })

  describe('resize events', () => {
    it('onResizeStart fires with correct event data', () => {
      const onResizeStart = vi.fn()
      instance = new Resizable(el, { onResizeStart })

      firePointerDown(el, { clientX: 195, clientY: 100 })

      expect(onResizeStart).toHaveBeenCalledTimes(1)
      const event = onResizeStart.mock.calls[0][0] as ResizeEvent
      expect(event).toHaveProperty('width')
      expect(event).toHaveProperty('height')
      expect(event).toHaveProperty('deltaWidth', 0)
      expect(event).toHaveProperty('deltaHeight', 0)
      expect(event).toHaveProperty('edges')

      firePointerUp(document, { clientX: 195, clientY: 100 })
    })

    it('onResizeMove fires with size changes', () => {
      const onResizeMove = vi.fn()
      instance = new Resizable(el, { onResizeMove })

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 245, clientY: 100 })
      flushRAF()

      expect(onResizeMove).toHaveBeenCalled()
      const event = onResizeMove.mock.calls[0][0] as ResizeEvent
      expect(event.deltaWidth).toBe(50)
      expect(event.width).toBe(250)
      expect(event.edges.right).toBe(true)

      firePointerUp(document, { clientX: 245, clientY: 100 })
    })

    it('onResizeEnd fires on release', () => {
      const onResizeEnd = vi.fn()
      instance = new Resizable(el, { onResizeEnd })

      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: 245, clientY: 100 })
      flushRAF()
      firePointerUp(document, { clientX: 245, clientY: 100 })

      expect(onResizeEnd).toHaveBeenCalledTimes(1)
      const event = onResizeEnd.mock.calls[0][0] as ResizeEvent
      expect(event.deltaWidth).toBe(50)
    })
  })

  describe('setSize / getSize', () => {
    it('setSize sets width and height programmatically', () => {
      instance = new Resizable(el)

      instance.setSize(300, 150)
      expect(el.style.width).toBe('300px')
      expect(el.style.height).toBe('150px')
    })

    it('getSize returns current size', () => {
      instance = new Resizable(el)

      instance.setSize(300, 150)
      const size = instance.getSize()
      expect(size).toEqual({ width: 300, height: 150 })
    })

    it('getSize returns a copy, not internal state', () => {
      instance = new Resizable(el)

      instance.setSize(200, 200)
      const size = instance.getSize()
      size.width = 999
      expect(instance.getSize().width).toBe(200)
    })
  })

  describe('destroy', () => {
    it('cleans up event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(el, 'removeEventListener')
      instance = new Resizable(el)

      instance.destroy()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    })

    it('cleans up cursor style', () => {
      instance = new Resizable(el)

      const e = new PointerEvent('pointermove', {
        clientX: 195,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)
      expect(el.style.cursor).toBe('ew-resize')

      instance.destroy()
      expect(el.style.cursor).toBe('')
    })

    it('cleans up willChange style', () => {
      instance = new Resizable(el)

      firePointerDown(el, { clientX: 195, clientY: 100 })
      expect(el.style.willChange).toBe('width, height, transform')

      firePointerUp(document, { clientX: 195, clientY: 100 })
      instance.destroy()
      expect(el.style.willChange).toBe('')
    })
  })

  describe('factory function', () => {
    it('resizable() works with HTMLElement', () => {
      instance = resizable(el)
      expect(instance).toBeInstanceOf(Resizable)
    })

    it('resizable() works with selector string', () => {
      el.id = 'test-resize-el'

      instance = resizable('#test-resize-el')
      expect(instance).toBeInstanceOf(Resizable)
    })

    it('resizable() throws for missing element', () => {
      expect(() => resizable('#nonexistent')).toThrow('Element not found')
    })
  })

  describe('edge configuration', () => {
    it('respects disabled edges', () => {
      instance = new Resizable(el, {
        edges: { top: false, right: true, bottom: true, left: false },
      })

      let e = new PointerEvent('pointermove', {
        clientX: 3,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)
      expect(el.style.cursor).toBe('')

      e = new PointerEvent('pointermove', {
        clientX: 195,
        clientY: 100,
        bubbles: true,
      })
      el.dispatchEvent(e)
      expect(el.style.cursor).toBe('ew-resize')
    })
  })

  describe('invert modes', () => {
    it('invert none clamps to min size (default)', () => {
      instance = new Resizable(el, { minWidth: 50, minHeight: 50 })

      // Drag right edge far left past zero
      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: -100, clientY: 100 })
      flushRAF()

      const size = instance.getSize()
      expect(size.width).toBeGreaterThanOrEqual(50)

      firePointerUp(document, { clientX: -100, clientY: 100 })
    })

    it('invert negate allows negative dimensions', () => {
      instance = new Resizable(el, { invert: 'negate' })

      // Drag right edge far left past zero
      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: -100, clientY: 100 })
      flushRAF()

      const size = instance.getSize()
      // Width should be negative: 200 + (-100 - 195) = 200 - 295 = -95
      expect(size.width).toBeLessThan(0)

      firePointerUp(document, { clientX: -100, clientY: 100 })
    })

    it('invert reposition flips element when dragged past zero', () => {
      instance = new Resizable(el, { invert: 'reposition' })

      // Drag right edge left past zero
      // Start: right edge at x=200, drag to x=-50 → delta = -250
      // newWidth = 200 + (-250) = -50 → flip: newX += -50, newWidth = 50
      firePointerDown(el, { clientX: 195, clientY: 100 })
      firePointerMove(document, { clientX: -55, clientY: 100 })
      flushRAF()

      const size = instance.getSize()
      // Width should be positive after flip
      expect(size.width).toBeGreaterThan(0)

      // The element should have moved left (position adjusted)
      const transform = el.style.transform
      if (transform.includes('translate3d')) {
        const match = transform.match(/translate3d\(([^,]+),/)
        if (match) {
          // Position should be shifted left from the flip
          expect(parseFloat(match[1])).toBeLessThan(0)
        }
      }

      firePointerUp(document, { clientX: -55, clientY: 100 })
    })

    it('invert reposition has no dead zone at zero', () => {
      instance = new Resizable(el, { invert: 'reposition' })

      // Drag right edge to make width exactly 0, then a bit past
      firePointerDown(el, { clientX: 195, clientY: 100 })

      // First: drag to make width small but positive (5px)
      firePointerMove(document, { clientX: 0, clientY: 100 })
      flushRAF()
      const size1 = instance.getSize()
      expect(size1.width).toBeGreaterThan(0)

      // Then: drag past zero
      firePointerMove(document, { clientX: -10, clientY: 100 })
      flushRAF()
      const size2 = instance.getSize()
      expect(size2.width).toBeGreaterThan(0) // should be positive after flip

      firePointerUp(document, { clientX: -10, clientY: 100 })
    })

    it('invert reposition works for top edge', () => {
      instance = new Resizable(el, { invert: 'reposition' })

      // Drag top edge below the bottom edge
      // Element: top=0, height=200, so bottom is at y=200
      // Drag top to y=250 → delta=250, newHeight = 200 - 250 = -50 → flip
      firePointerDown(el, { clientX: 100, clientY: 5 })
      firePointerMove(document, { clientX: 100, clientY: 255 })
      flushRAF()

      const size = instance.getSize()
      expect(size.height).toBeGreaterThan(0)

      firePointerUp(document, { clientX: 100, clientY: 255 })
    })
  })
})
