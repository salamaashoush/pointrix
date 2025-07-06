// Optimized drag addon for hyperact-nano (~2KB minified)

import { Hyperact, InteractionEvent, HyperactOptions } from './nano'

export interface DragOptions extends HyperactOptions {
  axis?: 'x' | 'y' | 'xy'
  handle?: string | HTMLElement
  bounds?: 'parent' | HTMLElement | { left?: number; top?: number; right?: number; bottom?: number }
  grid?: { x: number; y: number }
  momentum?: boolean | { friction?: number; minSpeed?: number }
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
      }
    })
    
    this.dragOptions = options
    
    // Set lower priority for drag interactions (resize has priority 10)
    this.priority = 5
    
    // Parse and normalize initial transform
    this.normalizeInitialTransform(element)
    
    // Set cursor
    element.style.cursor = 'grab'
  }
  
  private normalizeInitialTransform(element: HTMLElement) {
    const style = window.getComputedStyle(element)
    const matrix = style.transform
    
    if (matrix && matrix !== 'none') {
      const values = matrix.match(/matrix.*\((.+)\)/)
      if (values) {
        const parts = values[1].split(', ')
        this.transform.x = parseFloat(parts[4]) || 0
        this.transform.y = parseFloat(parts[5]) || 0
        
        // Normalize by applying as inline style to preserve the transform
        element.style.transform = `translate3d(${this.transform.x}px, ${this.transform.y}px, 0)`
      }
    }
  }
  
  private handleDragStart(e: InteractionEvent) {
    const element = e.target
    element.style.cursor = 'grabbing'
    element.style.willChange = 'transform'
    
    // Store start transform
    this.startTransform = { ...this.transform }
    
    // Calculate bounds if needed
    if (this.dragOptions.bounds) {
      const rect = element.getBoundingClientRect()
      const parent = element.offsetParent || document.body
      const parentRect = parent.getBoundingClientRect()
      
      if (this.dragOptions.bounds === 'parent') {
        // Store bounds relative to parent's size
        this.bounds = new DOMRect(
          0,
          0,
          parentRect.width - rect.width,
          parentRect.height - rect.height
        )
      } else if (this.dragOptions.bounds instanceof HTMLElement) {
        const boundsRect = this.dragOptions.bounds.getBoundingClientRect()
        this.bounds = new DOMRect(
          boundsRect.left - parentRect.left,
          boundsRect.top - parentRect.top,
          boundsRect.width - rect.width,
          boundsRect.height - rect.height
        )
      } else {
        // Custom bounds
        const b = this.dragOptions.bounds
        this.bounds = new DOMRect(
          b.left ?? -Infinity,
          b.top ?? -Infinity,
          (b.right ?? Infinity) - (b.left ?? -Infinity) - rect.width,
          (b.bottom ?? Infinity) - (b.top ?? -Infinity) - rect.height
        )
      }
    }
    
    // Stop momentum if active
    this.momentum.active = false
    
    // Fire drag start event
    if (this.dragOptions.onDragStart) {
      this.dragOptions.onDragStart(this.createDragEvent(e, 0, 0))
    }
  }
  
  private handleDragMove(e: InteractionEvent) {
    const pointer = e.pointers[0]
    let dx = pointer.total.x
    let dy = pointer.total.y
    
    // Apply axis constraints
    if (this.dragOptions.axis === 'x') dy = 0
    else if (this.dragOptions.axis === 'y') dx = 0
    
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
    
    // Update transform
    this.transform = { x, y }
    this.applyTransform(e.target)
    
    // Store velocity for momentum
    if (this.dragOptions.momentum) {
      this.momentum.vx = pointer.velocity.x
      this.momentum.vy = pointer.velocity.y
    }
    
    // Fire drag move event
    if (this.dragOptions.onDragMove) {
      this.dragOptions.onDragMove(this.createDragEvent(e, dx, dy))
    }
  }
  
  private handleDragEnd(e: InteractionEvent) {
    const element = e.target
    element.style.cursor = 'grab'
    
    // Calculate final drag distance
    const dx = this.transform.x - this.startTransform.x
    const dy = this.transform.y - this.startTransform.y
    
    // Start momentum animation if enabled
    if (this.dragOptions.momentum && (Math.abs(this.momentum.vx) > 10 || Math.abs(this.momentum.vy) > 10)) {
      this.startMomentum()
    } else {
      element.style.willChange = ''
    }
    
    // Fire drag end event
    if (this.dragOptions.onDragEnd) {
      this.dragOptions.onDragEnd(this.createDragEvent(e, dx, dy))
    }
  }
  
  private startMomentum() {
    this.momentum.active = true
    const friction = typeof this.dragOptions.momentum === 'object' 
      ? (this.dragOptions.momentum.friction || 0.95)
      : 0.95
    const minSpeed = typeof this.dragOptions.momentum === 'object'
      ? (this.dragOptions.momentum.minSpeed || 0.1)
      : 0.1
    
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
      velocityY: pointer?.velocity.y || 0
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
  const el = typeof element === 'string' 
    ? document.querySelector<HTMLElement>(element)
    : element
    
  if (!el) throw new Error(`Element not found: ${element}`)
  
  return new Draggable(el, options)
}

export default draggable