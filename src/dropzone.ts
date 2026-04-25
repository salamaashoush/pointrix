// Dropzone system for drag-and-drop interactions

import type { DragEvent } from './drag'
import { setDropzoneAttrs, setDropzoneActiveAttrs, clearDropzoneAttrs } from './aria'

export interface DropEvent {
  target: HTMLElement
  draggable: HTMLElement
  dragEvent?: DragEvent
  overlap: number
}

export interface DropzoneOptions {
  accept?: string | ((draggable: HTMLElement) => boolean)
  overlap?: 'pointer' | 'center' | number
  activeClass?: string
  hoverClass?: string
  /** Enable ARIA attributes (default: true) */
  aria?: boolean
  /**
   * Custom geometry resolver — replaces `getBoundingClientRect()` for the
   * zone's own element. Pair with a draggable's own rectChecker to drive
   * the full drag/drop cycle off custom geometry (SVG, canvas, virtualized).
   */
  rectChecker?: (element: HTMLElement) => DOMRect
  onActivate?: (event: DropEvent) => void
  onDeactivate?: (event: DropEvent) => void
  onDragEnter?: (event: DropEvent) => void
  onDragLeave?: (event: DropEvent) => void
  onDragOver?: (event: DropEvent) => void
  onDrop?: (event: DropEvent) => void
}

interface Point {
  x: number
  y: number
}

function rectContainsPoint(rect: DOMRect, point: Point): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

function computeOverlapRatio(draggableRect: DOMRect, dropzoneRect: DOMRect): number {
  const overlapX = Math.max(
    0,
    Math.min(draggableRect.right, dropzoneRect.right) - Math.max(draggableRect.left, dropzoneRect.left),
  )
  const overlapY = Math.max(
    0,
    Math.min(draggableRect.bottom, dropzoneRect.bottom) - Math.max(draggableRect.top, dropzoneRect.top),
  )
  const overlapArea = overlapX * overlapY
  const draggableArea = draggableRect.width * draggableRect.height

  return draggableArea > 0 ? overlapArea / draggableArea : 0
}

export class Dropzone {
  readonly element: HTMLElement
  private options: DropzoneOptions
  private _isOver = false
  private _isActive = false
  private _enabled = true
  /**
   * Cached dropzone rect while a drag is active. getBoundingClientRect is a
   * forced-sync-layout operation; with N zones it dominates drag-frame cost.
   * The manager refreshes this at drag-start and when the page scrolls/resizes.
   */
  private _cachedRect: DOMRect | null = null

  get enabled(): boolean {
    return this._enabled
  }
  set enabled(value: boolean) {
    this._enabled = value
  }

  constructor(element: HTMLElement, options: DropzoneOptions = {}) {
    this.element = element
    this.options = { overlap: 'pointer', aria: true, ...options }
    DropzoneManager.register(this)
    if (this.options.aria !== false) {
      setDropzoneAttrs(element)
    }
  }

  get isOver(): boolean {
    return this._isOver
  }

  get isActive(): boolean {
    return this._isActive
  }

  accepts(draggableEl: HTMLElement): boolean {
    if (!this._enabled) return false
    const { accept } = this.options
    if (!accept) return true
    if (typeof accept === 'function') return accept(draggableEl)
    return draggableEl.matches(accept)
  }

  /** Cache/refresh the rect. Called by DropzoneManager at drag start and on scroll. */
  refreshRect(): void {
    this._cachedRect = this.options.rectChecker
      ? this.options.rectChecker(this.element)
      : this.element.getBoundingClientRect()
  }

  /** Clear the cached rect after a drag ends. */
  clearRect(): void {
    this._cachedRect = null
  }

  /**
   * Compute overlap with a draggable. Uses the cached dropzone rect when set
   * (during drag). Accepts an optional pre-measured draggable rect to avoid
   * duplicate getBoundingClientRect calls when multiple zones need it.
   */
  checkOverlap(draggableEl: HTMLElement, pointerPos: Point, draggableRect?: DOMRect): number {
    const dropRect =
      this._cachedRect ??
      (this.options.rectChecker ? this.options.rectChecker(this.element) : this.element.getBoundingClientRect())
    const mode = this.options.overlap ?? 'pointer'

    if (mode === 'pointer') {
      return rectContainsPoint(dropRect, pointerPos) ? 1 : 0
    }

    // If the caller supplied a rect (Draggable does via its own rectChecker),
    // use it. Otherwise fall back to measuring the draggable directly.
    const dragRect = draggableRect ?? draggableEl.getBoundingClientRect()

    if (mode === 'center') {
      const cx = dragRect.left + dragRect.width / 2
      const cy = dragRect.top + dragRect.height / 2
      return rectContainsPoint(dropRect, { x: cx, y: cy }) ? 1 : 0
    }

    // Numeric threshold mode
    const ratio = computeOverlapRatio(dragRect, dropRect)
    return ratio >= (mode as number) ? ratio : 0
  }

  activate(draggableEl: HTMLElement) {
    if (this._isActive) return
    this._isActive = true

    if (this.options.activeClass) {
      this.element.classList.add(this.options.activeClass)
    }
    if (this.options.aria !== false) {
      setDropzoneActiveAttrs(this.element, true)
    }

    this.options.onActivate?.(this.createEvent(draggableEl, 0))
  }

  deactivate(draggableEl: HTMLElement) {
    if (!this._isActive) return

    if (this._isOver) {
      this.leave(draggableEl)
    }

    this._isActive = false

    if (this.options.activeClass) {
      this.element.classList.remove(this.options.activeClass)
    }
    if (this.options.aria !== false) {
      setDropzoneActiveAttrs(this.element, false)
    }

    this.options.onDeactivate?.(this.createEvent(draggableEl, 0))
  }

  enter(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent) {
    if (this._isOver) return
    this._isOver = true

    if (this.options.hoverClass) {
      this.element.classList.add(this.options.hoverClass)
    }

    this.options.onDragEnter?.(this.createEvent(draggableEl, overlap, dragEvent))
  }

  leave(draggableEl: HTMLElement, dragEvent?: DragEvent) {
    if (!this._isOver) return
    this._isOver = false

    if (this.options.hoverClass) {
      this.element.classList.remove(this.options.hoverClass)
    }

    this.options.onDragLeave?.(this.createEvent(draggableEl, 0, dragEvent))
  }

  over(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent) {
    this.options.onDragOver?.(this.createEvent(draggableEl, overlap, dragEvent))
  }

  drop(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent) {
    this.options.onDrop?.(this.createEvent(draggableEl, overlap, dragEvent))
  }

  private createEvent(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent): DropEvent {
    return {
      target: this.element,
      draggable: draggableEl,
      dragEvent,
      overlap,
    }
  }

  updateOptions(options: Partial<DropzoneOptions>) {
    this.options = { ...this.options, ...options }
  }

  destroy() {
    this._isOver = false
    this._isActive = false

    if (this.options.activeClass) {
      this.element.classList.remove(this.options.activeClass)
    }
    if (this.options.hoverClass) {
      this.element.classList.remove(this.options.hoverClass)
    }

    if (this.options.aria !== false) {
      clearDropzoneAttrs(this.element)
    }

    DropzoneManager.unregister(this)
  }
}

class DropzoneManagerSingleton {
  private zones = new Set<Dropzone>()
  private _activeDragCount = 0
  private _refreshBound = () => this.refreshRects()

  register(zone: Dropzone) {
    this.zones.add(zone)
  }

  unregister(zone: Dropzone) {
    this.zones.delete(zone)
  }

  /** Re-measure every active zone's rect. Called on scroll/resize during a drag. */
  private refreshRects(): void {
    for (const zone of this.zones) {
      if (zone.isActive) zone.refreshRect()
    }
  }

  onDragStart(draggableEl: HTMLElement) {
    for (const zone of this.zones) {
      if (zone.accepts(draggableEl)) {
        zone.activate(draggableEl)
        zone.refreshRect()
      }
    }
    // Start listening for scroll/resize only once per session, even with
    // nested drags (e.g. multi-touch). Use capture + passive for perf.
    if (this._activeDragCount === 0 && typeof window !== 'undefined') {
      window.addEventListener('scroll', this._refreshBound, { passive: true, capture: true })
      window.addEventListener('resize', this._refreshBound, { passive: true })
    }
    this._activeDragCount++
  }

  onDragMove(
    draggableEl: HTMLElement,
    pointerPos: Point,
    dragEvent?: DragEvent,
    /**
     * Optional rect provider for the draggable. Draggables pass this so a
     * `rectChecker` on the draggable side also governs dropzone hit testing.
     */
    getDraggableRect?: () => DOMRect,
  ) {
    // Measure the draggable's rect once for this frame — multiple zones in
    // 'center' or ratio mode would otherwise each call getBoundingClientRect
    // on the same element.
    let dragRect: DOMRect | undefined
    let needsDragRect = false
    for (const zone of this.zones) {
      if (!zone.isActive) continue
      const mode = (zone as unknown as { options: DropzoneOptions }).options.overlap ?? 'pointer'
      if (mode !== 'pointer') {
        needsDragRect = true
        break
      }
    }
    if (needsDragRect) {
      dragRect = getDraggableRect ? getDraggableRect() : draggableEl.getBoundingClientRect()
    }

    for (const zone of this.zones) {
      if (!zone.isActive) continue

      const overlap = zone.checkOverlap(draggableEl, pointerPos, dragRect)

      if (overlap > 0) {
        if (!zone.isOver) {
          zone.enter(draggableEl, overlap, dragEvent)
        }
        zone.over(draggableEl, overlap, dragEvent)
      } else if (zone.isOver) {
        zone.leave(draggableEl, dragEvent)
      }
    }
  }

  onDragEnd(draggableEl: HTMLElement, pointerPos: Point, dragEvent?: DragEvent, getDraggableRect?: () => DOMRect) {
    for (const zone of this.zones) {
      if (!zone.isActive) continue

      if (zone.isOver) {
        const dragRect = getDraggableRect?.()
        const overlap = zone.checkOverlap(draggableEl, pointerPos, dragRect)
        zone.drop(draggableEl, overlap > 0 ? overlap : 1, dragEvent)
      }

      zone.deactivate(draggableEl)
      zone.clearRect()
    }
    if (this._activeDragCount > 0) this._activeDragCount--
    if (this._activeDragCount === 0 && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._refreshBound, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('resize', this._refreshBound)
    }
  }

  getActiveZones(): Dropzone[] {
    const result: Dropzone[] = []
    for (const zone of this.zones) {
      if (zone.isActive) result.push(zone)
    }
    return result
  }

  getHoveredZones(): Dropzone[] {
    const result: Dropzone[] = []
    for (const zone of this.zones) {
      if (zone.isOver) result.push(zone)
    }
    return result
  }
}

export const DropzoneManager = new DropzoneManagerSingleton()

// Factory function
export function dropzone(element: HTMLElement | string, options?: DropzoneOptions): Dropzone {
  const el = typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element

  if (!el) throw new Error(`Element not found: ${element}`)

  return new Dropzone(el, options)
}

export default dropzone
