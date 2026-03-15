import type { Modifier, ModifierContext, ModifierResult } from '../types'

export interface SnapGridOptions {
  x: number
  y: number
  offset?: { x: number; y: number }
  limits?: { top?: number; left?: number; bottom?: number; right?: number }
}

export class SnapGridModifier implements Modifier {
  public name = 'snap-grid'
  private options: SnapGridOptions

  constructor(options: SnapGridOptions) {
    this.options = options
  }

  modify(context: ModifierContext): ModifierResult {
    const { x: gridX, y: gridY, offset, limits } = this.options
    const ox = offset?.x ?? 0
    const oy = offset?.y ?? 0

    let snappedX = Math.round((context.position.x - ox) / gridX) * gridX + ox
    let snappedY = Math.round((context.position.y - oy) / gridY) * gridY + oy

    if (limits) {
      if (limits.left !== undefined) snappedX = Math.max(snappedX, limits.left)
      if (limits.right !== undefined) snappedX = Math.min(snappedX, limits.right)
      if (limits.top !== undefined) snappedY = Math.max(snappedY, limits.top)
      if (limits.bottom !== undefined) snappedY = Math.min(snappedY, limits.bottom)
    }

    return {
      position: { x: snappedX, y: snappedY },
      velocity: context.velocity,
      size: context.size,
    }
  }
}

export function snapGrid(options: SnapGridOptions): SnapGridModifier {
  return new SnapGridModifier(options)
}
