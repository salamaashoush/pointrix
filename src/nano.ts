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

export interface PointrixOptions {
  onStart?: (event: InteractionEvent) => void
  onMove?: (event: InteractionEvent) => void
  onEnd?: (event: InteractionEvent) => void
  onCancel?: (event: InteractionEvent) => void
  onTap?: (event: InteractionEvent) => void
  onDoubleTap?: (event: InteractionEvent) => void
  onHold?: (event: InteractionEvent) => void
  threshold?: number // Movement threshold before starting interaction
  preventScroll?: boolean
  holdDelay?: number // Hold delay in ms before interaction starts
  holdDuration?: number // Duration in ms before onHold fires (default 600)
  doubleTapDelay?: number // Max ms between taps to register double-tap (default 300)
  mouseButtons?: number // Bitmask: 1=left, 2=right, 4=middle. 0=any
  allowFrom?: string // CSS selector — only start if target matches
  ignoreFrom?: string // CSS selector — don't start if target matches
  touchAction?: string // CSS touch-action value (default 'none')
  styleCursor?: boolean // Whether to set cursor styles (default true)
  /**
   * Custom geometry resolver for this element. When set, every rect
   * measurement inside the library (bounds, handles, hit tests, sortable
   * item positions, etc.) goes through this function instead of
   * `element.getBoundingClientRect()`.
   *
   * Use cases:
   *  - SVG elements (DOMRect from getBoundingClientRect is in client coords
   *    but you may want element-space).
   *  - Virtualized lists where off-DOM rows have logical positions.
   *  - Canvas / WebGL overlays that project their own coordinate space.
   *  - Testing — avoids mocking getBoundingClientRect.
   */
  rectChecker?: (element: HTMLElement) => DOMRect
  /**
   * Coordinate origin for this interactable. All pointer coordinates
   * reported in events and used for hit testing are translated so the
   * origin's top-left is (0, 0).
   *
   * Pass an HTMLElement to use that element's current top-left (resolved
   * via `rectChecker` if set, else `getBoundingClientRect`), `'parent'` to
   * use the element's `offsetParent`, or `{ x, y }` for a static offset.
   *
   * Use cases: canvas editors whose coords should be relative to the
   * canvas, SVG roots, nested iframes, or any case where client-space
   * pointer coordinates are inconvenient.
   */
  origin?: HTMLElement | 'parent' | { x: number; y: number }
}

// Shared RAF scheduler for all instances.
// dirtyInstances is the only set we actually iterate per frame — we explicitly
// re-schedule from update() when an instance still needs frames (inertia, etc.),
// so there is no O(n) scan across every active instance every frame.
let rafId: number | null = null
const dirtyInstances: Set<Pointrix> = new Set()

// Cached sentinel event to avoid allocating a new PointerEvent every frame (lazily initialized)
let SENTINEL_MOVE_EVENT: PointerEvent | null = null
function getSentinelEvent(): PointerEvent {
  if (!SENTINEL_MOVE_EVENT && typeof PointerEvent !== 'undefined') {
    SENTINEL_MOVE_EVENT = new PointerEvent('pointermove')
  }
  return SENTINEL_MOVE_EVENT!
}

// Scratch array reused across frames to avoid allocating during iteration.
// dirtyInstances is drained into this, then update() runs can safely re-add.
const _pending: Pointrix[] = []

// Concurrent-interaction cap. 0 = unlimited. Matches interact.js's
// Interact.maxInteractions(n).
let _maxInteractions = 0
let _activeInteractionCount = 0

/**
 * Set the maximum number of interactions that can be active simultaneously
 * across all Pointrix instances. 0 (default) means unlimited. Matches the semantics
 * of `interact.maxInteractions(n)` from interact.js.
 */
export function setMaxInteractions(n: number): void {
  _maxInteractions = Math.max(0, n | 0)
}

export function getActiveInteractionCount(): number {
  return _activeInteractionCount
}

function scheduleUpdate() {
  if (rafId !== null) return

  rafId = requestAnimationFrame(() => {
    rafId = null
    if (dirtyInstances.size === 0) return

    // Drain the dirty set into a scratch array, then iterate. update() may
    // re-add the instance for continued animation (momentum/inertia) without
    // conflicting with Set iteration.
    let i = 0
    for (const instance of dirtyInstances) _pending[i++] = instance
    _pending.length = i
    dirtyInstances.clear()

    for (let j = 0; j < i; j++) _pending[j].update()

    // Clear references for GC
    for (let j = 0; j < i; j++) _pending[j] = null as unknown as Pointrix
    _pending.length = 0

    // Re-schedule if any instance still wants frames (inertia, momentum).
    if (dirtyInstances.size > 0) scheduleUpdate()
  })
}

export class Pointrix {
  protected element: HTMLElement
  protected options: PointrixOptions
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

  get enabled(): boolean {
    return this._enabled
  }
  set enabled(value: boolean) {
    this._enabled = value
    if (!value && this.isActive) {
      this.cancel()
    }
  }

  /**
   * Cancel an in-progress interaction. Fires onCancel/onEnd in that order,
   * clears internal state, and removes global pointer listeners. Safe to call
   * at any time — no-op when no interaction is active.
   */
  cancel(): void {
    if (!this.isActive && this.pointers.size === 0) return
    const wasActive = this.isActive
    const sentinel = getSentinelEvent()
    const cancelEvent = wasActive ? this.createEvent(sentinel) : null

    this.pointers.clear()
    this.pointersCache.length = 0
    this.isActive = false
    if (wasActive && _activeInteractionCount > 0) _activeInteractionCount--
    dirtyInstances.delete(this)
    if (Pointrix.activeInstance.get(this.element) === this) {
      Pointrix.activeInstance.set(this.element, null)
    }
    this.clearHoldTimers()
    this.removeDocumentListeners()

    if (cancelEvent) {
      this.options.onCancel?.(cancelEvent)
      this.options.onEnd?.(cancelEvent)
    }
  }

  private clearHoldTimers(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
    if (this.holdEventTimer) {
      clearTimeout(this.holdEventTimer)
      this.holdEventTimer = null
    }
  }

  private removeDocumentListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)
    document.removeEventListener('pointercancel', this.onPointerUp)
  }

  /**
   * Return a rect for `el` (default: `this.element`), routed through
   * `rectChecker` if configured. Prefer this over direct
   * `element.getBoundingClientRect()` calls so custom geometry consistently
   * applies to parent / bounds / related elements too.
   */
  getRect(el: HTMLElement = this.element): DOMRect {
    return this.options.rectChecker ? this.options.rectChecker(el) : el.getBoundingClientRect()
  }

  /**
   * Return the origin offset `(ox, oy)` that the library subtracts from raw
   * pointer clientX/Y before reporting them. Resolved lazily each call so
   * scroll/resize are followed transparently.
   *
   * Returns a fresh object — safe to store and read at any time. Internal
   * hot paths avoid this in favor of `resolveOriginInto()` to prevent
   * per-frame allocation.
   */
  getOrigin(): { x: number; y: number } {
    const out = { x: 0, y: 0 }
    this.resolveOriginInto(out)
    return out
  }

  /** Write the current origin offset into `out`. Zero-allocation. */
  private resolveOriginInto(out: { x: number; y: number }): void {
    const origin = this.options.origin
    if (!origin) {
      out.x = 0
      out.y = 0
      return
    }
    if (origin === 'parent') {
      const parent = this.element.offsetParent as HTMLElement | null
      if (!parent) {
        out.x = 0
        out.y = 0
        return
      }
      const r = this.getRect(parent)
      out.x = r.left
      out.y = r.top
      return
    }
    if (origin instanceof HTMLElement) {
      const r = this.getRect(origin)
      out.x = r.left
      out.y = r.top
      return
    }
    out.x = origin.x
    out.y = origin.y
  }
  /** Per-instance scratch that `resolveOriginInto` writes into on hot paths. */
  private _originScratch = { x: 0, y: 0 }

  /** Mutate the existing pointersCache in place (pointerdown/up are rare, but no reason to allocate). */
  private rebuildPointersCache(): void {
    const cache = this.pointersCache
    cache.length = 0
    for (const p of this.pointers.values()) cache.push(p)
  }

  /**
   * Update options in place — no teardown, no listener churn.
   * Safe to call mid-interaction. Options that trigger element-style side
   * effects (touchAction) are re-applied here.
   *
   * Callbacks are replaced directly; most React hook integrations route
   * callbacks through a stable ref and never call this path for them.
   */
  updateOptions(partial: Partial<PointrixOptions>): void {
    Object.assign(this.options, partial)
    // Side effects for the few options that touch element styles
    if ('touchAction' in partial) {
      this.element.style.touchAction = this.options.touchAction ?? 'none'
    }
  }

  get interacting(): boolean {
    return this.isActive
  }

  // Static registry for coordinating multiple instances on same element
  private static elementInstances = new WeakMap<HTMLElement, Pointrix[]>()
  private static activeInstance = new WeakMap<HTMLElement, Pointrix | null>()
  private static elementListeners = new WeakMap<HTMLElement, (e: PointerEvent) => void>()

  constructor(element: HTMLElement, options: PointrixOptions = {}) {
    this.element = element
    this.options = {
      threshold: 3,
      preventScroll: true,
      styleCursor: true,
      ...options,
    }

    // Register this instance
    this.registerInstance()

    // Optimize element for interactions (only if first instance)
    const elementInstances = Pointrix.elementInstances.get(element)
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
      const listener = (e: PointerEvent) => Pointrix.handleElementPointerDown(element, e)
      Pointrix.elementListeners.set(element, listener)
      element.addEventListener('pointerdown', listener)
    }
  }

  private registerInstance() {
    const existing = Pointrix.elementInstances.get(this.element)
    if (existing) {
      existing.push(this)
    } else {
      Pointrix.elementInstances.set(this.element, [this])
    }
  }

  private unregisterInstance() {
    const instances = Pointrix.elementInstances.get(this.element)
    if (!instances) return
    const index = instances.indexOf(this)
    if (index >= 0) {
      instances.splice(index, 1)
      if (instances.length === 0) {
        Pointrix.elementInstances.delete(this.element)
        Pointrix.activeInstance.delete(this.element)
        Pointrix.elementListeners.delete(this.element)
      } else {
        Pointrix.elementInstances.set(this.element, instances)
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
    const instances = Pointrix.elementInstances.get(element)
    if (!instances) return
    const activeInstance = Pointrix.activeInstance.get(element)

    // If there's already an active instance, let it continue
    if (activeInstance) {
      activeInstance.onPointerDown(e)
      return
    }

    // Check all instances to see which should handle this event
    let handlingInstance: Pointrix | null = null
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
      Pointrix.activeInstance.set(element, handlingInstance)
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

    // Translate into origin-local space if the user configured an origin.
    // Without an origin, (ox, oy) is (0, 0) and this is a free identity op.
    this.resolveOriginInto(this._originScratch)
    const x = e.clientX - this._originScratch.x
    const y = e.clientY - this._originScratch.y
    const pointer: PointerState = {
      id: e.pointerId,
      start: { x, y },
      current: { x, y },
      previous: { x, y },
      delta: { x: 0, y: 0 },
      total: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      timestamp: e.timeStamp,
    }

    this.pointers.set(e.pointerId, pointer)
    this.rebuildPointersCache()

    // Add global listeners. Only ask for a non-passive pointermove if we
    // might call preventDefault to block scroll — passive listeners let the
    // browser skip its synchronous main-thread block per event, which makes
    // non-interacting touch scrolls smoother.
    if (this.pointers.size === 1) {
      document.addEventListener('pointermove', this.onPointerMove, {
        passive: !this.options.preventScroll,
      })
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

    // Origin translates every reported coord so downstream math (threshold,
    // deltas, totals, dropzone hit tests) is consistent with what the user
    // configured. No-op when origin is absent.
    this.resolveOriginInto(this._originScratch)
    const newX = e.clientX - this._originScratch.x
    const newY = e.clientY - this._originScratch.y

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
        dirtyInstances.add(this)
        scheduleUpdate()
      }
    }
  }

  private onPointerUp(e: PointerEvent) {
    const pointer = this.pointers.get(e.pointerId)
    if (!pointer) return

    this.pointers.delete(e.pointerId)
    this.rebuildPointersCache()

    // Clear hold timers
    this.clearHoldTimers()

    // Remove global listeners when no pointers
    if (this.pointers.size === 0) {
      this.removeDocumentListeners()

      if (this.isActive) {
        this.end(e)
      } else {
        const interactionEvent = this.createEvent(e)

        // Fire tap
        if (this.options.onTap) {
          this.options.onTap(interactionEvent)
        }

        // Check for double tap
        const now = e.timeStamp
        const doubleTapDelay = this.options.doubleTapDelay ?? 300
        if (this.options.onDoubleTap && now - this.lastTapTime < doubleTapDelay && this.lastTapTarget === e.target) {
          this.options.onDoubleTap(interactionEvent)
        }

        this.lastTapTime = now
        this.lastTapTarget = e.target
      }
    }
  }

  private start(e: PointerEvent) {
    // Honor the global concurrent-interaction cap. If we're at the limit,
    // drop the pointer silently — the interaction will never activate. This
    // matches interact.js's behavior with `Interact.maxInteractions(n)`.
    if (_maxInteractions > 0 && _activeInteractionCount >= _maxInteractions) {
      this.pointers.delete(e.pointerId)
      this.rebuildPointersCache()
      return
    }

    this.isActive = true
    _activeInteractionCount++

    const event = this.createEvent(e)
    if (this.options.onStart) {
      this.options.onStart(event)
    }
  }

  /**
   * Programmatically start an interaction from a PointerEvent. Registers the
   * pointer, wires up the document-level move/up listeners, and forces the
   * interaction to begin immediately — regardless of movement threshold or
   * hold delay. Useful for triggering a drag from a non-pointerdown source
   * (keyboard activation, custom "drag from here" button, etc.).
   *
   * The caller must pass an in-flight PointerEvent, typically captured from
   * their own pointerdown handler.
   */
  startFromEvent(e: PointerEvent): void {
    if (this.isActive || this.pointers.has(e.pointerId)) return
    Pointrix.activeInstance.set(this.element, this)
    this.handlePointerDown(e)
    // handlePointerDown may or may not start depending on threshold/holdDelay.
    // Force the start — programmatic callers want an immediately-active drag.
    if (!this.isActive) this.start(e)
  }

  private end(e: PointerEvent) {
    this.isActive = false
    dirtyInstances.delete(this)
    if (_activeInteractionCount > 0) _activeInteractionCount--

    // Clear active instance
    if (Pointrix.activeInstance.get(this.element) === this) {
      Pointrix.activeInstance.set(this.element, null)
    }

    const event = this.createEvent(e)
    if (this.options.onEnd) {
      this.options.onEnd(event)
    }
  }

  update() {
    if (!this.isActive || this.pointers.size === 0) return

    const now = performance.now()
    const dt = this.lastUpdate === 0 ? 16 : now - this.lastUpdate
    this.lastUpdate = now

    // Frame-rate-independent exponential smoothing.
    // Target time constant ~50ms: alpha = 1 - exp(-dt / 50).
    // At 60fps (dt=16.7) → alpha ≈ 0.28; at 120fps (dt=8.3) → alpha ≈ 0.15.
    // Keeps velocity response consistent across refresh rates.
    const alpha = dt > 0 ? 1 - Math.exp(-dt / 50) : 0.3

    let hasChanges = false

    // for..of on Map.values() is reliable and avoids the callback overhead
    // of forEach inside a hot path.
    for (const pointer of this.pointers.values()) {
      const dx = pointer.current.x - pointer.previous.x
      const dy = pointer.current.y - pointer.previous.y

      if (dx !== 0 || dy !== 0) {
        hasChanges = true

        pointer.delta.x = dx
        pointer.delta.y = dy
        pointer.total.x = pointer.current.x - pointer.start.x
        pointer.total.y = pointer.current.y - pointer.start.y

        if (dt > 0) {
          const vx = (dx / dt) * 1000
          const vy = (dy / dt) * 1000
          pointer.velocity.x = pointer.velocity.x * (1 - alpha) + vx * alpha
          pointer.velocity.y = pointer.velocity.y * (1 - alpha) + vy * alpha
        }

        pointer.previous.x = pointer.current.x
        pointer.previous.y = pointer.current.y
      } else if (dt > 0) {
        // No movement this frame: decay velocity so lift-off velocity reflects
        // a brief pause instead of stale momentum from hundreds of ms ago.
        pointer.velocity.x *= 1 - alpha
        pointer.velocity.y *= 1 - alpha
      }
    }

    if (hasChanges && this.options.onMove) {
      // Populate the cached event (allocated once per instance) instead of
      // creating a new object every frame.
      this.options.onMove(this.populateEvent(getSentinelEvent()))
    }

    // Frames are scheduled reactively from onPointerMove — the nano scheduler
    // is not an animation loop. Subsystems that want per-frame work after
    // lift-off (drag momentum, inertia modifier) manage their own RAF.
  }

  // Cached InteractionEvent — reused across every frame for this instance.
  private _cachedEvent: InteractionEvent = {
    target: null as unknown as HTMLElement,
    pointers: [],
    isPrimary: true,
    originalEvent: null as unknown as PointerEvent,
  }

  /** Mutate and return the cached InteractionEvent (avoids per-frame allocation). */
  private populateEvent(originalEvent: PointerEvent): InteractionEvent {
    const evt = this._cachedEvent
    evt.target = this.element
    evt.pointers = this.pointersCache
    evt.isPrimary = originalEvent.isPrimary
    evt.originalEvent = originalEvent
    return evt
  }

  /** Alias retained for subclasses; matches original API. */
  protected createEvent(originalEvent: PointerEvent): InteractionEvent {
    return this.populateEvent(originalEvent)
  }

  destroy() {
    this.clearHoldTimers()

    // Unregister this instance
    this.unregisterInstance()

    // Only remove listeners if this is the last instance
    const elementInstances = Pointrix.elementInstances.get(this.element)
    if (!elementInstances || elementInstances.length === 0) {
      const listener = Pointrix.elementListeners.get(this.element)
      if (listener) {
        this.element.removeEventListener('pointerdown', listener)
        Pointrix.elementListeners.delete(this.element)
      }

      this.element.style.touchAction = ''
      this.element.style.userSelect = ''
      this.element.style.webkitUserSelect = ''
    }

    // Clean up if active
    if (this.pointers.size > 0) {
      this.removeDocumentListeners()
    }

    dirtyInstances.delete(this)

    this.pointers.clear()
    this.pointersCache.length = 0
  }
}

// Simple factory function — convenience wrapper around `new Pointrix(...)`
// that accepts either an element reference or a CSS selector.
export function pointrix(element: HTMLElement | string, options?: PointrixOptions): Pointrix {
  const el = typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element

  if (!el) throw new Error(`Element not found: ${element}`)

  return new Pointrix(el, options)
}

export default pointrix
