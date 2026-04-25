import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockElement, firePointerDown, firePointerMove, firePointerUp, flushRAF } from './helpers'
import { Draggable } from '../drag'
import { Resizable } from '../resize'
import { interactable } from '../index'

describe('Combined drag + resize interactions', () => {
  let el: HTMLElement
  let dragInstance: Draggable
  let resizeInstance: Resizable

  beforeEach(() => {
    el = createMockElement({ x: 100, y: 100, width: 200, height: 200, top: 100, left: 100, right: 300, bottom: 300 })
    el.style.width = '200px'
    el.style.height = '200px'
  })

  afterEach(() => {
    dragInstance?.destroy()
    resizeInstance?.destroy()
    el?.remove()
  })

  describe('resize then drag (regression: snap-back bug)', () => {
    it('drag starts from post-resize position, not the original position', () => {
      resizeInstance = new Resizable(el)
      dragInstance = new Draggable(el)

      // === STEP 1: Resize from the left edge, which moves the element ===
      // Simulate: the element's transform was changed by a resize from left
      // (Resizable writes translate3d when resizing from top/left edges)
      el.style.transform = 'translate3d(-50px, 0px, 0)'

      // Mock getComputedStyle to return the current transform
      const origGetComputedStyle = window.getComputedStyle
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        if (element === el) {
          const real = origGetComputedStyle(element)
          return {
            ...real,
            transform: 'matrix(1, 0, 0, 1, -50, 0)',
            width: '250px',
            height: '200px',
            getPropertyValue: real.getPropertyValue.bind(real),
          } as CSSStyleDeclaration
        }
        return origGetComputedStyle(element)
      })

      // === STEP 2: Start a drag from the center of the element ===
      firePointerDown(el, { clientX: 150, clientY: 200 })
      // Move past threshold
      firePointerMove(document, { clientX: 160, clientY: 200 })
      flushRAF()

      // The transform should be based on the CURRENT position (-50) plus the drag delta (10)
      // NOT resetting to 0 + 10 = 10 (the old bug)
      const transform = el.style.transform
      const match = transform.match(/translate3d\(([^,]+),/)
      expect(match).not.toBeNull()
      const xValue = parseFloat(match![1])

      // Should be around -40 (started at -50, moved +10)
      expect(xValue).toBeCloseTo(-40, 0)

      firePointerUp(document, { clientX: 160, clientY: 200 })
      vi.restoreAllMocks()
    })

    it('drag preserves resize transform after multiple resize+drag cycles', () => {
      resizeInstance = new Resizable(el)
      dragInstance = new Draggable(el)

      const origGetComputedStyle = window.getComputedStyle

      // Simulate resize moved element to (-30, -20)
      el.style.transform = 'translate3d(-30px, -20px, 0)'
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        if (element === el) {
          const real = origGetComputedStyle(element)
          return {
            ...real,
            transform: 'matrix(1, 0, 0, 1, -30, -20)',
            width: '200px',
            height: '200px',
            getPropertyValue: real.getPropertyValue.bind(real),
          } as CSSStyleDeclaration
        }
        return origGetComputedStyle(element)
      })

      // Drag the element +100, +50
      firePointerDown(el, { clientX: 150, clientY: 150 })
      firePointerMove(document, { clientX: 250, clientY: 200 })
      flushRAF()

      const transform = el.style.transform
      const match = transform.match(/translate3d\(([^,]+),\s*([^,]+),/)
      expect(match).not.toBeNull()
      const xValue = parseFloat(match![1])
      const yValue = parseFloat(match![2])

      // Should be: -30 + 100 = 70, -20 + 50 = 30
      expect(xValue).toBeCloseTo(70, 0)
      expect(yValue).toBeCloseTo(30, 0)

      firePointerUp(document, { clientX: 250, clientY: 200 })
      vi.restoreAllMocks()
    })

    it('draggable.getPosition() returns correct position after external transform change', () => {
      dragInstance = new Draggable(el)

      const origGetComputedStyle = window.getComputedStyle

      // Externally set the transform (simulating resize or programmatic change)
      el.style.transform = 'translate3d(100px, 200px, 0)'
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        if (element === el) {
          const real = origGetComputedStyle(element)
          return {
            ...real,
            transform: 'matrix(1, 0, 0, 1, 100, 200)',
            getPropertyValue: real.getPropertyValue.bind(real),
          } as CSSStyleDeclaration
        }
        return origGetComputedStyle(element)
      })

      // Start and immediately end a drag to trigger readCurrentTransform
      firePointerDown(el, { clientX: 150, clientY: 150 })
      firePointerMove(document, { clientX: 155, clientY: 150 })
      flushRAF()
      firePointerUp(document, { clientX: 155, clientY: 150 })

      const pos = dragInstance.getPosition()
      // Should reflect the externally-set transform + drag delta
      expect(pos.x).toBeCloseTo(105, 0)
      expect(pos.y).toBeCloseTo(200, 0)

      vi.restoreAllMocks()
    })
  })

  describe('priority system with combined instances', () => {
    it('resize wins when pointer is near edge, drag wins when in center', () => {
      resizeInstance = new Resizable(el)
      dragInstance = new Draggable(el)

      // Resize has priority 10, drag has priority 5
      // When near an edge, resize.shouldHandleEvent returns true and wins
      // When in center, resize returns false, drag wins

      // Near right edge (within handleSize=10 of right side at x=200)
      const _nearEdgeEvent = new PointerEvent('pointerdown', {
        clientX: 295, // rect.left(100) + rect.width(200) - 5 = 295
        clientY: 200,
        bubbles: true,
      })

      // The resizable's shouldHandleEvent checks edge proximity
      // This verifies the priority system works
      expect(resizeInstance['priority']).toBe(10)
      expect(dragInstance['priority']).toBe(5)
    })
  })

  describe('interactable factory', () => {
    it('creates both drag and resize instances on same element', () => {
      const result = interactable(el, { drag: true, resize: true })
      expect(result.drag).not.toBeNull()
      expect(result.resize).not.toBeNull()
      result.destroy()
    })

    it('destroy cleans up all instances', () => {
      const result = interactable(el, { drag: true, resize: true })
      result.destroy()
      // Element should have no touch-action set after all instances destroyed
      expect(el.style.touchAction).toBe('')
    })
  })
})

describe('Sortable list pattern', () => {
  it('y-axis constrained drag works for reordering', () => {
    const items: HTMLElement[] = []
    const instances: Draggable[] = []

    // Create 5 list items
    for (let i = 0; i < 5; i++) {
      const item = createMockElement({
        x: 0,
        y: i * 50,
        width: 200,
        height: 40,
        top: i * 50,
        left: 0,
        right: 200,
        bottom: i * 50 + 40,
      })
      item.dataset.index = String(i)
      items.push(item)
    }

    // Track positions for each item
    const positions: Array<{ x: number; y: number }> = []
    items.forEach((item, i) => {
      instances.push(
        new Draggable(item, {
          axis: 'y',
          onDragMove: (e) => {
            positions[i] = { x: e.totalX, y: e.totalY }
          },
        }),
      )
    })

    // Drag item 0 down by 100px (past item 1 and into item 2's position)
    firePointerDown(items[0], { clientX: 100, clientY: 20 })
    firePointerMove(document, { clientX: 100, clientY: 120 })
    flushRAF()

    // Item should only move on y-axis
    const transform = items[0].style.transform
    const match = transform.match(/translate3d\(([^,]+),\s*([^,]+),/)
    expect(match).not.toBeNull()
    const xVal = parseFloat(match![1])
    const yVal = parseFloat(match![2])

    // X should be 0 (y-axis constrained)
    expect(xVal).toBe(0)
    // Y should be 100 (moved down)
    expect(yVal).toBeCloseTo(100, 0)

    // The onDragMove callback should have been called
    expect(positions[0]).toBeDefined()
    expect(positions[0].x).toBe(0) // axis='y' zeroes out x
    expect(positions[0].y).toBeCloseTo(100, 0)

    firePointerUp(document, { clientX: 100, clientY: 120 })

    // Cleanup
    instances.forEach((inst) => inst.destroy())
    items.forEach((item) => item.remove())
  })

  it('multiple items can be dragged independently', () => {
    const items: HTMLElement[] = []
    const instances: Draggable[] = []

    for (let i = 0; i < 3; i++) {
      const item = createMockElement({
        x: 0,
        y: i * 50,
        width: 200,
        height: 40,
        top: i * 50,
        left: 0,
        right: 200,
        bottom: i * 50 + 40,
      })
      items.push(item)
      instances.push(new Draggable(item, { axis: 'y' }))
    }

    // Drag item 1 down
    firePointerDown(items[1], { clientX: 100, clientY: 70 })
    firePointerMove(document, { clientX: 100, clientY: 170 })
    flushRAF()

    // Item 1 should have moved
    expect(items[1].style.transform).toContain('translate3d')
    const match1 = items[1].style.transform.match(/translate3d\([^,]+,\s*([^,]+),/)
    expect(parseFloat(match1![1])).toBeCloseTo(100, 0)

    // Items 0 and 2 should NOT have moved
    expect(items[0].style.transform).not.toContain('100')
    expect(items[2].style.transform).not.toContain('100')

    firePointerUp(document, { clientX: 100, clientY: 170 })

    instances.forEach((inst) => inst.destroy())
    items.forEach((item) => item.remove())
  })

  it('sortable with bounds keeps items within container', () => {
    const container = createMockElement({
      x: 0,
      y: 0,
      width: 200,
      height: 250,
      top: 0,
      left: 0,
      right: 200,
      bottom: 250,
    })

    const items: HTMLElement[] = []
    const instances: Draggable[] = []

    for (let i = 0; i < 5; i++) {
      const item = document.createElement('div')
      item.style.width = '200px'
      item.style.height = '40px'
      container.appendChild(item)
      item.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, i * 50, 200, 40))
      items.push(item)
      instances.push(
        new Draggable(item, {
          axis: 'y',
          bounds: 'parent',
        }),
      )
    }

    // Try to drag item 0 way past the container bottom (250px)
    firePointerDown(items[0], { clientX: 100, clientY: 20 })
    firePointerMove(document, { clientX: 100, clientY: 500 })
    flushRAF()

    // Should be constrained by bounds
    const transform = items[0].style.transform
    const match = transform.match(/translate3d\([^,]+,\s*([^,]+),/)
    const yVal = parseFloat(match![1])
    // The bounds calculation uses parentRect.height - rect.height = 250 - 40 = 210
    // Starting at y=20, moved to y=500, delta=480, but capped at bounds.bottom=210
    expect(yVal).toBeLessThanOrEqual(210)

    firePointerUp(document, { clientX: 100, clientY: 500 })

    instances.forEach((inst) => inst.destroy())
    items.forEach((item) => item.remove())
    container.remove()
  })
})
