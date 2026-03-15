import type { Modifier, ModifierContext, ModifierResult } from '../types'

export interface RubberbandOptions {
  bounds: { left?: number; top?: number; right?: number; bottom?: number } | 'parent'
  /** Resistance factor 0-1 (default: 0.15). Lower = more resistance. */
  resistance?: number
  /** Max overshoot in pixels (default: 100) */
  maxOvershoot?: number
}

export class RubberbandModifier implements Modifier {
  public name = 'rubberband'
  private options: RubberbandOptions

  constructor(options: RubberbandOptions) {
    this.options = options
  }

  modify(context: ModifierContext): ModifierResult {
    const bounds = this.resolveBounds(context.element)
    const resistance = this.options.resistance ?? 0.15
    const maxOvershoot = this.options.maxOvershoot ?? 100
    const pos = { ...context.position }

    if (bounds) {
      if (bounds.left !== undefined && pos.x < bounds.left) {
        const overshoot = (pos.x - bounds.left) * resistance
        pos.x = bounds.left + Math.max(overshoot, -maxOvershoot)
      }
      if (bounds.right !== undefined && pos.x > bounds.right) {
        const overshoot = (pos.x - bounds.right) * resistance
        pos.x = bounds.right + Math.min(overshoot, maxOvershoot)
      }
      if (bounds.top !== undefined && pos.y < bounds.top) {
        const overshoot = (pos.y - bounds.top) * resistance
        pos.y = bounds.top + Math.max(overshoot, -maxOvershoot)
      }
      if (bounds.bottom !== undefined && pos.y > bounds.bottom) {
        const overshoot = (pos.y - bounds.bottom) * resistance
        pos.y = bounds.bottom + Math.min(overshoot, maxOvershoot)
      }
    }

    return {
      position: pos,
      velocity: { ...context.velocity },
      size: context.size ? { ...context.size } : undefined,
    }
  }

  onEnd(context: ModifierContext): ModifierResult {
    const bounds = this.resolveBounds(context.element)
    const pos = { ...context.position }

    if (bounds) {
      if (bounds.left !== undefined) pos.x = Math.max(pos.x, bounds.left)
      if (bounds.right !== undefined) pos.x = Math.min(pos.x, bounds.right)
      if (bounds.top !== undefined) pos.y = Math.max(pos.y, bounds.top)
      if (bounds.bottom !== undefined) pos.y = Math.min(pos.y, bounds.bottom)
    }

    return {
      position: pos,
      velocity: { ...context.velocity },
      size: context.size ? { ...context.size } : undefined,
    }
  }

  private resolveBounds(
    element: HTMLElement
  ): { left?: number; top?: number; right?: number; bottom?: number } | null {
    const { bounds } = this.options

    if (bounds === 'parent') {
      const parent = element.parentElement
      if (!parent) return null
      const parentRect = parent.getBoundingClientRect()
      return {
        left: parentRect.left,
        top: parentRect.top,
        right: parentRect.right,
        bottom: parentRect.bottom,
      }
    }

    return bounds
  }
}

export function rubberband(options: RubberbandOptions): RubberbandModifier {
  return new RubberbandModifier(options)
}
