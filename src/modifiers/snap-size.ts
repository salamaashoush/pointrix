import type { Modifier, ModifierContext, ModifierResult } from '../types'

export interface SnapSizeOptions {
  width?: number
  height?: number
  offset?: { width?: number; height?: number }
}

export class SnapSizeModifier implements Modifier {
  public name = 'snapSize'
  private options: SnapSizeOptions

  constructor(options: SnapSizeOptions) {
    this.options = options
  }

  modify(context: ModifierContext): ModifierResult {
    if (context.size) {
      const { width: gridW, height: gridH, offset } = this.options
      const offsetW = offset?.width ?? 0
      const offsetH = offset?.height ?? 0

      if (gridW && gridW > 0) {
        context.size.width = Math.round((context.size.width - offsetW) / gridW) * gridW + offsetW
      }
      if (gridH && gridH > 0) {
        context.size.height = Math.round((context.size.height - offsetH) / gridH) * gridH + offsetH
      }
    }

    return {
      position: context.position,
      velocity: context.velocity,
      size: context.size,
    }
  }
}

export function snapSize(options: SnapSizeOptions): SnapSizeModifier {
  return new SnapSizeModifier(options)
}
