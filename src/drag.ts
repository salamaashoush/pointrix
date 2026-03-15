// Optimized drag addon for hyperact-nano (~2KB minified)

import { Hyperact, InteractionEvent, HyperactOptions } from './nano'
import type { Modifier, ModifierContext } from './types'
import { applyModifiers } from './types'
import { DropzoneManager } from './dropzone'

export interface DragOptions extends HyperactOptions {
  axis?: 'x' | 'y' | 'xy' | 'start'
  startAxis?: 'x' | 'y'
  handle?: string | HTMLElement
  bounds?: 'parent' | HTMLElement | { left?: number; top?: number; right?: number; bottom?: number }
  grid?: { x: number; y: number }
  momentum?: boolean | { friction?: number; minSpeed?: number }
  modifiers?: Modifier[]
  droppable?: boolean
  cursorChecker?: (action: 'idle' | 'grab' | 'grabbing') => string
  onDragStart?: (event: DragEvent) => void
  onDragMove?: (event: DragEvent) => void
  onDragEnd?: (event: DragEvent) => void
}

export interface DragEvent extends InteractionEvent {
  dx: number
  dy: number
  totalX: number
  totalY: number
  velocityX: number
  velocityY: number
}

export class Draggable extends Hyperact {
  private dragOptions: DragOptions
  private transform = { x: 0, y: 0 }
  private startTransform = { x: 0, y: 0 }
  private bounds: DOMRect | null = null
  private momentum: { vx: number; vy: number; active: boolean } = { vx: 0, vy: 0, active: false }
  private transformNormalized = false
  private detectedAxis: 'x' | 'y' | null = null
  private startAxisConfirmed = false

  constructor(element: HTMLElement, options: DragOptions = {}) {
    super(element, {
      ...options,
      onStart: (e) => {
        this.handleDragStart(e)
        options.onStart?.(e)
      },
      onMove: (e) => {
        this.handleDragMove(e)
        options.onMove?.(e)
      },
      onEnd: (e) => {
        this.handleDragEnd(e)
        options.onEnd?.(e)
      },
    })

    this.dragOptions = options

    // Set lower priority for drag interactions (resize has priority 10)
    this.priority = 5

    // Set cursor
    if (options.styleCursor !== false) {
      element.style.cursor = options.cursorChecker ? options.cursorChecker('idle') : 'grab'
    }
  }

  protected shouldHandleEvent(e: PointerEvent): boolean {
    if (!this.dragOptions.handle) return true

    let handleEl: Element | null = null
    if (typeof this.dragOptions.handle === 'string') {
      handleEl = this.element.querySelector(this.dragOptions.handle)
    } else {
      handleEl = this.dragOptions.handle
    }

    if (!handleEl) return false
    return handleEl.contains(e.target as Node)
  }

  private readCurrentTransform(element: HTMLElement) {
    const style = window.getComputedStyle(element)
    const matrix = style.transform

    if (matrix && matrix !== 'none') {
      const values = matrix.match(/matrix.*\((.+)\)/)
      if (values) {
        const parts = values[1].split(', ')
        this.transform.x = parseFloat(parts[4]) || 0
        this.transform.y = parseFloat(parts[5]) || 0
      }
    } else if (!this.transformNormalized) {
      // First time with no existing transform — start at 0,0
      this.transform.x = 0
      this.transform.y = 0
    }

    if (!this.transformNormalized) {
      // Normalize to inline translate3d on first read
      element.style.transform = `translate3d(${this.transform.x}px, ${this.transform.y}px, 0)`
      this.transformNormalized = true
    }
  }

  private handleDragStart(e: InteractionEvent) {
    const element = e.target

    // Reset axis detection state
    this.detectedAxis = null
    this.startAxisConfirmed = false

    // Always re-read the current transform from the DOM to sync with
    // any external changes (e.g. Resizable modifying the transform)
    this.readCurrentTransform(element)

    if (this.dragOptions.styleCursor !== false) {
      element.style.cursor = this.dragOptions.cursorChecker ? this.dragOptions.cursorChecker('grabbing') : 'grabbing'
    }
    element.style.willChange = 'transform'

    // Store start transform
    this.startTransform = { ...this.transform }

    // Calculate bounds if needed
    // Bounds are in transform-space: what values of this.transform.{x,y} keep
    // the element within the bounding region. The formula for any region is:
    //   minX = region.left  - rect.left  + startTransform.x
    //   maxX = region.right - rect.right + startTransform.x
    // This accounts for the element's actual offset within the parent.
    if (this.dragOptions.bounds) {
      const rect = element.getBoundingClientRect()
      const tx = this.startTransform.x
      const ty = this.startTransform.y

      let region: { left: number; top: number; right: number; bottom: number }

      if (this.dragOptions.bounds === 'parent') {
        const parent = element.offsetParent || document.body
        const pr = parent.getBoundingClientRect()
        region = { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom }
      } else if (this.dragOptions.bounds instanceof HTMLElement) {
        const br = this.dragOptions.bounds.getBoundingClientRect()
        region = { left: br.left, top: br.top, right: br.right, bottom: br.bottom }
      } else {
        const b = this.dragOptions.bounds
        region = {
          left: b.left ?? -Infinity,
          top: b.top ?? -Infinity,
          right: b.right ?? Infinity,
          bottom: b.bottom ?? Infinity,
        }
      }

      const minX = region.left - rect.left + tx
      const minY = region.top - rect.top + ty
      const maxX = region.right - rect.right + tx
      const maxY = region.bottom - rect.bottom + ty

      // Store as DOMRect: left=minX, top=minY, right=maxX, bottom=maxY
      // DOMRect(x, y, width, height) → right = x + width, bottom = y + height
      this.bounds = new DOMRect(minX, minY, maxX - minX, maxY - minY)
    }

    // Stop momentum if active
    this.momentum.active = false

    // Call modifier onStart hooks
    if (this.dragOptions.modifiers?.length) {
      const startRect = e.target.getBoundingClientRect()
      const ctx: ModifierContext = {
        position: { ...this.startTransform },
        velocity: { x: 0, y: 0 },
        element: e.target,
        startPosition: { ...this.startTransform },
        delta: { x: 0, y: 0 },
        size: { width: startRect.width, height: startRect.height },
      }
      for (const mod of this.dragOptions.modifiers) {
        mod.onStart?.(ctx)
      }
    }

    // Fire drag start event
    const dragStartEvent = this.createDragEvent(e, 0, 0)
    if (this.dragOptions.onDragStart) {
      this.dragOptions.onDragStart(dragStartEvent)
    }
    this.emit('dragstart', dragStartEvent)

    if (this.dragOptions.droppable) {
      DropzoneManager.onDragStart(e.target)
    }
  }

  private handleDragMove(e: InteractionEvent) {
    const pointer = e.pointers[0]
    let dx = pointer.total.x
    let dy = pointer.total.y

    // Check startAxis constraint
    if (this.dragOptions.startAxis && !this.startAxisConfirmed) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (this.dragOptions.startAxis === 'x' && absY > absX) return
      if (this.dragOptions.startAxis === 'y' && absX > absY) return
      this.startAxisConfirmed = true
    }

    // Auto-detect axis from initial movement direction
    if (this.dragOptions.axis === 'start' && this.detectedAxis === null) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX > 0 || absY > 0) {
        this.detectedAxis = absX > absY ? 'x' : 'y'
      }
    }

    // Apply axis constraints
    const effectiveAxis = this.dragOptions.axis === 'start' ? this.detectedAxis : this.dragOptions.axis
    if (effectiveAxis === 'x') dy = 0
    else if (effectiveAxis === 'y') dx = 0

    // Calculate new position
    let x = this.startTransform.x + dx
    let y = this.startTransform.y + dy

    // Apply grid snapping
    if (this.dragOptions.grid) {
      x = Math.round(x / this.dragOptions.grid.x) * this.dragOptions.grid.x
      y = Math.round(y / this.dragOptions.grid.y) * this.dragOptions.grid.y
    }

    // Apply bounds
    if (this.bounds) {
      x = Math.max(this.bounds.left, Math.min(x, this.bounds.right))
      y = Math.max(this.bounds.top, Math.min(y, this.bounds.bottom))
    }

    // Apply modifiers (run after inline bounds/grid logic)
    if (this.dragOptions.modifiers?.length) {
      const rect = e.target.getBoundingClientRect()
      const result = applyModifiers(this.dragOptions.modifiers, {
        position: { x, y },
        velocity: pointer.velocity,
        element: e.target,
        startPosition: { ...this.startTransform },
        delta: { x: pointer.delta.x, y: pointer.delta.y },
        size: { width: rect.width, height: rect.height },
      })
      x = result.position.x
      y = result.position.y
    }

    // Update transform
    this.transform = { x, y }
    this.applyTransform(e.target)

    // Store velocity for momentum
    if (this.dragOptions.momentum) {
      this.momentum.vx = pointer.velocity.x
      this.momentum.vy = pointer.velocity.y
    }

    // Fire drag move event
    const dragMoveEvent = this.createDragEvent(e, dx, dy)
    if (this.dragOptions.onDragMove) {
      this.dragOptions.onDragMove(dragMoveEvent)
    }
    this.emit('dragmove', dragMoveEvent)

    if (this.dragOptions.droppable) {
      const pointer = e.pointers[0]
      DropzoneManager.onDragMove(e.target, pointer.current, this.createDragEvent(e, dx, dy))
    }
  }

  private handleDragEnd(e: InteractionEvent) {
    const element = e.target
    if (this.dragOptions.styleCursor !== false) {
      element.style.cursor = this.dragOptions.cursorChecker ? this.dragOptions.cursorChecker('grab') : 'grab'
    }

    // Calculate final drag distance
    const dx = this.transform.x - this.startTransform.x
    const dy = this.transform.y - this.startTransform.y

    // Start momentum animation if enabled
    if (this.dragOptions.momentum && (Math.abs(this.momentum.vx) > 10 || Math.abs(this.momentum.vy) > 10)) {
      this.startMomentum()
    } else {
      element.style.willChange = ''
    }

    // Call modifier onEnd hooks
    if (this.dragOptions.modifiers?.length) {
      const pointer = e.pointers[0]
      const ctx: ModifierContext = {
        position: { ...this.transform },
        velocity: pointer?.velocity ?? { x: 0, y: 0 },
        element: e.target,
        startPosition: { ...this.startTransform },
        delta: { x: dx, y: dy },
      }
      for (const mod of this.dragOptions.modifiers) {
        mod.onEnd?.(ctx)
      }
    }

    if (this.dragOptions.droppable) {
      const pointer = e.pointers[0]
      const pos = pointer?.current ?? { x: 0, y: 0 }
      DropzoneManager.onDragEnd(e.target, pos, this.createDragEvent(e, dx, dy))
    }

    // Fire drag end event
    const dragEndEvent = this.createDragEvent(e, dx, dy)
    if (this.dragOptions.onDragEnd) {
      this.dragOptions.onDragEnd(dragEndEvent)
    }
    this.emit('dragend', dragEndEvent)
  }

  private startMomentum() {
    this.momentum.active = true
    const friction = typeof this.dragOptions.momentum === 'object' ? this.dragOptions.momentum.friction || 0.95 : 0.95
    const minSpeed = typeof this.dragOptions.momentum === 'object' ? this.dragOptions.momentum.minSpeed || 0.1 : 0.1

    const animate = () => {
      if (!this.momentum.active) return

      // Apply friction
      this.momentum.vx *= friction
      this.momentum.vy *= friction

      // Stop if too slow
      if (Math.abs(this.momentum.vx) < minSpeed && Math.abs(this.momentum.vy) < minSpeed) {
        this.momentum.active = false
        this.element.style.willChange = ''
        return
      }

      // Update position
      this.transform.x += this.momentum.vx * 0.016 // 60fps
      this.transform.y += this.momentum.vy * 0.016

      // Apply bounds
      if (this.bounds) {
        if (this.transform.x < this.bounds.left || this.transform.x > this.bounds.right) {
          this.momentum.vx *= -0.5 // Bounce
          this.transform.x = Math.max(this.bounds.left, Math.min(this.transform.x, this.bounds.right))
        }

        if (this.transform.y < this.bounds.top || this.transform.y > this.bounds.bottom) {
          this.momentum.vy *= -0.5 // Bounce
          this.transform.y = Math.max(this.bounds.top, Math.min(this.transform.y, this.bounds.bottom))
        }
      }

      this.applyTransform(this.element)
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  private applyTransform(element: HTMLElement) {
    element.style.transform = `translate3d(${this.transform.x}px, ${this.transform.y}px, 0)`
  }

  private createDragEvent(e: InteractionEvent, dx: number, dy: number): DragEvent {
    const pointer = e.pointers[0]
    return {
      ...e,
      dx: pointer?.delta.x || 0,
      dy: pointer?.delta.y || 0,
      totalX: dx,
      totalY: dy,
      velocityX: pointer?.velocity.x || 0,
      velocityY: pointer?.velocity.y || 0,
    }
  }

  setPosition(x: number, y: number) {
    this.transform = { x, y }
    this.applyTransform(this.element)
  }

  getPosition() {
    return { ...this.transform }
  }

  destroy() {
    super.destroy()
    this.element.style.cursor = ''
    this.element.style.willChange = ''
    this.momentum.active = false
  }
}

// Factory function
export function draggable(element: HTMLElement | string, options?: DragOptions): Draggable {
  const el = typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element

  if (!el) throw new Error(`Element not found: ${element}`)

  return new Draggable(el, options)
}

export default draggable
