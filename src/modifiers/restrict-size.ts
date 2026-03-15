import type { Modifier, ModifierContext, ModifierResult } from '../types'

export interface RestrictSizeOptions {
  min?: { width?: number; height?: number }
  max?: { width?: number; height?: number }
}

export class RestrictSizeModifier implements Modifier {
  public name = 'restrictSize'
  private options: RestrictSizeOptions

  constructor(options: RestrictSizeOptions) {
    this.options = options
  }

  modify(context: ModifierContext): ModifierResult {
    if (context.size) {
      const { min, max } = this.options

      if (min?.width !== undefined) context.size.width = Math.max(context.size.width, min.width)
      if (min?.height !== undefined) context.size.height = Math.max(context.size.height, min.height)
      if (max?.width !== undefined) context.size.width = Math.min(context.size.width, max.width)
      if (max?.height !== undefined) context.size.height = Math.min(context.size.height, max.height)
    }

    return {
      position: context.position,
      velocity: context.velocity,
      size: context.size,
    }
  }
}

export function restrictSize(options: RestrictSizeOptions): RestrictSizeModifier {
  return new RestrictSizeModifier(options)
}
