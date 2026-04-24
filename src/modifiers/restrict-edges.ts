import type { Modifier, ModifierContext } from '../types'

export interface RestrictEdgesOptions {
  /** Restriction bounds for each edge — edges can't go beyond these values */
  outer?: { left?: number; top?: number; right?: number; bottom?: number }
  /** Edges must stay within these values (can't pass toward center) */
  inner?: { left?: number; top?: number; right?: number; bottom?: number }
}

export class RestrictEdgesModifier implements Modifier {
  public name = 'restrictEdges'
  private options: RestrictEdgesOptions

  constructor(options: RestrictEdgesOptions) {
    this.options = options
  }

  modify(context: ModifierContext): void {
    const pos = context.position
    const size = context.size
    const edges = context.edges
    const { outer, inner } = this.options

    if (edges && size) {
      // Calculate current edge positions from position + size
      // position is the top-left corner
      let left = pos.x
      let top = pos.y
      let right = pos.x + size.width
      let bottom = pos.y + size.height

      // Apply outer restrictions (edges can't go beyond outer bounds)
      if (outer) {
        if (edges.left && outer.left !== undefined) {
          left = Math.max(left, outer.left)
        }
        if (edges.top && outer.top !== undefined) {
          top = Math.max(top, outer.top)
        }
        if (edges.right && outer.right !== undefined) {
          right = Math.min(right, outer.right)
        }
        if (edges.bottom && outer.bottom !== undefined) {
          bottom = Math.min(bottom, outer.bottom)
        }
      }

      // Apply inner restrictions (edges can't pass toward center beyond inner bounds)
      if (inner) {
        if (edges.left && inner.left !== undefined) {
          left = Math.min(left, inner.left)
        }
        if (edges.top && inner.top !== undefined) {
          top = Math.min(top, inner.top)
        }
        if (edges.right && inner.right !== undefined) {
          right = Math.max(right, inner.right)
        }
        if (edges.bottom && inner.bottom !== undefined) {
          bottom = Math.max(bottom, inner.bottom)
        }
      }

      // Update position and size based on which edges moved
      if (edges.left) {
        pos.x = left
        size.width = right - left
      }
      if (edges.top) {
        pos.y = top
        size.height = bottom - top
      }
      if (edges.right) {
        size.width = right - pos.x
      }
      if (edges.bottom) {
        size.height = bottom - pos.y
      }
    }
  }
}

export function restrictEdges(options: RestrictEdgesOptions): RestrictEdgesModifier {
  return new RestrictEdgesModifier(options)
}
