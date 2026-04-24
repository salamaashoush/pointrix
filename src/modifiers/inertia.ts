import type { Modifier, ModifierContext, Point } from '../types'

export interface InertiaOptions {
  resistance?: number
  minSpeed?: number
  endSpeed?: number
  smoothEnd?: boolean
  smoothEndDuration?: number
}

interface InertiaState {
  v0: Point
  lambda: number
  startTime: number
  active: boolean
  startPosition: Point
}

export class InertiaModifier implements Modifier {
  public name = 'inertia'
  private options: Required<InertiaOptions>
  private state: InertiaState | null = null

  constructor(options?: InertiaOptions) {
    this.options = {
      resistance: options?.resistance ?? 10,
      minSpeed: options?.minSpeed ?? 10,
      endSpeed: options?.endSpeed ?? 100,
      smoothEnd: options?.smoothEnd ?? false,
      smoothEndDuration: options?.smoothEndDuration ?? 300,
    }
  }

  onStart(): void {
    this.state = null
  }

  modify(context: ModifierContext): void {
    if (!this.state || !this.state.active) return

    const { v0, lambda, startTime, startPosition } = this.state
    const elapsed = (performance.now() - startTime) / 1000
    const decay = Math.exp(-lambda * elapsed)

    // v(t) = v0 * e^(-lambda * t)
    const vx = v0.x * decay
    const vy = v0.y * decay

    // position(t) = start + v0/lambda * (1 - e^(-lambda * t))
    context.position.x = startPosition.x + (v0.x / lambda) * (1 - decay)
    context.position.y = startPosition.y + (v0.y / lambda) * (1 - decay)
    context.velocity.x = vx
    context.velocity.y = vy

    if (Math.sqrt(vx * vx + vy * vy) < this.options.minSpeed) {
      this.state.active = false
    }
  }

  onEnd(context: ModifierContext): void {
    const speed = Math.sqrt(context.velocity.x ** 2 + context.velocity.y ** 2)

    if (speed < this.options.endSpeed) {
      if (this.options.smoothEnd) {
        // Smooth deceleration: stop in place with zero velocity.
        context.velocity.x = 0
        context.velocity.y = 0
      }
      return
    }

    const lambda = this.options.resistance
    // Allocate state ONCE per interaction (onEnd fires once per lift-off).
    const v0: Point = { x: context.velocity.x, y: context.velocity.y }
    this.state = {
      v0,
      lambda,
      startTime: performance.now(),
      active: true,
      startPosition: { x: context.position.x, y: context.position.y },
    }

    // Final resting position: start + v0/lambda. Mutate context in place.
    context.position.x += v0.x / lambda
    context.position.y += v0.y / lambda
    context.velocity.x = 0
    context.velocity.y = 0
  }

  isActive(): boolean {
    return this.state?.active ?? false
  }
}

export function inertia(options?: InertiaOptions): InertiaModifier {
  return new InertiaModifier(options)
}
