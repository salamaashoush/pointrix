// Multi-touch gesture system for pinch/rotate/pan

import { Grip, type InteractionEvent, type Point, type GripOptions } from './nano'

export interface GestureEvent extends InteractionEvent {
  scale: number
  rotation: number
  distance: number
  angle: number
  center: Point
  deltaScale: number
  deltaAngle: number
}

export interface GestureOptions extends GripOptions {
  minPointers?: number
  onGestureStart?: (event: GestureEvent) => void
  onGestureMove?: (event: GestureEvent) => void
  onGestureEnd?: (event: GestureEvent) => void
}

export class Gesturable extends Grip {
  private gestureOptions: GestureOptions
  private gestureActive = false
  private startDistance = 0
  private startAngle = 0
  private prevScale = 1
  private prevAngle = 0
  private minPointers: number

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

  private getTwoPointers(): [Point, Point] | null {
    if (this.pointers.size < 2) return null
    const iter = this.pointers.values()
    const p1 = iter.next().value!
    const p2 = iter.next().value!
    return [p1.current, p2.current]
  }

  private computeDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private computeAngle(p1: Point, p2: Point): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
  }

  private computeCenter(p1: Point, p2: Point): Point {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    }
  }

  private normalizeAngleDelta(delta: number): number {
    // Handle wraparound: keep delta in [-180, 180]
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    return delta
  }

  private createGestureEvent(base: InteractionEvent, overrides: Partial<GestureEvent>): GestureEvent {
    return {
      ...base,
      scale: overrides.scale ?? 1,
      rotation: overrides.rotation ?? 0,
      distance: overrides.distance ?? 0,
      angle: overrides.angle ?? 0,
      center: overrides.center ?? { x: 0, y: 0 },
      deltaScale: overrides.deltaScale ?? 0,
      deltaAngle: overrides.deltaAngle ?? 0
    }
  }

  update() {
    if (!this.isActive || this.pointers.size === 0) return

    const pair = this.getTwoPointers()

    // Start gesture when we first reach enough pointers
    if (!this.gestureActive && pair && this.pointers.size >= this.minPointers) {
      this.gestureActive = true
      const [p1, p2] = pair
      this.startDistance = this.computeDistance(p1, p2)
      this.startAngle = this.computeAngle(p1, p2)
      this.prevScale = 1
      this.prevAngle = 0

      const baseEvent: InteractionEvent = {
        target: this.element,
        pointers: Array.from(this.pointers.values()),
        isPrimary: false,
        originalEvent: new PointerEvent('pointermove')
      }
      const gestureStartEvent = this.createGestureEvent(baseEvent, {
        scale: 1,
        rotation: 0,
        distance: this.startDistance,
        angle: this.startAngle,
        center: this.computeCenter(p1, p2),
        deltaScale: 0,
        deltaAngle: 0
      })
      if (this.gestureOptions.onGestureStart) {
        this.gestureOptions.onGestureStart(gestureStartEvent)
      }
      this.emit('gesturestart', gestureStartEvent)
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
    if (this.gestureActive && pair) {
      const [p1, p2] = pair
      const distance = this.computeDistance(p1, p2)
      const angle = this.computeAngle(p1, p2)
      const center = this.computeCenter(p1, p2)
      const scale = this.startDistance > 0 ? distance / this.startDistance : 1
      const rotation = this.normalizeAngleDelta(angle - this.startAngle)
      const deltaScale = scale - this.prevScale
      const deltaAngle = this.normalizeAngleDelta(rotation - this.prevAngle)

      this.prevScale = scale
      this.prevAngle = rotation

      const baseEvent: InteractionEvent = {
        target: this.element,
        pointers: Array.from(this.pointers.values()),
        isPrimary: false,
        originalEvent: new PointerEvent('pointermove')
      }
      const gestureMoveEvent = this.createGestureEvent(baseEvent, {
        scale,
        rotation,
        distance,
        angle,
        center,
        deltaScale,
        deltaAngle
      })
      if (this.gestureOptions.onGestureMove) {
        this.gestureOptions.onGestureMove(gestureMoveEvent)
      }
      this.emit('gesturemove', gestureMoveEvent)
    }

    // Let the base class handle pointer state updates (velocity, delta, previous)
    super.update()
  }

  private endGesture() {
    if (!this.gestureActive) return
    this.gestureActive = false

    const baseEvent: InteractionEvent = {
      target: this.element,
      pointers: Array.from(this.pointers.values()),
      isPrimary: false,
      originalEvent: new PointerEvent('pointerup')
    }

    const pair = this.getTwoPointers()
    const distance = pair ? this.computeDistance(pair[0], pair[1]) : 0
    const angle = pair ? this.computeAngle(pair[0], pair[1]) : 0
    const center = pair ? this.computeCenter(pair[0], pair[1]) : { x: 0, y: 0 }
    const scale = this.startDistance > 0 && distance > 0 ? distance / this.startDistance : this.prevScale

    const gestureEndEvent = this.createGestureEvent(baseEvent, {
      scale,
      rotation: this.prevAngle,
      distance,
      angle,
      center,
      deltaScale: 0,
      deltaAngle: 0
    })
    if (this.gestureOptions.onGestureEnd) {
      this.gestureOptions.onGestureEnd(gestureEndEvent)
    }
    this.emit('gestureend', gestureEndEvent)
  }

  destroy() {
    if (this.gestureActive) {
      this.endGesture()
    }
    super.destroy()
  }
}

export function gesturable(element: HTMLElement | string, options?: GestureOptions): Gesturable {
  const el = typeof element === 'string'
    ? document.querySelector<HTMLElement>(element)
    : element

  if (!el) throw new Error(`Element not found: ${element}`)

  return new Gesturable(el, options)
}

export default gesturable
