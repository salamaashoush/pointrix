// Optimized resize addon for grip-nano (~3KB minified)

import { Grip, InteractionEvent, GripOptions } from './nano'
import { Modifier, ModifierContext, applyModifiers } from './types'

export interface ResizeOptions extends GripOptions {
  edges?: {
    top?: boolean
    right?: boolean
    bottom?: boolean
    left?: boolean
  }
  handleSize?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: number | 'preserve'
  square?: boolean
  invert?: 'none' | 'negate' | 'reposition'
  grid?: { width: number; height: number }
  modifiers?: Modifier[]
  cursorChecker?: (edge: string | null) => string
  onResizeStart?: (event: ResizeEvent) => void
  onResizeMove?: (event: ResizeEvent) => void
  onResizeEnd?: (event: ResizeEvent) => void
}

export interface ResizeEvent extends InteractionEvent {
  width: number
  height: number
  deltaWidth: number
  deltaHeight: number
  edges: {
    top: boolean
    right: boolean
    bottom: boolean
    left: boolean
  }
}

type Edge = 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null

export class Resizable extends Grip {
  private resizeOptions: ResizeOptions
  private startSize = { width: 0, height: 0 }
  private startPos = { x: 0, y: 0 }
  private currentSize = { width: 0, height: 0 }
  private currentPos = { x: 0, y: 0 }
  private activeEdge: Edge = null
  private edgeFlags = { top: false, right: false, bottom: false, left: false }
  private aspectRatio: number | null = null
  private boundUpdateCursor: (e: PointerEvent) => void
  private transformNormalized = false
  private modifierContext: ModifierContext = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    element: null as unknown as HTMLElement,
    startPosition: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    edges: { top: false, right: false, bottom: false, left: false },
    size: { width: 0, height: 0 },
    startSize: { width: 0, height: 0 },
  }
  private cachedResizeEvent: ResizeEvent = {
    target: null as unknown as HTMLElement,
    originalEvent: null as unknown as PointerEvent,
    pointers: [],
    isPrimary: true,
    width: 0,
    height: 0,
    deltaWidth: 0,
    deltaHeight: 0,
    edges: { top: false, right: false, bottom: false, left: false },
  }
  
  constructor(element: HTMLElement, options: ResizeOptions = {}) {
    // Default options
    const defaultOptions: ResizeOptions = {
      edges: { top: true, right: true, bottom: true, left: true },
      handleSize: 10,
      minWidth: 50,
      minHeight: 50,
      ...options
    }
    
    super(element, {
      ...defaultOptions,
      threshold: 0, // Start immediately for resize
      onStart: (e) => {
        this.handleResizeStart(e)
        options.onStart?.(e)
      },
      onMove: (e) => {
        this.handleResizeMove(e)
        options.onMove?.(e)
      },
      onEnd: (e) => {
        this.handleResizeEnd(e)
        options.onEnd?.(e)
      }
    })
    
    this.resizeOptions = defaultOptions

    // Square is a convenience alias for aspectRatio: 1
    if (this.resizeOptions.square) this.resizeOptions.aspectRatio = 1

    // Set higher priority for resize interactions
    this.priority = 10

    // Set resize cursor on hover
    this.boundUpdateCursor = this.updateCursor.bind(this)
    element.addEventListener('pointermove', this.boundUpdateCursor)
    element.style.position = 'relative'
  }
  
  private normalizeInitialTransform(element: HTMLElement) {
    const style = window.getComputedStyle(element)
    const matrix = style.transform

    if (matrix && matrix !== 'none') {
      const values = matrix.match(/matrix.*\((.+)\)/)
      if (values) {
        const parts = values[1].split(', ')
        const initialX = parseFloat(parts[4]) || 0
        const initialY = parseFloat(parts[5]) || 0
        // Normalize by applying as inline style to preserve the transform
        element.style.transform = `translate3d(${initialX}px, ${initialY}px, 0)`
      }
    }
  }
  
  // Override shouldHandleEvent to only handle when near edges
  protected shouldHandleEvent(e: PointerEvent): boolean {
    const edge = this.detectEdge(e)
    const shouldHandle = edge !== null
    return shouldHandle
  }
  
  private updateCursor(e: PointerEvent) {
    if (this.activeEdge) return // Don't update while resizing

    const edge = this.detectEdge(e)
    this.element.style.cursor = this.resizeOptions.cursorChecker
      ? this.resizeOptions.cursorChecker(edge)
      : this.getCursor(edge)
  }
  
  private detectEdge(e: PointerEvent): Edge {
    const rect = this.element.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const handleSize = this.resizeOptions.handleSize || 10
    
    const edges = this.resizeOptions.edges || {}
    const nearTop = edges.top && y < handleSize
    const nearBottom = edges.bottom && y > rect.height - handleSize
    const nearLeft = edges.left && x < handleSize
    const nearRight = edges.right && x > rect.width - handleSize
    
    // Corners take priority
    if (nearTop && nearLeft) return 'top-left'
    if (nearTop && nearRight) return 'top-right'
    if (nearBottom && nearLeft) return 'bottom-left'
    if (nearBottom && nearRight) return 'bottom-right'
    
    // Then edges
    if (nearTop) return 'top'
    if (nearBottom) return 'bottom'
    if (nearLeft) return 'left'
    if (nearRight) return 'right'
    
    return null
  }
  
  private getCursor(edge: Edge): string {
    switch (edge) {
      case 'top':
      case 'bottom':
        return 'ns-resize'
      case 'left':
      case 'right':
        return 'ew-resize'
      case 'top-left':
      case 'bottom-right':
        return 'nwse-resize'
      case 'top-right':
      case 'bottom-left':
        return 'nesw-resize'
      default:
        return ''
    }
  }
  
  private handleResizeStart(e: InteractionEvent) {
    // Defer transform parsing to first interaction (avoids getComputedStyle in constructor)
    if (!this.transformNormalized) {
      this.normalizeInitialTransform(this.element)
      this.transformNormalized = true
    }

    const rect = this.element.getBoundingClientRect()
    const style = window.getComputedStyle(this.element)

    // Detect which edge is being dragged
    this.activeEdge = this.detectEdge(e.originalEvent)
    if (!this.activeEdge) return

    // Cache edge boolean flags
    this.edgeFlags.top = this.activeEdge.includes('top')
    this.edgeFlags.right = this.activeEdge.includes('right')
    this.edgeFlags.bottom = this.activeEdge.includes('bottom')
    this.edgeFlags.left = this.activeEdge.includes('left')

    // Store initial state
    this.startSize = {
      width: parseFloat(style.width) || rect.width,
      height: parseFloat(style.height) || rect.height
    }
    this.currentSize = { ...this.startSize }
    
    // Use the normalized transform values (already parsed and applied during construction)
    const transform = style.transform
    if (transform && transform !== 'none') {
      const values = transform.match(/matrix.*\((.+)\)/)
      if (values) {
        const parts = values[1].split(', ')
        this.startPos.x = parseFloat(parts[4]) || 0
        this.startPos.y = parseFloat(parts[5]) || 0
      }
    } else {
      this.startPos.x = 0
      this.startPos.y = 0
    }
    this.currentPos = { ...this.startPos }

    // Calculate aspect ratio if needed
    if (this.resizeOptions.aspectRatio === 'preserve') {
      this.aspectRatio = this.startSize.width / this.startSize.height
    } else if (typeof this.resizeOptions.aspectRatio === 'number') {
      this.aspectRatio = this.resizeOptions.aspectRatio
    }
    
    // Set will-change for performance
    this.element.style.willChange = 'width, height, transform'
    
    // Fire resize start event
    const resizeStartEvent = this.createResizeEvent(e, 0, 0)
    if (this.resizeOptions.onResizeStart) {
      this.resizeOptions.onResizeStart(resizeStartEvent)
    }
    this.emit('resizestart', resizeStartEvent)
  }
  
  private handleResizeMove(e: InteractionEvent) {
    if (!this.activeEdge) return
    
    const pointer = e.pointers[0]
    let deltaX = pointer.total.x
    let deltaY = pointer.total.y
    
    // Calculate new size based on edge
    let newWidth = this.startSize.width
    let newHeight = this.startSize.height
    let newX = this.startPos.x
    let newY = this.startPos.y
    
    // Handle each edge/corner
    if (this.edgeFlags.right) {
      newWidth += deltaX
    }
    if (this.edgeFlags.left) {
      newWidth -= deltaX
      newX += deltaX
    }
    if (this.edgeFlags.bottom) {
      newHeight += deltaY
    }
    if (this.edgeFlags.top) {
      newHeight -= deltaY
      newY += deltaY
    }
    
    // Apply invert mode
    const invertMode = this.resizeOptions.invert || 'none'

    if (invertMode === 'reposition') {
      // When width/height goes negative, the element has been dragged past zero.
      // Flip: make dimensions positive and adjust position so the opposite
      // corner stays anchored. This makes the element "turn inside out"
      // naturally — the edge you're dragging becomes the opposite edge.
      if (newWidth < 0) {
        newX += newWidth // shift left by the (negative) width
        newWidth = -newWidth
      }
      if (newHeight < 0) {
        newY += newHeight
        newHeight = -newHeight
      }
    }

    // Constraints
    const minWidth = invertMode === 'negate' ? -Infinity : (this.resizeOptions.minWidth || 0)
    const minHeight = invertMode === 'negate' ? -Infinity : (this.resizeOptions.minHeight || 0)
    const maxWidth = this.resizeOptions.maxWidth || Infinity
    const maxHeight = this.resizeOptions.maxHeight || Infinity

    // For reposition mode, use a very small min (1px) instead of the default 50
    // so the flip feels smooth — the user can drag through zero without a "dead zone"
    const effectiveMinW = invertMode === 'reposition' ? 1 : (minWidth || 50)
    const effectiveMinH = invertMode === 'reposition' ? 1 : (minHeight || 50)

    // Maintain aspect ratio if needed
    if (this.aspectRatio) {
      if (this.activeEdge === 'left' || this.activeEdge === 'right') {
        newHeight = newWidth / this.aspectRatio
      } else if (this.activeEdge === 'top' || this.activeEdge === 'bottom') {
        newWidth = newHeight * this.aspectRatio
      } else {
        const widthChange = Math.abs(newWidth - this.startSize.width)
        const heightChange = Math.abs(newHeight - this.startSize.height)

        if (widthChange > heightChange) {
          newHeight = newWidth / this.aspectRatio
        } else {
          newWidth = newHeight * this.aspectRatio
        }
      }
    }

    // Apply size constraints
    if (newWidth < effectiveMinW) {
      if (this.edgeFlags.left) {
        newX += newWidth - effectiveMinW
      }
      newWidth = effectiveMinW
      if (this.aspectRatio) newHeight = newWidth / this.aspectRatio
    }
    if (newWidth > maxWidth) {
      if (this.edgeFlags.left) {
        newX += newWidth - maxWidth
      }
      newWidth = maxWidth
      if (this.aspectRatio) newHeight = newWidth / this.aspectRatio
    }

    if (newHeight < effectiveMinH) {
      if (this.edgeFlags.top) {
        newY += newHeight - effectiveMinH
      }
      newHeight = effectiveMinH
      if (this.aspectRatio) newWidth = newHeight * this.aspectRatio
    }
    if (newHeight > maxHeight) {
      if (this.edgeFlags.top) {
        newY += newHeight - maxHeight
      }
      newHeight = maxHeight
      if (this.aspectRatio) newWidth = newHeight * this.aspectRatio
    }
    
    // Apply grid snapping
    if (this.resizeOptions.grid) {
      newWidth = Math.round(newWidth / this.resizeOptions.grid.width) * this.resizeOptions.grid.width
      newHeight = Math.round(newHeight / this.resizeOptions.grid.height) * this.resizeOptions.grid.height
    }
    
    // Apply modifiers if configured
    if (this.resizeOptions.modifiers?.length) {
      const ctx = this.modifierContext
      ctx.position.x = newX
      ctx.position.y = newY
      ctx.velocity.x = pointer.velocity?.x ?? 0
      ctx.velocity.y = pointer.velocity?.y ?? 0
      ctx.element = this.element
      ctx.startPosition.x = this.startPos.x
      ctx.startPosition.y = this.startPos.y
      ctx.delta.x = deltaX
      ctx.delta.y = deltaY
      ctx.edges!.top = this.edgeFlags.top
      ctx.edges!.right = this.edgeFlags.right
      ctx.edges!.bottom = this.edgeFlags.bottom
      ctx.edges!.left = this.edgeFlags.left
      ctx.size!.width = newWidth
      ctx.size!.height = newHeight
      ctx.startSize!.width = this.startSize.width
      ctx.startSize!.height = this.startSize.height
      const result = applyModifiers(this.resizeOptions.modifiers, ctx)
      newX = result.position.x
      newY = result.position.y
      if (result.size) {
        newWidth = result.size.width
        newHeight = result.size.height
      }
    }

    // Update size and position
    this.currentSize = { width: newWidth, height: newHeight }
    this.currentPos = { x: newX, y: newY }

    // Apply changes
    this.element.style.width = `${newWidth}px`
    this.element.style.height = `${newHeight}px`

    if (newX !== this.startPos.x || newY !== this.startPos.y) {
      this.element.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
    }
    
    // Fire resize move event
    const deltaWidth = newWidth - this.startSize.width
    const deltaHeight = newHeight - this.startSize.height
    const resizeMoveEvent = this.createResizeEvent(e, deltaWidth, deltaHeight)
    if (this.resizeOptions.onResizeMove) {
      this.resizeOptions.onResizeMove(resizeMoveEvent)
    }
    this.emit('resizemove', resizeMoveEvent)
  }
  
  private handleResizeEnd(e: InteractionEvent) {
    this.element.style.willChange = ''
    this.activeEdge = null

    // Fire resize end event
    const deltaWidth = this.currentSize.width - this.startSize.width
    const deltaHeight = this.currentSize.height - this.startSize.height
    const resizeEndEvent = this.createResizeEvent(e, deltaWidth, deltaHeight)
    if (this.resizeOptions.onResizeEnd) {
      this.resizeOptions.onResizeEnd(resizeEndEvent)
    }
    this.emit('resizeend', resizeEndEvent)
  }
  
  private createResizeEvent(e: InteractionEvent, deltaWidth: number, deltaHeight: number): ResizeEvent {
    const evt = this.cachedResizeEvent
    evt.target = e.target
    evt.originalEvent = e.originalEvent
    evt.pointers = e.pointers
    evt.isPrimary = e.isPrimary
    evt.width = this.currentSize.width
    evt.height = this.currentSize.height
    evt.deltaWidth = deltaWidth
    evt.deltaHeight = deltaHeight
    evt.edges.top = this.edgeFlags.top
    evt.edges.right = this.edgeFlags.right
    evt.edges.bottom = this.edgeFlags.bottom
    evt.edges.left = this.edgeFlags.left
    return evt
  }
  
  setSize(width: number, height: number) {
    this.currentSize = { width, height }
    this.element.style.width = `${width}px`
    this.element.style.height = `${height}px`
  }
  
  getSize() {
    return { ...this.currentSize }
  }
  
  destroy() {
    super.destroy()
    this.element.removeEventListener('pointermove', this.boundUpdateCursor)
    this.element.style.cursor = ''
    this.element.style.willChange = ''
  }
}

// Factory function
export function resizable(element: HTMLElement | string, options?: ResizeOptions): Resizable {
  const el = typeof element === 'string' 
    ? document.querySelector<HTMLElement>(element)
    : element
    
  if (!el) throw new Error(`Element not found: ${element}`)
  
  return new Resizable(el, options)
}

export default resizable