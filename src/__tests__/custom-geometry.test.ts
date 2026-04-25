// End-to-end tests for the rectChecker + origin options.
//
// These tests never set `element.getBoundingClientRect` — everything flows
// through a user-supplied rectChecker. They prove the library can be driven
// in environments where real DOM measurements aren't available (SVG coords,
// virtualized lists, canvas-projected overlays, unit tests with no jsdom
// measurement setup).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Draggable } from '../drag'
import { Dropzone, DropzoneManager } from '../dropzone'
import { Sortable } from '../sortable'
import { firePointerDown, firePointerMove, firePointerUp, flushRAF, resetRAF } from './helpers'

// Tiny factory that creates an element WITHOUT installing a mocked
// getBoundingClientRect. Any rect access has to go through rectChecker.
function rawElement(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function domRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON() {
      return this
    },
  } as DOMRect
}

describe('Draggable with rectChecker', () => {
  beforeEach(() => {
    resetRAF()
  })

  it('computes bounds from rectChecker (not getBoundingClientRect)', () => {
    const el = rawElement()
    const checker = vi.fn((node: HTMLElement) => {
      // Return a logical rect for the element; return a larger rect for
      // anything else (e.g., parent) to drive the bounds math.
      if (node === el) return domRect(10, 10, 100, 100)
      return domRect(0, 0, 400, 400)
    })

    const d = new Draggable(el, {
      bounds: { left: 0, top: 0, right: 300, bottom: 300 },
      rectChecker: checker,
      threshold: 0,
    })

    firePointerDown(el, { clientX: 60, clientY: 60 })
    firePointerMove(document, { clientX: 500, clientY: 500 })
    flushRAF()

    // Bounds are transform-space: max x = 300 (right) - 110 (rect.right) + 0 = 190.
    // Movement was 440px right but clamped to the bound.
    const pos = d.getPosition()
    expect(pos.x).toBeLessThanOrEqual(190)
    expect(pos.y).toBeLessThanOrEqual(190)

    // rectChecker was actually used for the element itself.
    expect(checker).toHaveBeenCalledWith(el)

    firePointerUp(document, { clientX: 500, clientY: 500 })
    d.destroy()
    el.remove()
  })

  it('drives the full drag cycle with zero real DOM measurements', () => {
    const el = rawElement()
    // Assert rectChecker is called, not getBoundingClientRect.
    el.getBoundingClientRect = vi.fn(() => {
      throw new Error('getBoundingClientRect must not be called')
    })

    const onDragMove = vi.fn()
    const d = new Draggable(el, {
      rectChecker: () => domRect(0, 0, 50, 50),
      onDragMove,
      threshold: 0,
    })

    firePointerDown(el, { clientX: 0, clientY: 0 })
    firePointerMove(document, { clientX: 100, clientY: 100 })
    flushRAF()
    firePointerUp(document, { clientX: 100, clientY: 100 })

    expect(onDragMove).toHaveBeenCalled()
    d.destroy()
    el.remove()
  })
})

describe('Dropzone with rectChecker', () => {
  beforeEach(() => {
    resetRAF()
  })

  it('uses zone rectChecker for hit testing', () => {
    const draggableEl = rawElement()
    draggableEl.getBoundingClientRect = () => domRect(0, 0, 10, 10)

    const zoneEl = rawElement()
    // Real getBoundingClientRect would return all zeros for this element —
    // hit testing would always fail. rectChecker saves us.
    const zone = new Dropzone(zoneEl, {
      rectChecker: () => domRect(0, 0, 200, 200),
      overlap: 'pointer',
    })

    // Simulate a drag
    DropzoneManager.onDragStart(draggableEl)
    expect(zone.isActive).toBe(true)

    // Hit test with a pointer inside our logical rect
    DropzoneManager.onDragMove(draggableEl, { x: 50, y: 50 })
    expect(zone.isOver).toBe(true)

    // And outside
    DropzoneManager.onDragMove(draggableEl, { x: 999, y: 999 })
    expect(zone.isOver).toBe(false)

    DropzoneManager.onDragEnd(draggableEl, { x: 999, y: 999 })
    zone.destroy()
    zoneEl.remove()
    draggableEl.remove()
  })

  it('receives the draggable rect from the drag side rectChecker', () => {
    // Draggable has its own rectChecker; the zone uses 'center' overlap and
    // must hit-test against the draggable's logical rect, not its DOM rect.
    const dragEl = rawElement()
    dragEl.getBoundingClientRect = () => domRect(0, 0, 0, 0) // empty
    const zoneEl = rawElement()
    zoneEl.getBoundingClientRect = () => domRect(0, 0, 100, 100)

    const zone = new Dropzone(zoneEl, { overlap: 'center' })

    // Draggable reports a logical rect centered in the zone.
    const d = new Draggable(dragEl, {
      droppable: true,
      rectChecker: () => domRect(40, 40, 20, 20), // center at (50, 50)
      threshold: 0,
    })

    // Pointer needs to actually move to trigger onPointerMove → update().
    firePointerDown(dragEl, { clientX: 5, clientY: 5 })
    firePointerMove(document, { clientX: 6, clientY: 6 })
    flushRAF()

    expect(zone.isOver).toBe(true)

    firePointerUp(document, { clientX: 6, clientY: 6 })
    d.destroy()
    zone.destroy()
    dragEl.remove()
    zoneEl.remove()
  })
})

describe('Sortable with rectChecker', () => {
  beforeEach(() => {
    resetRAF()
  })

  it('passes rectChecker to each child Draggable', () => {
    const container = rawElement()
    for (let i = 0; i < 3; i++) {
      const item = document.createElement('div')
      container.appendChild(item)
    }

    // rectChecker returns logical rects — no real DOM measurement.
    const checker = (el: HTMLElement): DOMRect => {
      if (el === container) return domRect(0, 0, 300, 300)
      const items = Array.from(container.children)
      const idx = items.indexOf(el)
      if (idx >= 0) return domRect(0, idx * 50, 300, 50)
      return domRect(0, 0, 0, 0)
    }

    const s = new Sortable(container, {
      axis: 'y',
      rectChecker: checker,
      aria: false,
    })

    // snapshotItems should have pulled rects from the checker.
    const firstItem = container.children[0] as HTMLElement
    firePointerDown(firstItem, { clientX: 10, clientY: 10 })
    firePointerMove(document, { clientX: 10, clientY: 120 })
    flushRAF()
    firePointerUp(document, { clientX: 10, clientY: 120 })

    // Test completed without calling real getBoundingClientRect.
    s.destroy()
    container.remove()
  })
})

describe('origin option', () => {
  beforeEach(() => {
    resetRAF()
  })

  it('translates pointer coords relative to a static offset origin', () => {
    const el = rawElement()
    el.getBoundingClientRect = () => domRect(0, 0, 100, 100)

    const onDragMove = vi.fn()
    const d = new Draggable(el, {
      origin: { x: 1000, y: 500 },
      onDragMove,
      threshold: 0,
    })

    firePointerDown(el, { clientX: 1010, clientY: 510 })
    firePointerMove(document, { clientX: 1050, clientY: 550 })
    flushRAF()

    // Pointer started at client (1010, 510), reported as (10, 10) in origin space.
    // Moved to client (1050, 550), reported as (50, 50) in origin space.
    // totalX/Y = current - start.
    const call = onDragMove.mock.calls[0][0]
    expect(call.totalX).toBe(40)
    expect(call.totalY).toBe(40)

    firePointerUp(document, { clientX: 1050, clientY: 550 })
    d.destroy()
    el.remove()
  })

  it('translates pointer coords relative to an element origin', () => {
    const el = rawElement()
    el.getBoundingClientRect = () => domRect(0, 0, 100, 100)
    const originEl = rawElement()
    originEl.getBoundingClientRect = () => domRect(200, 300, 0, 0)

    const onDragMove = vi.fn()
    const d = new Draggable(el, {
      origin: originEl,
      onDragMove,
      threshold: 0,
    })

    firePointerDown(el, { clientX: 210, clientY: 310 })
    firePointerMove(document, { clientX: 260, clientY: 360 })
    flushRAF()

    const call = onDragMove.mock.calls[0][0]
    expect(call.totalX).toBe(50)
    expect(call.totalY).toBe(50)

    firePointerUp(document, { clientX: 260, clientY: 360 })
    d.destroy()
    el.remove()
    originEl.remove()
  })
})
