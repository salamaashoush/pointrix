import type { Modifier, ModifierContext, ModifierResult } from '../types'

export interface RestrictOptions {
  bounds?: 'parent' | HTMLElement | { left?: number; top?: number; right?: number; bottom?: number }
  elementRect?: { left: number; top: number; right: number; bottom: number }
  endOnly?: boolean
}

export class RestrictModifier implements Modifier {
  public name = 'restrict'
  private options: RestrictOptions

  constructor(options: RestrictOptions) {
    this.options = options
  }

  modify(context: ModifierContext): ModifierResult {
    if (this.options.endOnly) {
      return {
        position: { ...context.position },
        velocity: { ...context.velocity },
        size: context.size ? { ...context.size } : undefined,
      }
    }

    return this.applyRestriction(context)
  }

  onEnd(context: ModifierContext): ModifierResult {
    return this.applyRestriction(context)
  }

  private applyRestriction(context: ModifierContext): ModifierResult {
    const bounds = this.resolveBounds(context.element)

    if (!bounds) {
      return {
        position: { ...context.position },
        velocity: { ...context.velocity },
        size: context.size ? { ...context.size } : undefined,
      }
    }

    const pos = { ...context.position }
    const elementRect = this.options.elementRect

    if (elementRect && context.size) {
      const { width, height } = context.size
      const offsetLeft = width * elementRect.left
      const offsetTop = height * elementRect.top
      const offsetRight = width * elementRect.right
      const offsetBottom = height * elementRect.bottom

      if (bounds.left !== undefined) {
        pos.x = Math.max(pos.x, bounds.left - offsetLeft)
      }
      if (bounds.top !== undefined) {
        pos.y = Math.max(pos.y, bounds.top - offsetTop)
      }
      if (bounds.right !== undefined) {
        pos.x = Math.min(pos.x, bounds.right - offsetRight)
      }
      if (bounds.bottom !== undefined) {
        pos.y = Math.min(pos.y, bounds.bottom - offsetBottom)
      }
    } else {
      if (bounds.left !== undefined) {
        pos.x = Math.max(pos.x, bounds.left)
      }
      if (bounds.top !== undefined) {
        pos.y = Math.max(pos.y, bounds.top)
      }
      if (bounds.right !== undefined) {
        pos.x = Math.min(pos.x, bounds.right)
      }
      if (bounds.bottom !== undefined) {
        pos.y = Math.min(pos.y, bounds.bottom)
      }
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

    if (!bounds) return null

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

    if (bounds instanceof HTMLElement) {
      const rect = bounds.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      }
    }

    return bounds
  }
}

export function restrict(options: RestrictOptions): RestrictModifier {
  return new RestrictModifier(options)
}
