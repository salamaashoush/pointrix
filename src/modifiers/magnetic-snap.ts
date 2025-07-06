import type { Modifier, ModifierContext, ModifierResult, Point } from '../types'

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

  modify(context: ModifierContext): ModifierResult {
    const { position, element } = context
    
    const elementBounds = element.getBoundingClientRect()
    const elementCenter = {
      x: position.x + elementBounds.width / 2,
      y: position.y + elementBounds.height / 2
    }

    let closestTarget: MagneticTarget | null = null
    let closestDistance = Infinity

    for (const target of this.options.targets) {
      const targetCenter = {
        x: target.x + (target.width ?? 0) / 2,
        y: target.y + (target.height ?? 0) / 2
      }

      const distance = this.getDistance(elementCenter, targetCenter)
      
      if (distance < this.options.distance && distance < closestDistance) {
        closestDistance = distance
        closestTarget = target
      }
    }

    if (closestTarget) {
      const targetCenter = {
        x: closestTarget.x + (closestTarget.width ?? 0) / 2,
        y: closestTarget.y + (closestTarget.height ?? 0) / 2
      }

      const strength = closestTarget.strength ?? this.options.strength
      const pullStrength = 1 - (closestDistance / this.options.distance)
      const effectiveStrength = strength * pullStrength

      const snappedPosition: Point = {
        x: position.x + (targetCenter.x - elementCenter.x) * effectiveStrength,
        y: position.y + (targetCenter.y - elementCenter.y) * effectiveStrength
      }

      if (closestDistance < this.options.distance * 0.3) {
        snappedPosition.x = closestTarget.x
        snappedPosition.y = closestTarget.y
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

      return {
        position: snappedPosition,
        velocity: context.velocity
      }
    } else {
      if (this.currentTarget) {
        if (this.options.onUnsnap) {
          this.options.onUnsnap(this.currentTarget)
        }
        this.currentTarget = null
      }
    }

    return {
      position: context.position,
      velocity: context.velocity
    }
  }

  private getDistance(a: Point, b: Point): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
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