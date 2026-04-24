// Optimized drag addon for pointrix-nano (~2KB minified)

import { Pointrix, InteractionEvent, PointrixOptions } from './nano'
import type { Modifier, ModifierContext } from './types'
import { applyModifiers, prefersReducedMotion } from './types'
import { DropzoneManager } from './dropzone'
import { setDraggableAttrs, setDraggingAttrs, clearDraggableAttrs, announce, getMessages } from './aria'

export interface DragOptions extends PointrixOptions {
  /** Enable ARIA attributes for accessibility (default: true) */
  aria?: boolean
  /**
   * Axis lock:
   *  - `'xy'` (default): free movement in both axes.
   *  - `'x'` / `'y'`: locked to one axis.
   *  - `'auto'`: lock to whichever axis the user moves first. Determined once
   *    per drag from the initial movement direction.
   */
  axis?: 'x' | 'y' | 'xy' | 'auto'
  handle?: string | HTMLElement
  bounds?: 'parent' | HTMLElement | { left?: number; top?: number; right?: number; bottom?: number }
  grid?: { x: number; y: number }
  /**
   * Momentum/inertia after release.
   * - `friction` is applied per second (frame-rate independent). Default 0.95.
   * - `minSpeed` is px/s below which momentum stops. Default 0.1.
   * - `minVelocity` is px/s at lift-off required to start momentum. Default 10.
   */
  momentum?: boolean | { friction?: number; minSpeed?: number; minVelocity?: number }
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

export class Draggable extends Pointrix {
  private dragOptions: DragOptions
  private transform = { x: 0, y: 0 }
  private startTransform = { x: 0, y: 0 }
  private bounds: DOMRect | null = null
  private momentum: { vx: number; vy: number; active: boolean } = { vx: 0, vy: 0, active: false }
  private transformNormalized = false
  private detectedAxis: 'x' | 'y' | null = null
  private cachedSize = { width: 0, height: 0 }
  /**
   * Stable getRect closure we can hand to DropzoneManager without allocating
   * an arrow per frame. Bound in the constructor.
   */
  private _boundGetRect: () => DOMRect = () => this.getRect()
  private modifierContext: ModifierContext = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    element: null as unknown as HTMLElement,
    startPosition: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
  }
  private cachedDragEvent: DragEvent = {
    target: null as unknown as HTMLElement,
    originalEvent: null as unknown as PointerEvent,
    pointers: [],
    isPrimary: true,
    dx: 0,
    dy: 0,
    totalX: 0,
    totalY: 0,
    velocityX: 0,
    velocityY: 0,
  }

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

    // ARIA
    if (options.aria !== false) {
      setDraggableAttrs(element)
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

    // ARIA
    if (this.dragOptions.aria !== false) {
      setDraggingAttrs(element, true)
      announce(getMessages().dragPickedUp)
    }

    // Reset per-drag axis detection state (used by `axis: 'auto'`).
    this.detectedAxis = null

    // Always re-read the current transform from the DOM to sync with
    // any external changes (e.g. Resizable modifying the transform)
    this.readCurrentTransform(element)

    if (this.dragOptions.styleCursor !== false) {
      element.style.cursor = this.dragOptions.cursorChecker ? this.dragOptions.cursorChecker('grabbing') : 'grabbing'
    }
    element.style.willChange = 'transform'

    // Store start transform
    this.startTransform.x = this.transform.x
    this.startTransform.y = this.transform.y

    // Calculate bounds if needed
    // Bounds are in transform-space: what values of this.transform.{x,y} keep
    // the element within the bounding region. The formula for any region is:
    //   minX = region.left  - rect.left  + startTransform.x
    //   maxX = region.right - rect.right + startTransform.x
    // This accounts for the element's actual offset within the parent.
    if (this.dragOptions.bounds) {
      const rect = this.getRect(element)
      const tx = this.startTransform.x
      const ty = this.startTransform.y

      let region: { left: number; top: number; right: number; bottom: number }

      if (this.dragOptions.bounds === 'parent') {
        const parent = (element.offsetParent || document.body) as HTMLElement
        const pr = this.getRect(parent)
        region = { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom }
      } else if (this.dragOptions.bounds instanceof HTMLElement) {
        const br = this.getRect(this.dragOptions.bounds)
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

    // Cache element size at drag start (honors rectChecker)
    const startRect = this.getRect(e.target)
    this.cachedSize.width = startRect.width
    this.cachedSize.height = startRect.height

    // Call modifier onStart hooks
    if (this.dragOptions.modifiers?.length) {
      const ctx = this.modifierContext
      ctx.position.x = this.startTransform.x
      ctx.position.y = this.startTransform.y
      ctx.velocity.x = 0
      ctx.velocity.y = 0
      ctx.element = e.target
      ctx.startPosition.x = this.startTransform.x
      ctx.startPosition.y = this.startTransform.y
      ctx.delta.x = 0
      ctx.delta.y = 0
      ctx.size!.width = this.cachedSize.width
      ctx.size!.height = this.cachedSize.height
      for (const mod of this.dragOptions.modifiers) {
        mod.onStart?.(ctx)
      }
    }

    // Fire drag start event
    if (this.dragOptions.onDragStart) {
      this.dragOptions.onDragStart(this.createDragEvent(e, 0, 0))
    }

    if (this.dragOptions.droppable) {
      DropzoneManager.onDragStart(e.target)
    }
  }

  private handleDragMove(e: InteractionEvent) {
    const pointer = e.pointers[0]
    let dx = pointer.total.x
    let dy = pointer.total.y

    // Auto-detect axis from initial movement direction (axis: 'auto')
    if (this.dragOptions.axis === 'auto' && this.detectedAxis === null) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX > 0 || absY > 0) {
        this.detectedAxis = absX > absY ? 'x' : 'y'
      }
    }

    // Apply axis constraints
    const effectiveAxis = this.dragOptions.axis === 'auto' ? this.detectedAxis : this.dragOptions.axis
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
      const ctx = this.modifierContext
      ctx.position.x = x
      ctx.position.y = y
      ctx.velocity.x = pointer.velocity.x
      ctx.velocity.y = pointer.velocity.y
      ctx.element = e.target
      ctx.startPosition.x = this.startTransform.x
      ctx.startPosition.y = this.startTransform.y
      ctx.delta.x = pointer.delta.x
      ctx.delta.y = pointer.delta.y
      ctx.size!.width = this.cachedSize.width
      ctx.size!.height = this.cachedSize.height
      // Modifiers mutate ctx in place — read the final position back off of it.
      applyModifiers(this.dragOptions.modifiers, ctx)
      x = ctx.position.x
      y = ctx.position.y
    }

    // Update transform in place — no per-frame allocation.
    this.transform.x = x
    this.transform.y = y
    this.applyTransform(e.target)

    // Store velocity for momentum
    if (this.dragOptions.momentum) {
      this.momentum.vx = pointer.velocity.x
      this.momentum.vy = pointer.velocity.y
    }

    // Fire drag move event — build once, share with dropzone manager.
    const dragMoveEvent = this.createDragEvent(e, dx, dy)
    if (this.dragOptions.onDragMove) {
      this.dragOptions.onDragMove(dragMoveEvent)
    }

    if (this.dragOptions.droppable) {
      // Pass our rectChecker through so zones hit-test against our custom
      // geometry rather than calling getBoundingClientRect themselves.
      DropzoneManager.onDragMove(e.target, pointer.current, dragMoveEvent, this._boundGetRect)
    }
  }

  private handleDragEnd(e: InteractionEvent) {
    const element = e.target

    // ARIA
    if (this.dragOptions.aria !== false) {
      setDraggingAttrs(element, false)
      announce(getMessages().dragDropped)
    }

    if (this.dragOptions.styleCursor !== false) {
      element.style.cursor = this.dragOptions.cursorChecker ? this.dragOptions.cursorChecker('grab') : 'grab'
    }

    // Calculate final drag distance
    const dx = this.transform.x - this.startTransform.x
    const dy = this.transform.y - this.startTransform.y

    // Start momentum animation if enabled (minVelocity default 10 px/s)
    const momOpt = this.dragOptions.momentum
    const minV = typeof momOpt === 'object' ? momOpt.minVelocity ?? 10 : 10
    if (momOpt && (Math.abs(this.momentum.vx) > minV || Math.abs(this.momentum.vy) > minV)) {
      this.startMomentum()
    } else {
      element.style.willChange = ''
    }

    // Call modifier onEnd hooks (reuses cached ctx, each mutates in place)
    if (this.dragOptions.modifiers?.length) {
      const pointer = e.pointers[0]
      const ctx = this.modifierContext
      ctx.position.x = this.transform.x
      ctx.position.y = this.transform.y
      ctx.velocity.x = pointer?.velocity.x ?? 0
      ctx.velocity.y = pointer?.velocity.y ?? 0
      ctx.element = e.target
      ctx.startPosition.x = this.startTransform.x
      ctx.startPosition.y = this.startTransform.y
      ctx.delta.x = dx
      ctx.delta.y = dy
      ctx.size!.width = this.cachedSize.width
      ctx.size!.height = this.cachedSize.height

      for (const mod of this.dragOptions.modifiers) {
        mod.onEnd?.(ctx)
      }

      const finalX = ctx.position.x
      const finalY = ctx.position.y
      if (finalX !== this.transform.x || finalY !== this.transform.y) {
        this.transform.x = finalX
        this.transform.y = finalY
        // Animate the snap-back with a CSS transition (respect reduced-motion)
        if (!prefersReducedMotion()) {
          element.style.transition = 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1)'
          this.applyTransform(element)
          const cleanup = () => {
            element.style.transition = ''
            element.removeEventListener('transitionend', cleanup)
          }
          element.addEventListener('transitionend', cleanup)
        } else {
          this.applyTransform(element)
        }
      }
    }

    if (this.dragOptions.droppable) {
      const pointer = e.pointers[0]
      const pos = pointer?.current ?? { x: 0, y: 0 }
      DropzoneManager.onDragEnd(e.target, pos, this.createDragEvent(e, dx, dy), this._boundGetRect)
    }

    if (this.dragOptions.onDragEnd) {
      this.dragOptions.onDragEnd(this.createDragEvent(e, dx, dy))
    }
  }

  private startMomentum() {
    this.momentum.active = true
    const momOpt = this.dragOptions.momentum
    // friction is 0..1 remaining-velocity-per-second (0.95 = 5% loss/sec)
    const friction = typeof momOpt === 'object' ? momOpt.friction ?? 0.95 : 0.95
    const minSpeed = typeof momOpt === 'object' ? momOpt.minSpeed ?? 0.1 : 0.1

    let lastTime = performance.now()

    const animate = (now: number) => {
      if (!this.momentum.active) return

      // Real dt — works correctly on 30/60/120/240Hz displays.
      const dt = Math.min(100, now - lastTime) / 1000 // cap at 100ms (tab-switch)
      lastTime = now

      // Frame-rate-independent friction: v *= friction^dt
      const decay = Math.pow(friction, dt)
      this.momentum.vx *= decay
      this.momentum.vy *= decay

      if (Math.abs(this.momentum.vx) < minSpeed && Math.abs(this.momentum.vy) < minSpeed) {
        this.momentum.active = false
        this.element.style.willChange = ''
        return
      }

      this.transform.x += this.momentum.vx * dt
      this.transform.y += this.momentum.vy * dt

      if (this.bounds) {
        if (this.transform.x < this.bounds.left || this.transform.x > this.bounds.right) {
          this.momentum.vx *= -0.5
          this.transform.x = Math.max(this.bounds.left, Math.min(this.transform.x, this.bounds.right))
        }
        if (this.transform.y < this.bounds.top || this.transform.y > this.bounds.bottom) {
          this.momentum.vy *= -0.5
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
    const evt = this.cachedDragEvent
    evt.target = e.target
    evt.originalEvent = e.originalEvent
    evt.pointers = e.pointers
    evt.isPrimary = e.isPrimary
    evt.dx = pointer?.delta.x || 0
    evt.dy = pointer?.delta.y || 0
    evt.totalX = dx
    evt.totalY = dy
    evt.velocityX = pointer?.velocity.x || 0
    evt.velocityY = pointer?.velocity.y || 0
    return evt
  }

  setPosition(x: number, y: number) {
    this.transform.x = x
    this.transform.y = y
    this.applyTransform(this.element)
  }

  getPosition() {
    return { ...this.transform }
  }

  /**
   * Update drag options in place. Safe to call mid-interaction — callbacks
   * take effect immediately, and data options (axis, bounds, grid, modifiers,
   * momentum, etc.) apply from the next move event. Cursor is re-applied if
   * it has changed.
   */
  updateOptions(partial: Partial<DragOptions>): void {
    // Forward base-class options (threshold, touchAction, etc.)
    super.updateOptions(partial)
    // Then subclass-specific keys
    Object.assign(this.dragOptions, partial)
    // Re-apply idle cursor if relevant option changed and we're not dragging
    if (('cursorChecker' in partial || 'styleCursor' in partial) && !this.interacting) {
      if (this.dragOptions.styleCursor !== false) {
        this.element.style.cursor = this.dragOptions.cursorChecker
          ? this.dragOptions.cursorChecker('idle')
          : 'grab'
      } else {
        this.element.style.cursor = ''
      }
    }
  }

  destroy() {
    super.destroy()
    this.element.style.cursor = ''
    this.element.style.willChange = ''
    this.momentum.active = false
    if (this.dragOptions.aria !== false) {
      clearDraggableAttrs(this.element)
    }
  }
}

// Factory function
export function draggable(element: HTMLElement | string, options?: DragOptions): Draggable {
  const el = typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element

  if (!el) throw new Error(`Element not found: ${element}`)

  return new Draggable(el, options)
}

export default draggable
