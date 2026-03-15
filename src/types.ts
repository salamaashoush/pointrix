// Canonical type definitions for grip

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
  let px = context.position.x
  let py = context.position.y
  let vx = context.velocity.x
  let vy = context.velocity.y
  let sw = context.size?.width
  let sh = context.size?.height

  for (const mod of modifiers) {
    context.position.x = px
    context.position.y = py
    context.velocity.x = vx
    context.velocity.y = vy
    if (context.size && sw !== undefined && sh !== undefined) {
      context.size.width = sw
      context.size.height = sh
    }
    const result = mod.modify(context)
    px = result.position.x
    py = result.position.y
    vx = result.velocity.x
    vy = result.velocity.y
    if (result.size) {
      sw = result.size.width
      sh = result.size.height
    }
  }

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    size: sw !== undefined && sh !== undefined ? { width: sw, height: sh } : undefined,
  }
}
