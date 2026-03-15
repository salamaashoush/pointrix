import type { Modifier, ModifierContext, ModifierResult, Point } from '../types'

export interface RestrictOptions {
  bounds?: 'parent' | HTMLElement | { left?: number; top?: number; right?: number; bottom?: number }
  elementRect?: { left: number; top: number; right: number; bottom: number }
  endOnly?: boolean
}

export class RestrictModifier implements Modifier {
  public name = 'restrict'
  private options: RestrictOptions
  private transformBounds: { left?: number; top?: number; right?: number; bottom?: number } | null = null

  constructor(options: RestrictOptions) {
    this.options = options
  }

  onStart(context: ModifierContext): void {
    this.transformBounds = this.resolveTransformBounds(context.element, context.startPosition, context.size)
  }

  modify(context: ModifierContext): ModifierResult {
    // Lazy init: if onStart wasn't called (e.g., used standalone), resolve now
    if (!this.transformBounds) {
      this.resolveAndCache(context)
    }

    if (this.options.endOnly) {
      return {
        position: context.position,
        velocity: context.velocity,
        size: context.size,
      }
    }

    return this.applyRestriction(context)
  }

  onEnd(context: ModifierContext): ModifierResult {
    if (!this.transformBounds) {
      this.resolveAndCache(context)
    }
    return this.applyRestriction(context)
  }

  private resolveAndCache(context: ModifierContext) {
    this.transformBounds = this.resolveTransformBounds(
      context.element, context.startPosition, context.size
    )
  }

  private applyRestriction(context: ModifierContext): ModifierResult {
    const bounds = this.transformBounds

    if (!bounds) {
      return {
        position: context.position,
        velocity: context.velocity,
        size: context.size,
      }
    }

    let x = context.position.x
    let y = context.position.y

    if (bounds.left !== undefined) x = Math.max(x, bounds.left)
    if (bounds.top !== undefined) y = Math.max(y, bounds.top)
    if (bounds.right !== undefined) x = Math.min(x, bounds.right)
    if (bounds.bottom !== undefined) y = Math.min(y, bounds.bottom)

    return {
      position: { x, y },
      velocity: context.velocity,
      size: context.size,
    }
  }

  private resolveTransformBounds(
    element: HTMLElement,
    startTransform: Point,
    size?: { width: number; height: number }
  ): { left?: number; top?: number; right?: number; bottom?: number } | null {
    const { bounds } = this.options

    if (!bounds) return null

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
    } else if (bounds instanceof HTMLElement) {
      const rect = bounds.getBoundingClientRect()
      pageBounds = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      }
    } else {
      // Custom bounds — assume they're already in transform space
      return bounds
    }

    // Convert page bounds to transform space
    const rect = element.getBoundingClientRect()
    const baseX = rect.left - startTransform.x
    const baseY = rect.top - startTransform.y
    const elW = size?.width ?? rect.width
    const elH = size?.height ?? rect.height

    const elementRect = this.options.elementRect

    if (elementRect) {
      return {
        left: pageBounds.left !== undefined ? pageBounds.left - baseX - elW * elementRect.left : undefined,
        top: pageBounds.top !== undefined ? pageBounds.top - baseY - elH * elementRect.top : undefined,
        right: pageBounds.right !== undefined ? pageBounds.right - baseX - elW * elementRect.right : undefined,
        bottom: pageBounds.bottom !== undefined ? pageBounds.bottom - baseY - elH * elementRect.bottom : undefined,
      }
    }

    return {
      left: pageBounds.left !== undefined ? pageBounds.left - baseX : undefined,
      top: pageBounds.top !== undefined ? pageBounds.top - baseY : undefined,
      right: pageBounds.right !== undefined ? pageBounds.right - baseX - elW : undefined,
      bottom: pageBounds.bottom !== undefined ? pageBounds.bottom - baseY - elH : undefined,
    }
  }
}

export function restrict(options: RestrictOptions): RestrictModifier {
  return new RestrictModifier(options)
}
