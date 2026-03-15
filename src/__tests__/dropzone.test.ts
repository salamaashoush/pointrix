import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Dropzone, DropzoneManager } from '../dropzone'
import { createMockElement } from './helpers'

describe('Dropzone', () => {
  let dropEl: HTMLElement
  let dragEl: HTMLElement

  beforeEach(() => {
    dropEl = createMockElement({ x: 0, y: 0, width: 200, height: 200, top: 0, left: 0, right: 200, bottom: 200 })
    dragEl = createMockElement({ x: 50, y: 50, width: 50, height: 50, top: 50, left: 50, right: 100, bottom: 100 })
  })

  afterEach(() => {
    dropEl.remove()
    dragEl.remove()
  })

  describe('registration', () => {
    it('registers with DropzoneManager on creation', () => {
      const zone = new Dropzone(dropEl)
      // Activate via manager to confirm registration
      DropzoneManager.onDragStart(dragEl)
      const active = DropzoneManager.getActiveZones()
      expect(active).toContain(zone)
      zone.destroy()
    })
  })

  describe('accept filtering', () => {
    it('accepts all elements when no accept option', () => {
      const zone = new Dropzone(dropEl)
      expect(zone.accepts(dragEl)).toBe(true)
      zone.destroy()
    })

    it('filters by CSS selector string', () => {
      dragEl.classList.add('draggable-item')
      const zone = new Dropzone(dropEl, { accept: '.draggable-item' })
      expect(zone.accepts(dragEl)).toBe(true)

      const otherEl = createMockElement()
      expect(zone.accepts(otherEl)).toBe(false)

      zone.destroy()
      otherEl.remove()
    })

    it('filters by function predicate', () => {
      const accept = vi.fn((el: HTMLElement) => el.dataset.type === 'allowed')
      dragEl.dataset.type = 'allowed'
      const zone = new Dropzone(dropEl, { accept })

      expect(zone.accepts(dragEl)).toBe(true)
      expect(accept).toHaveBeenCalledWith(dragEl)

      const otherEl = createMockElement()
      otherEl.dataset.type = 'denied'
      expect(zone.accepts(otherEl)).toBe(false)

      zone.destroy()
      otherEl.remove()
    })
  })

  describe('overlap modes', () => {
    it('pointer mode: returns 1 when pointer is inside dropzone', () => {
      const zone = new Dropzone(dropEl, { overlap: 'pointer' })
      expect(zone.checkOverlap(dragEl, { x: 100, y: 100 })).toBe(1)
      expect(zone.checkOverlap(dragEl, { x: 300, y: 300 })).toBe(0)
      zone.destroy()
    })

    it('center mode: returns 1 when draggable center is inside dropzone', () => {
      const zone = new Dropzone(dropEl, { overlap: 'center' })
      // dragEl center is (75, 75) which is inside dropzone (0-200)
      expect(zone.checkOverlap(dragEl, { x: 0, y: 0 })).toBe(1)
      zone.destroy()
    })

    it('numeric threshold: returns overlap ratio when above threshold', () => {
      const zone = new Dropzone(dropEl, { overlap: 0.5 })
      // dragEl is 50x50 fully inside dropzone 200x200 — ratio = 1.0
      const overlap = zone.checkOverlap(dragEl, { x: 0, y: 0 })
      expect(overlap).toBeGreaterThanOrEqual(0.5)
      zone.destroy()
    })
  })

  describe('enter/leave transitions', () => {
    it('fires onDragEnter on first overlap and onDragLeave when overlap stops', () => {
      const onDragEnter = vi.fn()
      const onDragLeave = vi.fn()
      const zone = new Dropzone(dropEl, { onDragEnter, onDragLeave })

      zone.activate(dragEl)
      zone.enter(dragEl, 1)
      expect(onDragEnter).toHaveBeenCalledTimes(1)
      expect(onDragEnter.mock.calls[0][0].draggable).toBe(dragEl)

      zone.leave(dragEl)
      expect(onDragLeave).toHaveBeenCalledTimes(1)

      zone.destroy()
    })

    it('does not fire enter twice without a leave in between', () => {
      const onDragEnter = vi.fn()
      const zone = new Dropzone(dropEl, { onDragEnter })

      zone.activate(dragEl)
      zone.enter(dragEl, 1)
      zone.enter(dragEl, 1)
      expect(onDragEnter).toHaveBeenCalledTimes(1)

      zone.destroy()
    })
  })

  describe('drop event', () => {
    it('fires onDrop when drop is called', () => {
      const onDrop = vi.fn()
      const zone = new Dropzone(dropEl, { onDrop })

      zone.activate(dragEl)
      zone.enter(dragEl, 1)
      zone.drop(dragEl, 1)
      expect(onDrop).toHaveBeenCalledTimes(1)
      expect(onDrop.mock.calls[0][0].target).toBe(dropEl)
      expect(onDrop.mock.calls[0][0].draggable).toBe(dragEl)

      zone.destroy()
    })

    it('DropzoneManager fires drop on drag end while overlapping', () => {
      const onDrop = vi.fn()
      const zone = new Dropzone(dropEl, { onDrop })

      DropzoneManager.onDragStart(dragEl)
      // Simulate entering
      zone.enter(dragEl, 1)

      // End drag while overlapping
      DropzoneManager.onDragEnd(dragEl, { x: 100, y: 100 })
      expect(onDrop).toHaveBeenCalledTimes(1)

      zone.destroy()
    })
  })

  describe('active/hover classes', () => {
    it('adds activeClass on activate and removes on deactivate', () => {
      const zone = new Dropzone(dropEl, { activeClass: 'drop-active' })

      zone.activate(dragEl)
      expect(dropEl.classList.contains('drop-active')).toBe(true)

      zone.deactivate(dragEl)
      expect(dropEl.classList.contains('drop-active')).toBe(false)

      zone.destroy()
    })

    it('adds hoverClass on enter and removes on leave', () => {
      const zone = new Dropzone(dropEl, { hoverClass: 'drop-hover' })

      zone.activate(dragEl)
      zone.enter(dragEl, 1)
      expect(dropEl.classList.contains('drop-hover')).toBe(true)

      zone.leave(dragEl)
      expect(dropEl.classList.contains('drop-hover')).toBe(false)

      zone.destroy()
    })
  })

  describe('destroy', () => {
    it('unregisters from DropzoneManager and cleans up classes', () => {
      const zone = new Dropzone(dropEl, { activeClass: 'active', hoverClass: 'hover' })

      zone.activate(dragEl)
      zone.enter(dragEl, 1)

      zone.destroy()

      expect(dropEl.classList.contains('active')).toBe(false)
      expect(dropEl.classList.contains('hover')).toBe(false)

      // After destroy, manager should not activate this zone
      DropzoneManager.onDragStart(dragEl)
      expect(zone.isActive).toBe(false)
    })
  })
})
