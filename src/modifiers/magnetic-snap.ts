import type { Modifier, ModifierContext } from '../types'

export interface MagneticTarget {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  strength?: number
}

export interface MagneticSnapOptions {
  targets: MagneticTarget[]
  distance?: number
  strength?: number
  onSnap?: (target: MagneticTarget) => void
  onUnsnap?: (target: MagneticTarget) => void
}

export class MagneticSnapModifier implements Modifier {
  public name = 'magnetic-snap'
  private options: Required<MagneticSnapOptions>
  private currentTarget: MagneticTarget | null = null
  private targetMap: Map<string, MagneticTarget>

  constructor(options: MagneticSnapOptions) {
    this.options = {
      targets: options.targets,
      distance: options.distance ?? 30,
      strength: options.strength ?? 0.5,
      onSnap: options.onSnap ?? (() => {}),
      onUnsnap: options.onUnsnap ?? (() => {})
    }
    
    this.targetMap = new Map(options.targets.map(t => [t.id, t]))
  }

  updateTargets(targets: MagneticTarget[]): void {
    this.options.targets = targets
    this.targetMap = new Map(targets.map(t => [t.id, t]))
  }

  addTarget(target: MagneticTarget): void {
    this.options.targets.push(target)
    this.targetMap.set(target.id, target)
  }

  removeTarget(id: string): void {
    this.options.targets = this.options.targets.filter(t => t.id !== id)
    this.targetMap.delete(id)
    
    if (this.currentTarget?.id === id) {
      if (this.options.onUnsnap) {
        this.options.onUnsnap(this.currentTarget)
      }
      this.currentTarget = null
    }
  }

  modify(context: ModifierContext): void {
    const position = context.position
    const elWidth = context.size?.width ?? 0
    const elHeight = context.size?.height ?? 0

    // Element center — scalars, no allocation
    const elCenterX = position.x + elWidth / 2
    const elCenterY = position.y + elHeight / 2

    let closestTarget: MagneticTarget | null = null
    let closestDistance = Infinity
    let closestCenterX = 0
    let closestCenterY = 0

    for (const target of this.options.targets) {
      const tcx = target.x + (target.width ?? 0) / 2
      const tcy = target.y + (target.height ?? 0) / 2
      const dx = elCenterX - tcx
      const dy = elCenterY - tcy
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < this.options.distance && distance < closestDistance) {
        closestDistance = distance
        closestTarget = target
        closestCenterX = tcx
        closestCenterY = tcy
      }
    }

    if (closestTarget) {
      const strength = closestTarget.strength ?? this.options.strength
      const pullStrength = 1 - (closestDistance / this.options.distance)
      const effectiveStrength = strength * pullStrength

      if (closestDistance < this.options.distance * 0.3) {
        // Hard snap to the target origin
        position.x = closestTarget.x
        position.y = closestTarget.y
      } else {
        position.x += (closestCenterX - elCenterX) * effectiveStrength
        position.y += (closestCenterY - elCenterY) * effectiveStrength
      }

      if (this.currentTarget?.id !== closestTarget.id) {
        if (this.currentTarget && this.options.onUnsnap) {
          this.options.onUnsnap(this.currentTarget)
        }
        this.currentTarget = closestTarget
        if (this.options.onSnap) {
          this.options.onSnap(closestTarget)
        }
      }
      return
    }

    if (this.currentTarget) {
      if (this.options.onUnsnap) {
        this.options.onUnsnap(this.currentTarget)
      }
      this.currentTarget = null
    }
  }

  getCurrentTarget(): MagneticTarget | null {
    return this.currentTarget
  }

  isSnapped(): boolean {
    return this.currentTarget !== null
  }
}

export function magneticSnap(options: MagneticSnapOptions): MagneticSnapModifier {
  return new MagneticSnapModifier(options)
}