import type { Modifier, ModifierContext, ModifierResult, Point } from '../types'

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

  modify(context: ModifierContext): ModifierResult {
    if (!this.state || !this.state.active) {
      return {
        position: context.position,
        velocity: context.velocity,
        size: context.size,
      }
    }

    const { v0, lambda, startTime, startPosition } = this.state
    const elapsed = (performance.now() - startTime) / 1000
    const decay = Math.exp(-lambda * elapsed)

    // v(t) = v0 * e^(-lambda * t)
    const vx = v0.x * decay
    const vy = v0.y * decay

    // position(t) = start + v0/lambda * (1 - e^(-lambda * t))
    const px = startPosition.x + (v0.x / lambda) * (1 - decay)
    const py = startPosition.y + (v0.y / lambda) * (1 - decay)

    const speed = Math.sqrt(vx * vx + vy * vy)

    if (speed < this.options.minSpeed) {
      this.state.active = false
    }

    return {
      position: { x: px, y: py },
      velocity: { x: vx, y: vy },
      size: context.size,
    }
  }

  onEnd(context: ModifierContext): ModifierResult | void {
    const speed = Math.sqrt(context.velocity.x ** 2 + context.velocity.y ** 2)

    if (speed < this.options.endSpeed) {
      if (this.options.smoothEnd) {
        return this.computeSmoothEnd(context)
      }
      return
    }

    const lambda = this.options.resistance
    const v0 = { ...context.velocity }

    this.state = {
      v0,
      lambda,
      startTime: performance.now(),
      active: true,
      startPosition: { ...context.position },
    }

    // Return the final resting position: start + v0 / lambda
    return {
      position: {
        x: context.position.x + v0.x / lambda,
        y: context.position.y + v0.y / lambda,
      },
      velocity: { x: 0, y: 0 },
      size: context.size,
    }
  }

  private computeSmoothEnd(context: ModifierContext): ModifierResult {
    // Smooth deceleration to the current position (no inertia travel)
    return {
      position: context.position,
      velocity: { x: 0, y: 0 },
      size: context.size,
    }
  }

  isActive(): boolean {
    return this.state?.active ?? false
  }
}

export function inertia(options?: InertiaOptions): InertiaModifier {
  return new InertiaModifier(options)
}
