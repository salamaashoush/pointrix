// Ultra-minimal core for pointer interactions (~3KB minified)

export interface Point {
  x: number
  y: number
}

export interface PointerState {
  id: number
  start: Point
  current: Point
  previous: Point
  delta: Point
  total: Point
  velocity: Point
  timestamp: number
}

export interface InteractionEvent {
  target: HTMLElement
  pointers: PointerState[]
  isPrimary: boolean
  originalEvent: PointerEvent
}

export interface HyperactOptions {
  onStart?: (event: InteractionEvent) => void
  onMove?: (event: InteractionEvent) => void
  onEnd?: (event: InteractionEvent) => void
  threshold?: number // Movement threshold before starting interaction
  preventScroll?: boolean
}

// Shared RAF scheduler for all instances
let rafId: number | null = null
let instances: Set<Hyperact> = new Set()
let dirtyInstances: Set<Hyperact> = new Set()

function scheduleUpdate() {
  if (rafId !== null) return
  
  rafId = requestAnimationFrame(() => {
    rafId = null
    
    // Only update instances that have changes
    dirtyInstances.forEach(instance => instance.update())
    dirtyInstances.clear()
    
    // Only schedule next frame if there are active instances with ongoing changes
    if (instances.size > 0) {
      // Check if any instances still have velocity or pending updates
      let hasActiveInstances = false
      instances.forEach(instance => {
        if (instance.hasActivePointers()) {
          hasActiveInstances = true
        }
      })
      
      if (hasActiveInstances) {
        scheduleUpdate()
      }
    }
  })
}

export class Hyperact {
  protected element: HTMLElement
  protected options: HyperactOptions
  protected pointers = new Map<number, PointerState>()
  protected isActive = false
  protected lastUpdate = 0
  protected priority: number = 0 // Higher priority wins
  
  // Static registry for coordinating multiple instances on same element
  private static elementInstances = new WeakMap<HTMLElement, Hyperact[]>()
  private static activeInstance = new WeakMap<HTMLElement, Hyperact | null>()
  private static elementListeners = new WeakMap<HTMLElement, (e: PointerEvent) => void>()
  
  constructor(element: HTMLElement, options: HyperactOptions = {}) {
    this.element = element
    this.options = {
      threshold: 3,
      preventScroll: true,
      ...options
    }
    
    // Register this instance
    this.registerInstance()
    
    // Optimize element for interactions (only if first instance)
    const instances = Hyperact.elementInstances.get(element) || []
    if (instances.length === 1) {
      element.style.touchAction = 'none'
      element.style.userSelect = 'none'
      element.style.webkitUserSelect = 'none'
    }
    
    // Bind event handlers
    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    
    // Add listeners (only if first instance)
    if (instances.length === 1) {
      const listener = (e: PointerEvent) => Hyperact.handleElementPointerDown(element, e)
      Hyperact.elementListeners.set(element, listener)
      element.addEventListener('pointerdown', listener)
    }
  }
  
  private registerInstance() {
    const instances = Hyperact.elementInstances.get(this.element) || []
    instances.push(this)
    Hyperact.elementInstances.set(this.element, instances)
  }
  
  private unregisterInstance() {
    const instances = Hyperact.elementInstances.get(this.element) || []
    const index = instances.indexOf(this)
    if (index >= 0) {
      instances.splice(index, 1)
      if (instances.length === 0) {
        Hyperact.elementInstances.delete(this.element)
        Hyperact.activeInstance.delete(this.element)
        Hyperact.elementListeners.delete(this.element)
      } else {
        Hyperact.elementInstances.set(this.element, instances)
      }
    }
  }
  
  // Virtual method for subclasses to decide if they should handle an event
  protected shouldHandleEvent(e: PointerEvent): boolean {
    return true
  }
  
  // Static method to handle pointer events for all instances on an element
  private static handleElementPointerDown(element: HTMLElement, e: PointerEvent) {
    const instances = Hyperact.elementInstances.get(element) || []
    const activeInstance = Hyperact.activeInstance.get(element)
    
    // If there's already an active instance, let it continue
    if (activeInstance) {
      activeInstance.onPointerDown(e)
      return
    }
    
    // Check all instances to see which should handle this event
    let handlingInstance: Hyperact | null = null
    let highestPriority = -1
    
    for (const instance of instances) {
      const shouldHandle = instance.shouldHandleEvent(e)
      
      if (shouldHandle && instance.priority > highestPriority) {
        handlingInstance = instance
        highestPriority = instance.priority
      }
    }
    
    // If we found an instance to handle the event
    if (handlingInstance) {
      Hyperact.activeInstance.set(element, handlingInstance)
      handlingInstance.handlePointerDown(e)
    }
  }
  
  // This is now called by the static handler when this instance is selected
  private onPointerDown(e: PointerEvent) {
    this.handlePointerDown(e)
  }
  
  private handlePointerDown(e: PointerEvent) {
    // Prevent default to avoid scrolling
    if (this.options.preventScroll) e.preventDefault()
    
    const point = { x: e.clientX, y: e.clientY }
    const pointer: PointerState = {
      id: e.pointerId,
      start: { ...point },
      current: { ...point },
      previous: { ...point },
      delta: { x: 0, y: 0 },
      total: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      timestamp: e.timeStamp
    }
    
    this.pointers.set(e.pointerId, pointer)
    
    // Add global listeners
    if (this.pointers.size === 1) {
      document.addEventListener('pointermove', this.onPointerMove, { passive: false })
      document.addEventListener('pointerup', this.onPointerUp)
      document.addEventListener('pointercancel', this.onPointerUp)
    }
    
    // Start tracking if threshold is 0
    if (this.options.threshold === 0) {
      this.start(e)
    }
  }
  
  private onPointerMove(e: PointerEvent) {
    const pointer = this.pointers.get(e.pointerId)
    if (!pointer) return
    
    const newX = e.clientX
    const newY = e.clientY
    
    // Only update if position actually changed
    if (pointer.current.x !== newX || pointer.current.y !== newY) {
      pointer.current = { x: newX, y: newY }
      
      // Check threshold
      if (!this.isActive) {
        const dx = pointer.current.x - pointer.start.x
        const dy = pointer.current.y - pointer.start.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance >= (this.options.threshold || 3)) {
          this.start(e)
        }
      }
      
      if (this.isActive) {
        if (this.options.preventScroll) e.preventDefault()
        instances.add(this)
        dirtyInstances.add(this)
        scheduleUpdate()
      }
    }
  }
  
  private onPointerUp(e: PointerEvent) {
    const pointer = this.pointers.get(e.pointerId)
    if (!pointer) return
    
    this.pointers.delete(e.pointerId)
    
    // Remove global listeners when no pointers
    if (this.pointers.size === 0) {
      document.removeEventListener('pointermove', this.onPointerMove)
      document.removeEventListener('pointerup', this.onPointerUp)
      document.removeEventListener('pointercancel', this.onPointerUp)
      
      if (this.isActive) {
        this.end(e)
      }
    }
  }
  
  private start(e: PointerEvent) {
    this.isActive = true
    instances.add(this)
    
    if (this.options.onStart) {
      this.options.onStart(this.createEvent(e))
    }
  }
  
  private end(e: PointerEvent) {
    this.isActive = false
    instances.delete(this)
    dirtyInstances.delete(this)
    
    // Clear active instance
    if (Hyperact.activeInstance.get(this.element) === this) {
      Hyperact.activeInstance.set(this.element, null)
    }
    
    if (this.options.onEnd) {
      this.options.onEnd(this.createEvent(e))
    }
  }
  
  update() {
    if (!this.isActive || this.pointers.size === 0) return
    
    const now = performance.now()
    const dt = now - this.lastUpdate
    this.lastUpdate = now
    
    // Update pointer states
    let hasChanges = false
    let hasVelocity = false
    
    this.pointers.forEach(pointer => {
      const dx = pointer.current.x - pointer.previous.x
      const dy = pointer.current.y - pointer.previous.y
      
      if (dx !== 0 || dy !== 0) {
        hasChanges = true
        
        pointer.delta = { x: dx, y: dy }
        pointer.total = {
          x: pointer.current.x - pointer.start.x,
          y: pointer.current.y - pointer.start.y
        }
        
        // Calculate velocity with smoothing
        if (dt > 0) {
          const vx = dx / dt * 1000
          const vy = dy / dt * 1000
          pointer.velocity = {
            x: pointer.velocity.x * 0.7 + vx * 0.3,
            y: pointer.velocity.y * 0.7 + vy * 0.3
          }
        }
        
        pointer.previous = { ...pointer.current }
      }
      
      // Check if pointer still has velocity (for inertia)
      if (Math.abs(pointer.velocity.x) > 0.1 || Math.abs(pointer.velocity.y) > 0.1) {
        hasVelocity = true
      }
    })
    
    if (hasChanges && this.options.onMove) {
      // Create a dummy event for the callback
      const e = new PointerEvent('pointermove')
      this.options.onMove(this.createEvent(e))
    }
    
    // Mark as dirty if still has velocity (for continued updates)
    if (hasVelocity) {
      dirtyInstances.add(this)
    }
  }
  
  hasActivePointers(): boolean {
    if (!this.isActive || this.pointers.size === 0) return false
    
    // Check if any pointer has significant velocity
    for (const pointer of this.pointers.values()) {
      if (Math.abs(pointer.velocity.x) > 0.1 || Math.abs(pointer.velocity.y) > 0.1) {
        return true
      }
    }
    
    return this.pointers.size > 0
  }
  
  private createEvent(originalEvent: PointerEvent): InteractionEvent {
    return {
      target: this.element,
      pointers: Array.from(this.pointers.values()),
      isPrimary: originalEvent.isPrimary,
      originalEvent
    }
  }
  
  destroy() {
    // Unregister this instance
    this.unregisterInstance()
    
    // Only remove listeners if this is the last instance
    const elementInstances = Hyperact.elementInstances.get(this.element) || []
    if (elementInstances.length === 0) {
      // Remove the static event listener
      const listener = Hyperact.elementListeners.get(this.element)
      if (listener) {
        this.element.removeEventListener('pointerdown', listener)
        Hyperact.elementListeners.delete(this.element)
      }
      
      
      // Reset element styles
      this.element.style.touchAction = ''
      this.element.style.userSelect = ''
      this.element.style.webkitUserSelect = ''
    }
    
    // Clean up if active
    if (this.pointers.size > 0) {
      document.removeEventListener('pointermove', this.onPointerMove)
      document.removeEventListener('pointerup', this.onPointerUp)
      document.removeEventListener('pointercancel', this.onPointerUp)
    }
    
    // Remove from RAF instances
    instances.delete(this)
    
    this.pointers.clear()
  }
}

// Simple factory function
export function hyperact(element: HTMLElement | string, options?: HyperactOptions): Hyperact {
  const el = typeof element === 'string' 
    ? document.querySelector<HTMLElement>(element)
    : element
    
  if (!el) throw new Error(`Element not found: ${element}`)
  
  return new Hyperact(el, options)
}

export default hyperact