// Multi-touch gesture system for pinch/rotate/pan

import { Pointrix, type InteractionEvent, type Point, type PointrixOptions, type PointerState } from './nano'

export interface GestureEvent extends InteractionEvent {
  scale: number
  rotation: number
  distance: number
  angle: number
  center: Point
  deltaScale: number
  deltaAngle: number
}

export interface GestureOptions extends PointrixOptions {
  minPointers?: number
  onGestureStart?: (event: GestureEvent) => void
  onGestureMove?: (event: GestureEvent) => void
  onGestureEnd?: (event: GestureEvent) => void
}

const RAD_TO_DEG = 180 / Math.PI

export class Gesturable extends Pointrix {
  private gestureOptions: GestureOptions
  private gestureActive = false
  private startDistance = 0
  private startAngle = 0
  private prevScale = 1
  private prevAngle = 0
  private minPointers: number

  // Reused scratch pointers — avoids allocating [Point, Point] per frame.
  private _p1: PointerState | null = null
  private _p2: PointerState | null = null

  // Cached gesture event — mutated in place, reused every frame.
  private _cachedGestureEvent: GestureEvent = {
    target: null as unknown as HTMLElement,
    pointers: [],
    isPrimary: false,
    originalEvent: null as unknown as PointerEvent,
    scale: 1,
    rotation: 0,
    distance: 0,
    angle: 0,
    center: { x: 0, y: 0 },
    deltaScale: 0,
    deltaAngle: 0,
  }

  constructor(element: HTMLElement, options: GestureOptions = {}) {
    super(element, { ...options, threshold: 0 })
    this.gestureOptions = options
    this.minPointers = options.minPointers ?? 2
    this.priority = 15
  }

  protected shouldHandleEvent(_e: PointerEvent): boolean {
    // Accept all pointer downs — we need to collect pointers
    // Gesture activation happens when we reach minPointers
    return true
  }

  /** Populates _p1/_p2 from the first two pointers. Returns true if both present. */
  private selectTwoPointers(): boolean {
    if (this.pointers.size < 2) {
      this._p1 = this._p2 = null
      return false
    }
    const iter = this.pointers.values()
    this._p1 = iter.next().value as PointerState
    this._p2 = iter.next().value as PointerState
    return true
  }

  private distanceBetween(a: Point, b: Point): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private angleBetween(a: Point, b: Point): number {
    return Math.atan2(b.y - a.y, b.x - a.x) * RAD_TO_DEG
  }

  private normalizeAngleDelta(delta: number): number {
    // Handle wraparound: keep delta in [-180, 180]
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    return delta
  }

  /** Populate the cached gesture event with the current state. */
  private buildEvent(
    distance: number,
    angle: number,
    scale: number,
    rotation: number,
    deltaScale: number,
    deltaAngle: number,
    cx: number,
    cy: number,
  ): GestureEvent {
    const evt = this._cachedGestureEvent
    evt.target = this.element
    // Reuse base Pointrix's pointer cache — avoids Array.from() per frame.
    evt.pointers = (this as unknown as { pointersCache: PointerState[] }).pointersCache
    evt.isPrimary = false
    // originalEvent is intentionally the sentinel — gestures are synthesized
    // across multiple real pointer events and don't correspond to a single one.
    evt.originalEvent = evt.originalEvent ?? ({} as PointerEvent)
    evt.scale = scale
    evt.rotation = rotation
    evt.distance = distance
    evt.angle = angle
    evt.center.x = cx
    evt.center.y = cy
    evt.deltaScale = deltaScale
    evt.deltaAngle = deltaAngle
    return evt
  }

  update() {
    if (!this.isActive || this.pointers.size === 0) return

    const hasPair = this.selectTwoPointers()

    // Start gesture when we first reach enough pointers
    if (!this.gestureActive && hasPair && this.pointers.size >= this.minPointers) {
      this.gestureActive = true
      const c1 = this._p1!.current
      const c2 = this._p2!.current
      this.startDistance = this.distanceBetween(c1, c2)
      this.startAngle = this.angleBetween(c1, c2)
      this.prevScale = 1
      this.prevAngle = 0

      const gestureStartEvent = this.buildEvent(
        this.startDistance,
        this.startAngle,
        1,
        0,
        0,
        0,
        (c1.x + c2.x) / 2,
        (c1.y + c2.y) / 2,
      )
      if (this.gestureOptions.onGestureStart) {
        this.gestureOptions.onGestureStart(gestureStartEvent)
      }
      return
    }

    // End gesture if we drop below minPointers
    if (this.gestureActive && this.pointers.size < this.minPointers) {
      this.endGesture()
      // Still call super for base class bookkeeping
      super.update()
      return
    }

    // Fire gesture move when active with enough pointers
    if (this.gestureActive && hasPair) {
      const c1 = this._p1!.current
      const c2 = this._p2!.current
      const distance = this.distanceBetween(c1, c2)
      const angle = this.angleBetween(c1, c2)
      const scale = this.startDistance > 0 ? distance / this.startDistance : 1
      const rotation = this.normalizeAngleDelta(angle - this.startAngle)
      const deltaScale = scale - this.prevScale
      const deltaAngle = this.normalizeAngleDelta(rotation - this.prevAngle)

      this.prevScale = scale
      this.prevAngle = rotation

      if (this.gestureOptions.onGestureMove) {
        this.gestureOptions.onGestureMove(
          this.buildEvent(
            distance,
            angle,
            scale,
            rotation,
            deltaScale,
            deltaAngle,
            (c1.x + c2.x) / 2,
            (c1.y + c2.y) / 2,
          ),
        )
      }
    }

    // Let the base class handle pointer state updates (velocity, delta, previous)
    super.update()
  }

  private endGesture() {
    if (!this.gestureActive) return
    this.gestureActive = false

    const hasPair = this.selectTwoPointers()
    const c1 = hasPair ? this._p1!.current : null
    const c2 = hasPair ? this._p2!.current : null
    const distance = c1 && c2 ? this.distanceBetween(c1, c2) : 0
    const angle = c1 && c2 ? this.angleBetween(c1, c2) : 0
    const cx = c1 && c2 ? (c1.x + c2.x) / 2 : 0
    const cy = c1 && c2 ? (c1.y + c2.y) / 2 : 0
    const scale = this.startDistance > 0 && distance > 0 ? distance / this.startDistance : this.prevScale

    if (this.gestureOptions.onGestureEnd) {
      this.gestureOptions.onGestureEnd(this.buildEvent(distance, angle, scale, this.prevAngle, 0, 0, cx, cy))
    }
  }

  /**
   * Update gesture options in place. Safe mid-gesture — new callbacks fire
   * from the next frame; `minPointers` change takes effect immediately.
   */
  updateOptions(partial: Partial<GestureOptions>): void {
    super.updateOptions(partial)
    Object.assign(this.gestureOptions, partial)
    if (partial.minPointers !== undefined) this.minPointers = partial.minPointers
  }

  destroy() {
    if (this.gestureActive) {
      this.endGesture()
    }
    super.destroy()
  }
}

export function gesturable(element: HTMLElement | string, options?: GestureOptions): Gesturable {
  const el = typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element

  if (!el) throw new Error(`Element not found: ${element}`)

  return new Gesturable(el, options)
}

export default gesturable
