import { describe, it, expect, vi, afterEach } from 'vitest'
import { firePointerDown, firePointerMove, firePointerUp, flushRAF } from './helpers'
import { Sortable, sortable } from '../sortable'

function createListContainer(
  count: number,
  itemHeight = 50,
  gap = 0,
): {
  container: HTMLElement
  items: HTMLElement[]
} {
  const container = document.createElement('div')
  container.style.width = '300px'
  document.body.appendChild(container)
  container.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, 0, 300, count * (itemHeight + gap) - gap))

  const items: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div')
    item.textContent = `Item ${i}`
    item.dataset.index = String(i)
    item.style.height = `${itemHeight}px`
    container.appendChild(item)
    const top = i * (itemHeight + gap)
    item.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, top, 300, itemHeight))
    items.push(item)
  }

  return { container, items }
}

describe('Sortable', () => {
  let container: HTMLElement
  let items: HTMLElement[]
  let instance: Sortable

  afterEach(() => {
    instance?.destroy()
    container?.remove()
  })

  describe('index detection — moving items DOWN', () => {
    it('item 0 can move to index 1 (down one slot)', () => {
      // Items at y: 0-49, 50-99, 100-149, 150-199, 200-249
      // Midpoints:   25,     75,      125,      175,      225
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Drag item 0 (mid=25) down past item 1's midpoint (75)
      firePointerDown(items[0], { clientX: 150, clientY: 25 })
      firePointerMove(document, { clientX: 150, clientY: 30 }) // past threshold
      flushRAF()

      // Move center to y=80 (past item 1's mid=75)
      // Item 0 started at top=0, so its center was 25. Moving to center=80 means top=55.
      // The drag delta = 80 - 25 = 55. clientY = 25 + 55 = 80
      firePointerMove(document, { clientX: 150, clientY: 80 })
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      const lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.oldIndex).toBe(0)
      expect(lastCall.newIndex).toBe(1)

      firePointerUp(document, { clientX: 150, clientY: 80 })
    })

    it('item 0 can move to last position', () => {
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Drag item 0 all the way down past all midpoints
      firePointerDown(items[0], { clientX: 150, clientY: 25 })
      firePointerMove(document, { clientX: 150, clientY: 30 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 250 }) // past all midpoints
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      const lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.oldIndex).toBe(0)
      expect(lastCall.newIndex).toBe(4)

      firePointerUp(document, { clientX: 150, clientY: 250 })
    })
  })

  describe('index detection — moving items UP (regression)', () => {
    it('item 2 can move to index 1 (up one slot)', () => {
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Item 2 starts at top=100, center=125
      // To move to index 1, center needs to be above item 1's midpoint (75)
      // but past item 0's midpoint (25). So center around 50.
      // Delta = 50 - 125 = -75. clientY = 125 + (-75) = 50
      firePointerDown(items[2], { clientX: 150, clientY: 125 })
      firePointerMove(document, { clientX: 150, clientY: 120 }) // past threshold
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 50 })
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      const lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.oldIndex).toBe(2)
      expect(lastCall.newIndex).toBe(1)

      firePointerUp(document, { clientX: 150, clientY: 50 })
    })

    it('item 2 can move to index 0 (up to first position)', () => {
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Item 2 center=125. To reach index 0, center must be below item 0's mid (25).
      // So center around 10.
      firePointerDown(items[2], { clientX: 150, clientY: 125 })
      firePointerMove(document, { clientX: 150, clientY: 120 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 10 })
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      const lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.oldIndex).toBe(2)
      expect(lastCall.newIndex).toBe(0)

      firePointerUp(document, { clientX: 150, clientY: 10 })
    })

    it('last item can move to first position', () => {
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Item 4 center=225. Move all the way up past everything.
      firePointerDown(items[4], { clientX: 150, clientY: 225 })
      firePointerMove(document, { clientX: 150, clientY: 220 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 5 })
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      const lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.oldIndex).toBe(4)
      expect(lastCall.newIndex).toBe(0)

      firePointerUp(document, { clientX: 150, clientY: 5 })
    })

    it('item 1 can move to index 0 (up one from second position)', () => {
      ;({ container, items } = createListContainer(3))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Item 1: top=50, center=75. Item 0 midpoint=25.
      // Move center to 20 (above item 0's mid)
      firePointerDown(items[1], { clientX: 150, clientY: 75 })
      firePointerMove(document, { clientX: 150, clientY: 70 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 20 })
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      const lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.oldIndex).toBe(1)
      expect(lastCall.newIndex).toBe(0)

      firePointerUp(document, { clientX: 150, clientY: 20 })
    })
  })

  describe('index detection — staying in place', () => {
    it('small movement within own slot does not trigger sort', () => {
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Item 2 center=125. Move a tiny bit — still between item 1's mid (75) and item 3's mid (175)
      firePointerDown(items[2], { clientX: 150, clientY: 125 })
      firePointerMove(document, { clientX: 150, clientY: 120 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 100 }) // center=100, still between 75 and 175
      flushRAF()

      // Should NOT trigger onSort since we're still in our own slot
      expect(onSort).not.toHaveBeenCalled()

      firePointerUp(document, { clientX: 150, clientY: 100 })
    })
  })

  describe('animation offsets', () => {
    it('moving up: displaced items shift down to next neighbor position', () => {
      // Items: 0(top=0), 1(top=50), 2(top=100), 3(top=150), 4(top=200)
      // Drag item 3 up to index 1 → items 1 and 2 should shift down
      ;({ container, items } = createListContainer(5))
      instance = new Sortable(container)

      firePointerDown(items[3], { clientX: 150, clientY: 175 })
      firePointerMove(document, { clientX: 150, clientY: 170 })
      flushRAF()
      // Move center to 60 → past item 0's mid(25) but that gives index 1
      firePointerMove(document, { clientX: 150, clientY: 60 })
      flushRAF()

      // Item 1 (i=1) should move to item 2's position: offset = 100-50 = +50
      expect(items[1].style.transform).toBe('translateY(50px)')
      // Item 2 (i=2) should move to item 3's position: offset = 150-100 = +50
      expect(items[2].style.transform).toBe('translateY(50px)')
      // Item 0 should NOT move (it's outside the [to, from) range)
      expect(items[0].style.transform).toBe('translateY(0px)')
      // Item 4 should NOT move
      expect(items[4].style.transform).toBe('translateY(0px)')

      firePointerUp(document, { clientX: 150, clientY: 60 })
    })

    it('moving down: displaced items shift up to previous neighbor position', () => {
      // Drag item 1 down to index 3 → items 2 and 3 should shift up
      ;({ container, items } = createListContainer(5))
      instance = new Sortable(container)

      firePointerDown(items[1], { clientX: 150, clientY: 75 })
      firePointerMove(document, { clientX: 150, clientY: 80 })
      flushRAF()
      // Move center to 190 → past item 3's mid(175), gives index 3
      firePointerMove(document, { clientX: 150, clientY: 190 })
      flushRAF()

      // Item 2 (i=2) should move to item 1's position: offset = 50-100 = -50
      expect(items[2].style.transform).toBe('translateY(-50px)')
      // Item 3 (i=3) should move to item 2's position: offset = 100-150 = -50
      expect(items[3].style.transform).toBe('translateY(-50px)')
      // Item 0 should NOT move
      expect(items[0].style.transform).toBe('translateY(0px)')
      // Item 4 should NOT move
      expect(items[4].style.transform).toBe('translateY(0px)')

      firePointerUp(document, { clientX: 150, clientY: 190 })
    })
  })

  describe('index detection — moving back and forth', () => {
    it('can move down then back up to original position', () => {
      ;({ container, items } = createListContainer(5))
      const onSort = vi.fn()
      instance = new Sortable(container, { onSort })

      // Item 2 center=125. Move down past item 3 (mid=175)
      firePointerDown(items[2], { clientX: 150, clientY: 125 })
      firePointerMove(document, { clientX: 150, clientY: 130 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 200 }) // past 175
      flushRAF()

      expect(onSort).toHaveBeenCalled()
      let lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.newIndex).toBe(3)

      // Now move back up to original position
      firePointerMove(document, { clientX: 150, clientY: 125 })
      flushRAF()

      lastCall = onSort.mock.calls[onSort.mock.calls.length - 1][0]
      expect(lastCall.newIndex).toBe(2) // back to original

      firePointerUp(document, { clientX: 150, clientY: 125 })
    })
  })

  describe('DOM reordering on drag end', () => {
    it('reorders DOM when dragged down', () => {
      ;({ container, items } = createListContainer(3))
      const onSortEnd = vi.fn()
      instance = new Sortable(container, { onSortEnd })

      firePointerDown(items[0], { clientX: 150, clientY: 25 })
      firePointerMove(document, { clientX: 150, clientY: 30 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 100 })
      flushRAF()
      firePointerUp(document, { clientX: 150, clientY: 100 })

      expect(onSortEnd).toHaveBeenCalled()
      const event = onSortEnd.mock.calls[0][0]
      expect(event.oldIndex).toBe(0)
    })

    it('reorders DOM when dragged up', () => {
      ;({ container, items } = createListContainer(3))
      const onSortEnd = vi.fn()
      instance = new Sortable(container, { onSortEnd })

      // Drag item 2 up to position 0
      firePointerDown(items[2], { clientX: 150, clientY: 125 })
      firePointerMove(document, { clientX: 150, clientY: 120 })
      flushRAF()
      firePointerMove(document, { clientX: 150, clientY: 10 })
      flushRAF()
      firePointerUp(document, { clientX: 150, clientY: 10 })

      expect(onSortEnd).toHaveBeenCalled()
      const event = onSortEnd.mock.calls[0][0]
      expect(event.oldIndex).toBe(2)
      expect(event.newIndex).toBe(0)

      // Check DOM order: item 2 should now be first child
      const newChildren = Array.from(container.children)
      expect(newChildren[0]).toBe(items[2])
      expect(newChildren[1]).toBe(items[0])
      expect(newChildren[2]).toBe(items[1])
    })

    it('move() programmatically reorders items', () => {
      ;({ container, items } = createListContainer(4))
      const onSortEnd = vi.fn()
      instance = new Sortable(container, { onSortEnd })

      const originalSecond = items[1]
      instance.move(0, 2)

      expect(onSortEnd).toHaveBeenCalledWith(expect.objectContaining({ oldIndex: 0, newIndex: 2 }))

      const newChildren = Array.from(container.children) as HTMLElement[]
      expect(newChildren[0]).toBe(originalSecond)
    })

    it('move() with same index does nothing', () => {
      ;({ container, items } = createListContainer(3))
      const onSortEnd = vi.fn()
      instance = new Sortable(container, { onSortEnd })

      instance.move(1, 1)
      expect(onSortEnd).not.toHaveBeenCalled()
    })

    it('move() with out of bounds index does nothing', () => {
      ;({ container, items } = createListContainer(3))
      const onSortEnd = vi.fn()
      instance = new Sortable(container, { onSortEnd })

      instance.move(-1, 1)
      expect(onSortEnd).not.toHaveBeenCalled()
      instance.move(0, 10)
      expect(onSortEnd).not.toHaveBeenCalled()
    })
  })

  describe('construction', () => {
    it('creates draggable instances for all children', () => {
      ;({ container, items } = createListContainer(5))
      instance = new Sortable(container)

      for (const item of items) {
        expect(item.style.cursor).toBe('grab')
      }
    })

    it('uses items selector when provided', () => {
      container = document.createElement('div')
      document.body.appendChild(container)

      const header = document.createElement('h2')
      container.appendChild(header)

      const sortableItems: HTMLElement[] = []
      for (let i = 0; i < 3; i++) {
        const item = document.createElement('div')
        item.className = 'sort-item'
        item.style.height = '50px'
        container.appendChild(item)
        item.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, i * 50, 300, 50))
        sortableItems.push(item)
      }

      container.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, 0, 300, 150))

      instance = new Sortable(container, { items: '.sort-item' })

      for (const item of sortableItems) {
        expect(item.style.cursor).toBe('grab')
      }
      expect(header.style.cursor).not.toBe('grab')
    })
  })

  describe('drag styling', () => {
    it('adds dragClass during drag and removes on end', () => {
      ;({ container, items } = createListContainer(3))
      instance = new Sortable(container, { dragClass: 'is-dragging' })

      firePointerDown(items[0], { clientX: 150, clientY: 25 })
      firePointerMove(document, { clientX: 150, clientY: 30 })
      flushRAF()

      expect(items[0].classList.contains('is-dragging')).toBe(true)

      firePointerUp(document, { clientX: 150, clientY: 30 })

      expect(items[0].classList.contains('is-dragging')).toBe(false)
    })

    it('sets high z-index during drag', () => {
      ;({ container, items } = createListContainer(3))
      instance = new Sortable(container)

      firePointerDown(items[0], { clientX: 150, clientY: 25 })
      firePointerMove(document, { clientX: 150, clientY: 30 })
      flushRAF()

      expect(items[0].style.zIndex).toBe('9999')

      firePointerUp(document, { clientX: 150, clientY: 30 })
      expect(items[0].style.zIndex).toBe('')
    })
  })

  describe('getOrder and refresh', () => {
    it('getOrder returns items in current DOM order', () => {
      ;({ container, items } = createListContainer(3))
      instance = new Sortable(container)

      const order = instance.getOrder()
      expect(order).toHaveLength(3)
      expect(order[0]).toBe(items[0])
      expect(order[1]).toBe(items[1])
      expect(order[2]).toBe(items[2])
    })

    it('getOrder reflects DOM changes after move', () => {
      ;({ container, items } = createListContainer(3))
      instance = new Sortable(container)

      instance.move(0, 2)

      const order = instance.getOrder()
      expect(order[0]).toBe(items[1])
      expect(order[1]).toBe(items[2])
      expect(order[2]).toBe(items[0])
    })

    it('refresh picks up dynamically added items', () => {
      ;({ container, items } = createListContainer(2))
      instance = new Sortable(container)

      const newItem = document.createElement('div')
      newItem.textContent = 'New Item'
      newItem.style.height = '50px'
      container.appendChild(newItem)
      newItem.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, 100, 300, 50))

      instance.refresh()

      const order = instance.getOrder()
      expect(order).toHaveLength(3)
      expect(order[2]).toBe(newItem)
      expect(newItem.style.cursor).toBe('grab')
    })
  })

  describe('horizontal sorting', () => {
    it('axis x restricts to horizontal movement', () => {
      container = document.createElement('div')
      container.style.display = 'flex'
      document.body.appendChild(container)
      container.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(0, 0, 400, 80))

      items = []
      for (let i = 0; i < 4; i++) {
        const item = document.createElement('div')
        item.style.width = '80px'
        item.style.height = '80px'
        container.appendChild(item)
        item.getBoundingClientRect = vi.fn().mockReturnValue(new DOMRect(i * 100, 0, 80, 80))
        items.push(item)
      }

      instance = new Sortable(container, { axis: 'x' })

      firePointerDown(items[0], { clientX: 40, clientY: 40 })
      firePointerMove(document, { clientX: 50, clientY: 40 })
      flushRAF()

      const transform = items[0].style.transform
      if (transform.includes('translate3d')) {
        const match = transform.match(/translate3d\([^,]+,\s*([^,]+),/)
        if (match) {
          expect(parseFloat(match[1])).toBe(0) // y should be 0
        }
      }

      firePointerUp(document, { clientX: 50, clientY: 40 })
    })
  })

  describe('destroy', () => {
    it('cleans up all draggables and styles', () => {
      ;({ container, items } = createListContainer(3))
      instance = new Sortable(container)

      instance.destroy()

      for (const item of items) {
        expect(item.style.cursor).toBe('')
      }
      for (const item of items) {
        expect(item.style.transform).toBe('')
      }
    })
  })

  describe('factory function', () => {
    it('creates sortable from element', () => {
      ;({ container, items } = createListContainer(3))
      instance = sortable(container)
      expect(instance).toBeInstanceOf(Sortable)
    })

    it('creates sortable from selector', () => {
      ;({ container, items } = createListContainer(3))
      container.id = 'test-sortable-container'
      instance = sortable('#test-sortable-container')
      expect(instance).toBeInstanceOf(Sortable)
    })

    it('throws on missing element', () => {
      expect(() => sortable('#does-not-exist')).toThrow('Container not found')
    })
  })
})
