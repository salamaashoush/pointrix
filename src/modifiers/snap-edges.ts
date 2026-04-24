import type { Modifier, ModifierContext } from '../types'

export interface SnapEdgeTarget {
  left?: number
  top?: number
  right?: number
  bottom?: number
  range?: number
}

export interface SnapEdgesOptions {
  targets: SnapEdgeTarget[]
  range?: number
}

export class SnapEdgesModifier implements Modifier {
  public name = 'snapEdges'
  private options: SnapEdgesOptions

  constructor(options: SnapEdgesOptions) {
    this.options = options
  }

  modify(context: ModifierContext): void {
    const pos = context.position
    const size = context.size
    const edges = context.edges
    if (!edges || !size) return

    const defaultRange = this.options.range ?? 20
    let left = pos.x
    let top = pos.y
    let right = pos.x + size.width
    let bottom = pos.y + size.height

    for (const target of this.options.targets) {
      const range = target.range ?? defaultRange

      if (edges.left && target.left !== undefined && Math.abs(left - target.left) <= range) {
        const delta = target.left - left
        left = target.left
        pos.x = left
        size.width -= delta
      }

      if (edges.top && target.top !== undefined && Math.abs(top - target.top) <= range) {
        const delta = target.top - top
        top = target.top
        pos.y = top
        size.height -= delta
      }

      if (edges.right && target.right !== undefined && Math.abs(right - target.right) <= range) {
        right = target.right
        size.width = right - pos.x
      }

      if (edges.bottom && target.bottom !== undefined && Math.abs(bottom - target.bottom) <= range) {
        bottom = target.bottom
        size.height = bottom - pos.y
      }
    }
  }
}

export function snapEdges(options: SnapEdgesOptions): SnapEdgesModifier {
  return new SnapEdgesModifier(options)
}
