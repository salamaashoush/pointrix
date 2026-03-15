import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockElement, firePointerDown, firePointerMove, firePointerUp, flushRAF, resetRAF } from './helpers'
import { Draggable } from '../drag'
import { Sortable } from '../sortable'
import { Dropzone } from '../dropzone'
import { setMessages, getMessages, announce } from '../aria'

// Helper to reset messages back to defaults between tests
const defaultMessages = { ...getMessages() }

function resetMessages() {
  setMessages({
    instructions: defaultMessages.instructions,
    pickedUp: defaultMessages.pickedUp,
    movedTo: defaultMessages.movedTo,
    dropped: defaultMessages.dropped,
    dragPickedUp: defaultMessages.dragPickedUp,
    dragDropped: defaultMessages.dragDropped,
  })
}

describe('announce()', () => {
  beforeEach(() => {
    // Remove any existing live regions
    document.querySelectorAll('[aria-live]').forEach((el) => el.remove())
  })

  afterEach(() => {
    resetRAF()
  })

  it('creates a live region element on first call', () => {
    announce('test message')

    const region = document.querySelector('[aria-live]')
    expect(region).not.toBeNull()
    expect(region).toBeInstanceOf(HTMLElement)
  })

  it('sets aria-live="assertive" and aria-atomic="true"', () => {
    announce('test message')

    const region = document.querySelector('[aria-live]')!
    expect(region.getAttribute('aria-live')).toBe('assertive')
    expect(region.getAttribute('aria-atomic')).toBe('true')
  })

  it('live region is visually hidden (sr-only styles)', () => {
    announce('test message')

    const region = document.querySelector('[aria-live]') as HTMLElement
    expect(region.style.position).toBe('fixed')
    expect(region.style.width).toBe('1px')
    expect(region.style.height).toBe('1px')
    expect(region.style.overflow).toBe('hidden')
  })

  it('subsequent calls reuse the same element', () => {
    announce('first message')
    flushRAF()

    announce('second message')
    flushRAF()

    const regions = document.querySelectorAll('[aria-live]')
    expect(regions.length).toBe(1)
  })

  it('sets text content after requestAnimationFrame', () => {
    announce('hello screen reader')

    const region = document.querySelector('[aria-live]') as HTMLElement
    // Before RAF flush, text is cleared
    expect(region.textContent).toBe('')

    flushRAF()
    expect(region.textContent).toBe('hello screen reader')
  })
})

describe('setMessages() / getMessages()', () => {
  afterEach(() => {
    resetMessages()
  })

  it('default messages are correct', () => {
    const msgs = getMessages()
    expect(msgs.instructions).toContain('Press Space or Enter to pick up')
    expect(msgs.dragPickedUp).toBe('Picked up')
    expect(msgs.dragDropped).toBe('Dropped')
    expect(typeof msgs.pickedUp).toBe('function')
    expect(typeof msgs.movedTo).toBe('function')
    expect(typeof msgs.dropped).toBe('function')
  })

  it('setMessages() overrides specific messages', () => {
    setMessages({ dragPickedUp: 'Aufgenommen' })
    expect(getMessages().dragPickedUp).toBe('Aufgenommen')
  })

  it('setMessages() preserves non-overridden messages', () => {
    const originalInstructions = getMessages().instructions
    setMessages({ dragPickedUp: 'Custom' })
    expect(getMessages().instructions).toBe(originalInstructions)
    expect(getMessages().dragDropped).toBe('Dropped')
  })

  it('getMessages() returns current messages', () => {
    setMessages({ dragDropped: 'Abgelegt' })
    const msgs = getMessages()
    expect(msgs.dragDropped).toBe('Abgelegt')
  })

  it('function messages (pickedUp) interpolate correctly', () => {
    const msgs = getMessages()
    expect(msgs.pickedUp('Item A', 2, 5)).toBe('Picked up Item A, position 2 of 5')
  })

  it('function messages (movedTo) interpolate correctly', () => {
    const msgs = getMessages()
    expect(msgs.movedTo(3, 5)).toBe('Moved to position 3 of 5')
  })

  it('function messages (dropped) interpolate correctly', () => {
    const msgs = getMessages()
    expect(msgs.dropped('Item B', 1, 4)).toBe('Dropped Item B in position 1 of 4')
  })
})

describe('Draggable ARIA', () => {
  let el: HTMLElement
  let instance: Draggable

  beforeEach(() => {
    el = createMockElement()
  })

  afterEach(() => {
    instance?.destroy()
    resetRAF()
    resetMessages()
  })

  it('sets tabindex="0" on element', () => {
    instance = new Draggable(el)
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('sets role="button"', () => {
    instance = new Draggable(el)
    expect(el.getAttribute('role')).toBe('button')
  })

  it('sets aria-roledescription="draggable"', () => {
    instance = new Draggable(el)
    expect(el.getAttribute('aria-roledescription')).toBe('draggable')
  })

  it('sets aria-describedby pointing to instructions element', () => {
    instance = new Draggable(el)
    const describedBy = el.getAttribute('aria-describedby')
    expect(describedBy).toBe('hyperact-instructions')

    const instructionsEl = document.getElementById('hyperact-instructions')
    expect(instructionsEl).not.toBeNull()
  })

  it('instructions element exists and has correct text', () => {
    instance = new Draggable(el)
    const instructionsEl = document.getElementById('hyperact-instructions')
    expect(instructionsEl).not.toBeNull()
    expect(instructionsEl!.textContent).toContain('Press Space or Enter to pick up')
  })

  it('sets aria-grabbed="true" on drag start', () => {
    instance = new Draggable(el)

    firePointerDown(el, { clientX: 50, clientY: 50 })
    firePointerMove(document, { clientX: 60, clientY: 50 })
    flushRAF()

    expect(el.getAttribute('aria-grabbed')).toBe('true')
  })

  it('sets aria-grabbed="false" on drag end', () => {
    instance = new Draggable(el)

    firePointerDown(el, { clientX: 50, clientY: 50 })
    firePointerMove(document, { clientX: 60, clientY: 50 })
    flushRAF()
    firePointerUp(document, { clientX: 60, clientY: 50 })

    expect(el.getAttribute('aria-grabbed')).toBe('false')
  })

  it('removes ARIA attrs on destroy', () => {
    instance = new Draggable(el)
    expect(el.getAttribute('aria-roledescription')).toBe('draggable')

    instance.destroy()
    expect(el.getAttribute('aria-roledescription')).toBeNull()
    expect(el.getAttribute('aria-grabbed')).toBeNull()
    expect(el.getAttribute('aria-describedby')).toBeNull()
  })

  it('aria: false skips all ARIA setup', () => {
    instance = new Draggable(el, { aria: false })
    expect(el.getAttribute('aria-roledescription')).toBeNull()
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('aria-describedby')).toBeNull()
  })
})

describe('Sortable ARIA', () => {
  let container: HTMLElement
  let items: HTMLElement[]
  let instance: Sortable

  function createSortableContainer(itemCount = 3): { container: HTMLElement; items: HTMLElement[] } {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const items: HTMLElement[] = []

    for (let i = 0; i < itemCount; i++) {
      const item = document.createElement('div')
      item.textContent = `Item ${i + 1}`
      item.style.height = '50px'
      item.style.width = '200px'

      const top = i * 50
      const rect: DOMRect = {
        x: 0, y: top, width: 200, height: 50,
        top, right: 200, bottom: top + 50, left: 0,
        toJSON() { return this },
      } as DOMRect
      item.getBoundingClientRect = vi.fn().mockReturnValue(rect)

      container.appendChild(item)
      items.push(item)
    }

    container.getBoundingClientRect = vi.fn().mockReturnValue({
      x: 0, y: 0, width: 200, height: itemCount * 50,
      top: 0, right: 200, bottom: itemCount * 50, left: 0,
      toJSON() { return this },
    } as DOMRect)

    return { container, items }
  }

  beforeEach(() => {
    const result = createSortableContainer()
    container = result.container
    items = result.items
  })

  afterEach(() => {
    instance?.destroy()
    container?.remove()
    resetRAF()
    resetMessages()
  })

  it('container gets role="listbox"', () => {
    instance = new Sortable(container)
    expect(container.getAttribute('role')).toBe('listbox')
  })

  it('each item gets role="option"', () => {
    instance = new Sortable(container)
    for (const item of items) {
      expect(item.getAttribute('role')).toBe('option')
    }
  })

  it('each item gets aria-roledescription="sortable"', () => {
    instance = new Sortable(container)
    for (const item of items) {
      expect(item.getAttribute('aria-roledescription')).toBe('sortable')
    }
  })

  it('each item gets correct aria-posinset and aria-setsize', () => {
    instance = new Sortable(container)
    for (let i = 0; i < items.length; i++) {
      expect(items[i].getAttribute('aria-posinset')).toBe(String(i + 1))
      expect(items[i].getAttribute('aria-setsize')).toBe(String(items.length))
    }
  })

  it('items set aria-grabbed="true" on drag start', () => {
    instance = new Sortable(container)

    firePointerDown(items[0], { clientX: 100, clientY: 25 })
    firePointerMove(document, { clientX: 100, clientY: 35 })
    flushRAF()

    expect(items[0].getAttribute('aria-grabbed')).toBe('true')
  })

  it('items set aria-grabbed="false" on drag end', () => {
    instance = new Sortable(container)

    firePointerDown(items[0], { clientX: 100, clientY: 25 })
    firePointerMove(document, { clientX: 100, clientY: 35 })
    flushRAF()
    firePointerUp(document, { clientX: 100, clientY: 35 })

    expect(items[0].getAttribute('aria-grabbed')).toBe('false')
  })

  it('after reorder, aria-posinset updates to new positions', () => {
    instance = new Sortable(container)

    // Drag first item down past the second item
    firePointerDown(items[0], { clientX: 100, clientY: 25 })
    // Move past threshold
    firePointerMove(document, { clientX: 100, clientY: 35 })
    flushRAF()
    // Move further to trigger reorder
    firePointerMove(document, { clientX: 100, clientY: 80 })
    flushRAF()
    firePointerUp(document, { clientX: 100, clientY: 80 })

    // After reorder and setup, items should have updated posinset values
    const currentItems = instance.getItems()
    for (let i = 0; i < currentItems.length; i++) {
      expect(currentItems[i].getAttribute('aria-posinset')).toBe(String(i + 1))
      expect(currentItems[i].getAttribute('aria-setsize')).toBe(String(currentItems.length))
    }
  })

  it('aria: false skips all ARIA setup', () => {
    instance = new Sortable(container, { aria: false })

    expect(container.getAttribute('role')).toBeNull()
    for (const item of items) {
      expect(item.getAttribute('role')).toBeNull()
      expect(item.getAttribute('aria-roledescription')).toBeNull()
      expect(item.getAttribute('aria-posinset')).toBeNull()
      expect(item.getAttribute('aria-setsize')).toBeNull()
    }
  })

  it('cleans up on destroy', () => {
    instance = new Sortable(container)

    // Verify attrs are set
    expect(container.getAttribute('role')).toBe('listbox')
    expect(items[0].getAttribute('aria-roledescription')).toBe('sortable')

    instance.destroy()

    expect(container.getAttribute('role')).toBeNull()
    for (const item of items) {
      expect(item.getAttribute('aria-roledescription')).toBeNull()
      expect(item.getAttribute('aria-grabbed')).toBeNull()
      expect(item.getAttribute('aria-describedby')).toBeNull()
      expect(item.getAttribute('aria-posinset')).toBeNull()
      expect(item.getAttribute('aria-setsize')).toBeNull()
    }
  })
})

describe('Dropzone ARIA', () => {
  let el: HTMLElement
  let instance: Dropzone

  beforeEach(() => {
    el = createMockElement()
  })

  afterEach(() => {
    instance?.destroy()
    resetRAF()
  })

  it('sets aria-dropeffect="move" on construction', () => {
    instance = new Dropzone(el)
    expect(el.getAttribute('aria-dropeffect')).toBe('move')
  })

  it('changes to aria-dropeffect="move" on activate', () => {
    instance = new Dropzone(el)
    const draggableEl = createMockElement()

    instance.activate(draggableEl)

    expect(el.getAttribute('aria-dropeffect')).toBe('move')
  })

  it('changes to aria-dropeffect="none" on deactivate', () => {
    instance = new Dropzone(el)
    const draggableEl = createMockElement()

    // Activate first, then deactivate
    instance.activate(draggableEl)
    instance.deactivate(draggableEl)

    expect(el.getAttribute('aria-dropeffect')).toBe('none')
  })

  it('removes aria-dropeffect on destroy', () => {
    instance = new Dropzone(el)
    expect(el.getAttribute('aria-dropeffect')).toBe('move')

    instance.destroy()
    expect(el.getAttribute('aria-dropeffect')).toBeNull()
  })

  it('aria: false skips all ARIA setup', () => {
    instance = new Dropzone(el, { aria: false })
    expect(el.getAttribute('aria-dropeffect')).toBeNull()
  })
})
