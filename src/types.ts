// Canonical type definitions for hyperact

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ActiveEdges {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

// Modifier system types
export interface ModifierContext {
  position: Point
  velocity: Point
  element: HTMLElement
  startPosition: Point
  delta: Point
  edges?: ActiveEdges
  size?: { width: number; height: number }
  startSize?: { width: number; height: number }
}

export interface ModifierResult {
  position: Point
  velocity: Point
  size?: { width: number; height: number }
}

export interface Modifier {
  name: string
  onStart?(context: ModifierContext): void
  modify(context: ModifierContext): ModifierResult
  onEnd?(context: ModifierContext): ModifierResult | void
}

// Apply a chain of modifiers sequentially
export function applyModifiers(modifiers: Modifier[], context: ModifierContext): ModifierResult {
  let result: ModifierResult = {
    position: { ...context.position },
    velocity: { ...context.velocity },
    size: context.size ? { ...context.size } : undefined
  }

  for (const mod of modifiers) {
    const ctx: ModifierContext = {
      ...context,
      position: result.position,
      velocity: result.velocity,
      size: result.size ?? context.size
    }
    result = mod.modify(ctx)
  }

  return result
}
