import type { Modifier, ModifierContext } from '../types'

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

  modify(context: ModifierContext): void {
    const size = context.size
    if (!size) return
    const { min, max } = this.options

    if (min?.width !== undefined) size.width = Math.max(size.width, min.width)
    if (min?.height !== undefined) size.height = Math.max(size.height, min.height)
    if (max?.width !== undefined) size.width = Math.min(size.width, max.width)
    if (max?.height !== undefined) size.height = Math.min(size.height, max.height)
  }
}

export function restrictSize(options: RestrictSizeOptions): RestrictSizeModifier {
  return new RestrictSizeModifier(options)
}
