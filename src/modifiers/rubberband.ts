import type { Modifier, ModifierContext, ModifierResult, Point } from '../types'

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
  private transformBounds: { left?: number; top?: number; right?: number; bottom?: number } | null = null

  constructor(options: RubberbandOptions) {
    this.options = options
  }

  onStart(context: ModifierContext): void {
    // Convert page-space bounds to transform-space at drag start.
    // Transform-space bound = page bound - element's base position
    // Base position = element rect position - current transform
    this.transformBounds = this.resolveTransformBounds(context.element, context.startPosition)
  }

  modify(context: ModifierContext): ModifierResult {
    if (!this.transformBounds) {
      this.transformBounds = this.resolveTransformBounds(context.element, context.startPosition)
    }
    const bounds = this.transformBounds
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
    if (!this.transformBounds) {
      this.transformBounds = this.resolveTransformBounds(context.element, context.startPosition)
    }
    const bounds = this.transformBounds
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

  private resolveTransformBounds(
    element: HTMLElement,
    startTransform: Point
  ): { left?: number; top?: number; right?: number; bottom?: number } | null {
    const { bounds } = this.options

    let pageBounds: { left?: number; top?: number; right?: number; bottom?: number }

    if (bounds === 'parent') {
      const parent = element.parentElement
      if (!parent) return null
      const parentRect = parent.getBoundingClientRect()
      pageBounds = {
        left: parentRect.left,
        top: parentRect.top,
        right: parentRect.right,
        bottom: parentRect.bottom,
      }
    } else {
      pageBounds = bounds
    }

    // Convert page bounds to transform space:
    // element's base position (without transform) = rect - transform
    const rect = element.getBoundingClientRect()
    const baseX = rect.left - startTransform.x
    const baseY = rect.top - startTransform.y
    const elW = rect.width
    const elH = rect.height

    return {
      left: pageBounds.left !== undefined ? pageBounds.left - baseX : undefined,
      top: pageBounds.top !== undefined ? pageBounds.top - baseY : undefined,
      right: pageBounds.right !== undefined ? pageBounds.right - baseX - elW : undefined,
      bottom: pageBounds.bottom !== undefined ? pageBounds.bottom - baseY - elH : undefined,
    }
  }
}

export function rubberband(options: RubberbandOptions): RubberbandModifier {
  return new RubberbandModifier(options)
}
