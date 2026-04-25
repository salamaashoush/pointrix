import type { Modifier, ModifierContext, Point } from '../types'

export interface SnapTarget {
  /** X coordinate of the target */
  x?: number
  /** Y coordinate of the target */
  y?: number
  /** Snap range in pixels (default: global range) */
  range?: number
}

/** Preset pivot positions */
export type PivotPreset =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

const PIVOT_PRESETS: Record<PivotPreset, { x: number; y: number }> = {
  'top-left': { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 },
}

/** Resolve a pivot value — accepts a preset string or {x,y} object */
export function resolvePivot(pivot: PivotPreset | { x: number; y: number }): { x: number; y: number } {
  if (typeof pivot === 'string') return PIVOT_PRESETS[pivot] ?? PIVOT_PRESETS['top-left']
  return pivot
}

export interface SnapTargetsOptions {
  /** Array of snap target positions */
  targets: SnapTarget[]
  /** Default snap range in pixels (default: 50) */
  range?: number
  /**
   * Pivot point(s) on the element to check for snapping.
   * Accepts preset strings or {x,y} where 0-1 maps to element dimensions.
   *
   * Presets: 'top-left', 'top', 'top-right', 'left', 'center', 'right',
   *          'bottom-left', 'bottom', 'bottom-right'
   *
   * Default: 'top-left'
   */
  relativePoints?: Array<PivotPreset | { x: number; y: number }>
  /**
   * Coordinate mode:
   * - 'offset' (default): targets are transform offsets
   * - 'parent': targets are positions relative to the parent element's top-left
   */
  coordinateMode?: 'offset' | 'parent'
}

export class SnapTargetsModifier implements Modifier {
  public name = 'snap-targets'
  private options: SnapTargetsOptions
  private parentOffset: Point | null = null
  private _snappedTarget: SnapTarget | null = null
  private _snappedIndex = -1
  private resolvedPivots: Array<{ x: number; y: number }> = []

  constructor(options: SnapTargetsOptions) {
    this.options = options
    this.resolvedPivots = options.relativePoints?.length ? options.relativePoints.map(resolvePivot) : [{ x: 0, y: 0 }]
  }

  /** The target the element is currently snapped to, or null */
  get snappedTarget(): SnapTarget | null {
    return this._snappedTarget
  }

  /** The index of the snapped target in the targets array, or -1 */
  get snappedIndex(): number {
    return this._snappedIndex
  }

  /** Whether the element is currently snapped to any target */
  get isSnapped(): boolean {
    return this._snappedTarget !== null
  }

  onStart(context: ModifierContext): void {
    if (this.options.coordinateMode === 'parent') {
      const el = context.element
      const parent = el.offsetParent || el.parentElement
      if (parent) {
        const parentRect = parent.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        this.parentOffset = {
          x: elRect.left - parentRect.left - context.startPosition.x,
          y: elRect.top - parentRect.top - context.startPosition.y,
        }
      } else {
        this.parentOffset = { x: 0, y: 0 }
      }
    }
    this._snappedTarget = null
    this._snappedIndex = -1
  }

  modify(context: ModifierContext): void {
    const { targets, range: globalRange = 50 } = this.options
    const resolvedPoints = this.resolvedPivots
    const isParentMode = this.options.coordinateMode === 'parent'

    let bestDistance = Infinity
    // Track the winning offset as scalars — no Point allocation per frame.
    let bestDx = 0
    let bestDy = 0
    let bestTargetIndex = -1

    for (const rp of resolvedPoints) {
      const checkX = context.position.x + (context.size ? context.size.width * rp.x : 0)
      const checkY = context.position.y + (context.size ? context.size.height * rp.y : 0)

      for (let ti = 0; ti < targets.length; ti++) {
        const target = targets[ti]
        const range = target.range ?? globalRange

        let targetX = target.x
        let targetY = target.y
        if (isParentMode && this.parentOffset) {
          if (targetX !== undefined) targetX = targetX - this.parentOffset.x
          if (targetY !== undefined) targetY = targetY - this.parentOffset.y
        }

        let dx = 0
        let dy = 0
        let dist = 0

        if (targetX !== undefined && targetY !== undefined) {
          dx = targetX - checkX
          dy = targetY - checkY
          dist = Math.sqrt(dx * dx + dy * dy)
        } else if (targetX !== undefined) {
          dx = targetX - checkX
          dist = Math.abs(dx)
        } else if (targetY !== undefined) {
          dy = targetY - checkY
          dist = Math.abs(dy)
        } else {
          continue
        }

        if (dist <= range && dist < bestDistance) {
          bestDistance = dist
          bestDx = dx
          bestDy = dy
          bestTargetIndex = ti
        }
      }
    }

    if (bestTargetIndex >= 0) {
      this._snappedTarget = targets[bestTargetIndex]
      this._snappedIndex = bestTargetIndex
      context.position.x += bestDx
      context.position.y += bestDy
    } else {
      this._snappedTarget = null
      this._snappedIndex = -1
    }
  }
}

export function snapTargets(options: SnapTargetsOptions): SnapTargetsModifier {
  return new SnapTargetsModifier(options)
}
