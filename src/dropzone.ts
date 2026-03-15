// Dropzone system for drag-and-drop interactions

import type { DragEvent } from './drag'

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
    Math.min(draggableRect.right, dropzoneRect.right) - Math.max(draggableRect.left, dropzoneRect.left)
  )
  const overlapY = Math.max(
    0,
    Math.min(draggableRect.bottom, dropzoneRect.bottom) - Math.max(draggableRect.top, dropzoneRect.top)
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
  private listeners = new Map<string, Set<Function>>()

  on(event: string, handler: Function): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  }

  off(event: string, handler: Function): this {
    this.listeners.get(event)?.delete(handler)
    return this
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) handler(data)
    }
  }

  get enabled(): boolean { return this._enabled }
  set enabled(value: boolean) { this._enabled = value }

  constructor(element: HTMLElement, options: DropzoneOptions = {}) {
    this.element = element
    this.options = { overlap: 'pointer', ...options }
    DropzoneManager.register(this)
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

  checkOverlap(draggableEl: HTMLElement, pointerPos: Point): number {
    const dropRect = this.element.getBoundingClientRect()
    const mode = this.options.overlap ?? 'pointer'

    if (mode === 'pointer') {
      return rectContainsPoint(dropRect, pointerPos) ? 1 : 0
    }

    const dragRect = draggableEl.getBoundingClientRect()

    if (mode === 'center') {
      const center: Point = {
        x: dragRect.left + dragRect.width / 2,
        y: dragRect.top + dragRect.height / 2,
      }
      return rectContainsPoint(dropRect, center) ? 1 : 0
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

    const activateEvent = this.createEvent(draggableEl, 0)
    this.options.onActivate?.(activateEvent)
    this.emit('activate', activateEvent)
  }

  deactivate(draggableEl: HTMLElement) {
    if (!this._isActive) return

    // If still hovered, fire leave first
    if (this._isOver) {
      this.leave(draggableEl)
    }

    this._isActive = false

    if (this.options.activeClass) {
      this.element.classList.remove(this.options.activeClass)
    }

    const deactivateEvent = this.createEvent(draggableEl, 0)
    this.options.onDeactivate?.(deactivateEvent)
    this.emit('deactivate', deactivateEvent)
  }

  enter(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent) {
    if (this._isOver) return
    this._isOver = true

    if (this.options.hoverClass) {
      this.element.classList.add(this.options.hoverClass)
    }

    const enterEvent = this.createEvent(draggableEl, overlap, dragEvent)
    this.options.onDragEnter?.(enterEvent)
    this.emit('dragenter', enterEvent)
  }

  leave(draggableEl: HTMLElement, dragEvent?: DragEvent) {
    if (!this._isOver) return
    this._isOver = false

    if (this.options.hoverClass) {
      this.element.classList.remove(this.options.hoverClass)
    }

    const leaveEvent = this.createEvent(draggableEl, 0, dragEvent)
    this.options.onDragLeave?.(leaveEvent)
    this.emit('dragleave', leaveEvent)
  }

  over(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent) {
    const overEvent = this.createEvent(draggableEl, overlap, dragEvent)
    this.options.onDragOver?.(overEvent)
    this.emit('dragover', overEvent)
  }

  drop(draggableEl: HTMLElement, overlap: number, dragEvent?: DragEvent) {
    const dropEvent = this.createEvent(draggableEl, overlap, dragEvent)
    this.options.onDrop?.(dropEvent)
    this.emit('drop', dropEvent)
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

    DropzoneManager.unregister(this)
  }
}

class DropzoneManagerSingleton {
  private zones = new Set<Dropzone>()

  register(zone: Dropzone) {
    this.zones.add(zone)
  }

  unregister(zone: Dropzone) {
    this.zones.delete(zone)
  }

  onDragStart(draggableEl: HTMLElement) {
    for (const zone of this.zones) {
      if (zone.accepts(draggableEl)) {
        zone.activate(draggableEl)
      }
    }
  }

  onDragMove(draggableEl: HTMLElement, pointerPos: Point, dragEvent?: DragEvent) {
    for (const zone of this.zones) {
      if (!zone.isActive) continue

      const overlap = zone.checkOverlap(draggableEl, pointerPos)

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

  onDragEnd(draggableEl: HTMLElement, pointerPos: Point, dragEvent?: DragEvent) {
    for (const zone of this.zones) {
      if (!zone.isActive) continue

      if (zone.isOver) {
        const overlap = zone.checkOverlap(draggableEl, pointerPos)
        zone.drop(draggableEl, overlap > 0 ? overlap : 1, dragEvent)
      }

      zone.deactivate(draggableEl)
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
