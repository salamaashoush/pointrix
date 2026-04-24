// Canonical type definitions for pointrix

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

// Modifier system types.
//
// Modifiers mutate the shared ModifierContext in place. There is no result
// object — `context.position`, `context.velocity`, and `context.size` hold
// the authoritative state both going into and coming out of each modifier.
// This removes the per-frame allocation tax the old `{ position: {x,y}, ... }`
// return pattern imposed (about 2 objects per modifier per frame).
//
// Authors writing custom modifiers just mutate context in place:
//
//   modify(ctx) {
//     ctx.position.x = Math.round(ctx.position.x / 20) * 20
//     ctx.position.y = Math.round(ctx.position.y / 20) * 20
//   }
//
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

export interface Modifier {
  name: string
  onStart?(context: ModifierContext): void
  /** Mutate context in place. Return value is ignored. */
  modify(context: ModifierContext): void
  /** Mutate context in place at the end of an interaction. Return value is ignored. */
  onEnd?(context: ModifierContext): void
}

/**
 * Returns true if the user has requested reduced motion via OS settings.
 * Animations should be disabled or shortened when this returns true (WCAG 2.3.3).
 * Safe to call in SSR / non-browser contexts (returns false).
 *
 * The result is cached after the first call and kept in sync via a `change`
 * listener on the media query — `matchMedia()` is measurable when called per
 * drag-end / per sortable animation, but the value changes at most when the
 * user flips their OS setting.
 */
let _rmCache: boolean | null = null

export function prefersReducedMotion(): boolean {
  if (_rmCache !== null) return _rmCache
  if (typeof window === 'undefined' || !window.matchMedia) {
    _rmCache = false
    return false
  }
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  _rmCache = mql.matches
  // Follow OS-setting flips. `addEventListener` is broadly supported; older
  // WebKit needs `addListener`, but that's been fine since Safari 14.
  const handler = (e: MediaQueryListEvent) => { _rmCache = e.matches }
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler)
  }
  return _rmCache
}

/**
 * Run a chain of modifiers against `context`, mutating it in place.
 * Returns the same context reference — callers can read `context.position`,
 * `context.velocity`, and `context.size` after the call.
 *
 * Zero per-frame allocation: every modifier writes directly to context.
 */
export function applyModifiers(modifiers: Modifier[], context: ModifierContext): ModifierContext {
  for (let i = 0; i < modifiers.length; i++) {
    modifiers[i].modify(context)
  }
  return context
}
