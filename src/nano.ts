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
  onTap?: (event: InteractionEvent) => void
  onDoubleTap?: (event: InteractionEvent) => void
  onHold?: (event: InteractionEvent) => void
  threshold?: number // Movement threshold before starting interaction
  preventScroll?: boolean
  holdDelay?: number // Hold delay in ms before interaction starts
  holdDuration?: number // Duration in ms before onHold fires (default 600)
  mouseButtons?: number // Bitmask: 1=left, 2=right, 4=middle. 0=any
  allowFrom?: string // CSS selector — only start if target matches
  ignoreFrom?: string // CSS selector — don't start if target matches
  touchAction?: string // CSS touch-action value (default 'none')
  styleCursor?: boolean // Whether to set cursor styles (default true)
}

// Shared RAF scheduler for all instances
let rafId: number | null = null
let instances: Set<Hyperact> = new Set()
let dirtyInstances: Set<Hyperact> = new Set()

// Cached sentinel event to avoid allocating a new PointerEvent every frame (lazily initialized)
let SENTINEL_MOVE_EVENT: PointerEvent | null = null
function getSentinelEvent(): PointerEvent {
  if (!SENTINEL_MOVE_EVENT && typeof PointerEvent !== 'undefined') {
    SENTINEL_MOVE_EVENT = new PointerEvent('pointermove')
  }
  return SENTINEL_MOVE_EVENT!
}

function scheduleUpdate() {
  if (rafId !== null) return
  
  rafId = requestAnimationFrame(() => {
    rafId = null
    
    // Only update instances that have changes
    for (const instance of dirtyInstances) instance.update()
    dirtyInstances.clear()

    // Only schedule next frame if there are active instances with ongoing changes
    if (instances.size > 0) {
      // Check if any instances still have velocity or pending updates
      let hasActiveInstances = false
      for (const instance of instances) {
        if (instance.hasActivePointers()) {
          hasActiveInstances = true
          break
        }
      }

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
  private pointersCache: PointerState[] = []
  protected isActive = false
  protected lastUpdate = 0
  protected priority: number = 0 // Higher priority wins
  private _enabled = true
  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private holdEventTimer: ReturnType<typeof setTimeout> | null = null
  private lastTapTime = 0
  private lastTapTarget: EventTarget | null = null
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

  protected emit(event: string, data: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) handler(data)
    }
  }

  get enabled(): boolean { return this._enabled }
  set enabled(value: boolean) {
    this._enabled = value
    if (!value && this.isActive) {
      // Force end the current interaction
      this.pointers.clear()
      this.pointersCache = []
      this.isActive = false
      instances.delete(this)
      dirtyInstances.delete(this)
      if (Hyperact.activeInstance.get(this.element) === this) {
        Hyperact.activeInstance.set(this.element, null)
      }
      document.removeEventListener('pointermove', this.onPointerMove)
      document.removeEventListener('pointerup', this.onPointerUp)
      document.removeEventListener('pointercancel', this.onPointerUp)
    }
  }
  
  get interacting(): boolean {
    return this.isActive
  }

  // Static registry for coordinating multiple instances on same element
  private static elementInstances = new WeakMap<HTMLElement, Hyperact[]>()
  private static activeInstance = new WeakMap<HTMLElement, Hyperact | null>()
  private static elementListeners = new WeakMap<HTMLElement, (e: PointerEvent) => void>()
  
  constructor(element: HTMLElement, options: HyperactOptions = {}) {
    this.element = element
    this.options = {
      threshold: 3,
      preventScroll: true,
      styleCursor: true,
      ...options
    }

    // Register this instance
    this.registerInstance()

    // Optimize element for interactions (only if first instance)
    const elementInstances = Hyperact.elementInstances.get(element)
    if (elementInstances && elementInstances.length === 1) {
      element.style.touchAction = this.options.touchAction ?? 'none'
      element.style.userSelect = 'none'
      element.style.webkitUserSelect = 'none'
    }

    // Bind event handlers
    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)

    // Add listeners (only if first instance)
    if (elementInstances && elementInstances.length === 1) {
      const listener = (e: PointerEvent) => Hyperact.handleElementPointerDown(element, e)
      Hyperact.elementListeners.set(element, listener)
      element.addEventListener('pointerdown', listener)
    }
  }
  
  private registerInstance() {
    const existing = Hyperact.elementInstances.get(this.element)
    if (existing) {
      existing.push(this)
    } else {
      Hyperact.elementInstances.set(this.element, [this])
    }
  }
  
  private unregisterInstance() {
    const instances = Hyperact.elementInstances.get(this.element)
    if (!instances) return
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
  protected shouldHandleEvent(_e: PointerEvent): boolean {
    return true
  }

  private checkEventFilters(e: PointerEvent): boolean {
    const target = e.target as Element
    if (!target) return true
    if (this.options.ignoreFrom && target.closest(this.options.ignoreFrom)) return false
    if (this.options.allowFrom && !target.closest(this.options.allowFrom)) return false
    return true
  }
  
  // Static method to handle pointer events for all instances on an element
  private static handleElementPointerDown(element: HTMLElement, e: PointerEvent) {
    const instances = Hyperact.elementInstances.get(element)
    if (!instances) return
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
      const shouldHandle = instance.checkEventFilters(e) && instance.shouldHandleEvent(e)

      if (shouldHandle && instance.enabled && instance.priority > highestPriority) {
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
    // Mouse button filter
    if (this.options.mouseButtons && !(e.buttons & this.options.mouseButtons)) return

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
    this.pointersCache = Array.from(this.pointers.values())

    // Add global listeners
    if (this.pointers.size === 1) {
      document.addEventListener('pointermove', this.onPointerMove, { passive: false })
      document.addEventListener('pointerup', this.onPointerUp)
      document.addEventListener('pointercancel', this.onPointerUp)
    }

    // Hold event timer (fires onHold if pointer stays still)
    if (this.options.onHold) {
      if (this.holdEventTimer) clearTimeout(this.holdEventTimer)
      this.holdEventTimer = setTimeout(() => {
        this.holdEventTimer = null
        if (this.pointers.size > 0 && !this.isActive) {
          this.options.onHold!(this.createEvent(e))
        }
      }, this.options.holdDuration ?? 600)
    }

    // Hold delay: wait before starting the interaction
    const holdDelay = this.options.holdDelay ?? 0
    if (holdDelay > 0) {
      if (this.holdTimer) clearTimeout(this.holdTimer)
      this.holdTimer = setTimeout(() => {
        this.holdTimer = null
        if (!this.isActive && this.pointers.size > 0) {
          this.start(e)
        }
      }, holdDelay)
    } else if (this.options.threshold === 0) {
      // Start tracking if threshold is 0 and no hold delay
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
      pointer.current.x = newX
      pointer.current.y = newY
      
      // Check threshold
      if (!this.isActive) {
        const dx = pointer.current.x - pointer.start.x
        const dy = pointer.current.y - pointer.start.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance >= (this.options.threshold || 3)) {
          // Threshold exceeded — clear hold timer and start normally
          if (this.holdTimer) {
            clearTimeout(this.holdTimer)
            this.holdTimer = null
          }
          // Clear hold event timer on movement
          if (this.holdEventTimer) {
            clearTimeout(this.holdEventTimer)
            this.holdEventTimer = null
          }
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
    this.pointersCache = Array.from(this.pointers.values())

    // Clear hold timers
    if (this.holdTimer) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
    if (this.holdEventTimer) {
      clearTimeout(this.holdEventTimer)
      this.holdEventTimer = null
    }

    // Remove global listeners when no pointers
    if (this.pointers.size === 0) {
      document.removeEventListener('pointermove', this.onPointerMove)
      document.removeEventListener('pointerup', this.onPointerUp)
      document.removeEventListener('pointercancel', this.onPointerUp)

      if (this.isActive) {
        this.end(e)
      } else {
        const interactionEvent = this.createEvent(e)

        // Fire tap
        if (this.options.onTap) {
          this.options.onTap(interactionEvent)
        }
        this.emit('tap', interactionEvent)

        // Check for double tap
        const now = e.timeStamp
        if (this.options.onDoubleTap && now - this.lastTapTime < 300 && this.lastTapTarget === e.target) {
          this.options.onDoubleTap(interactionEvent)
        }

        this.lastTapTime = now
        this.lastTapTarget = e.target
      }
    }
  }
  
  private start(e: PointerEvent) {
    this.isActive = true
    instances.add(this)

    const event = this.createEvent(e)
    if (this.options.onStart) {
      this.options.onStart(event)
    }
    this.emit('start', event)
  }
  
  private end(e: PointerEvent) {
    this.isActive = false
    instances.delete(this)
    dirtyInstances.delete(this)
    
    // Clear active instance
    if (Hyperact.activeInstance.get(this.element) === this) {
      Hyperact.activeInstance.set(this.element, null)
    }
    
    const event = this.createEvent(e)
    if (this.options.onEnd) {
      this.options.onEnd(event)
    }
    this.emit('end', event)
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
        
        pointer.delta.x = dx
        pointer.delta.y = dy
        pointer.total.x = pointer.current.x - pointer.start.x
        pointer.total.y = pointer.current.y - pointer.start.y

        // Calculate velocity with smoothing
        if (dt > 0) {
          const vx = dx / dt * 1000
          const vy = dy / dt * 1000
          pointer.velocity.x = pointer.velocity.x * 0.7 + vx * 0.3
          pointer.velocity.y = pointer.velocity.y * 0.7 + vy * 0.3
        }

        pointer.previous.x = pointer.current.x
        pointer.previous.y = pointer.current.y
      }
      
      // Check if pointer still has velocity (for inertia)
      if (Math.abs(pointer.velocity.x) > 0.1 || Math.abs(pointer.velocity.y) > 0.1) {
        hasVelocity = true
      }
    })
    
    if (hasChanges) {
      // Use cached sentinel event to avoid allocation per frame
      const e = getSentinelEvent()
      const event = this.createEvent(e)
      if (this.options.onMove) {
        this.options.onMove(event)
      }
      this.emit('move', event)
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
      pointers: this.pointersCache,
      isPrimary: originalEvent.isPrimary,
      originalEvent
    }
  }
  
  destroy() {
    // Clear hold timers
    if (this.holdTimer) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
    if (this.holdEventTimer) {
      clearTimeout(this.holdEventTimer)
      this.holdEventTimer = null
    }

    // Unregister this instance
    this.unregisterInstance()
    
    // Only remove listeners if this is the last instance
    const elementInstances = Hyperact.elementInstances.get(this.element)
    if (!elementInstances || elementInstances.length === 0) {
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
    this.pointersCache = []
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