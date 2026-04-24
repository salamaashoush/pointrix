import type { Modifier, ModifierContext } from '../types'

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

  modify(context: ModifierContext): void {
    const { x: gridX, y: gridY, offset, limits } = this.options
    const ox = offset?.x ?? 0
    const oy = offset?.y ?? 0

    let x = Math.round((context.position.x - ox) / gridX) * gridX + ox
    let y = Math.round((context.position.y - oy) / gridY) * gridY + oy

    if (limits) {
      if (limits.left !== undefined) x = Math.max(x, limits.left)
      if (limits.right !== undefined) x = Math.min(x, limits.right)
      if (limits.top !== undefined) y = Math.max(y, limits.top)
      if (limits.bottom !== undefined) y = Math.min(y, limits.bottom)
    }

    context.position.x = x
    context.position.y = y
  }
}

export function snapGrid(options: SnapGridOptions): SnapGridModifier {
  return new SnapGridModifier(options)
}
