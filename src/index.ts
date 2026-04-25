// Full pointrix bundle with all features

export { pointrix, Pointrix, setMaxInteractions, getActiveInteractionCount } from './nano'
export type { Point, PointerState, InteractionEvent, PointrixOptions } from './nano'

export { draggable, Draggable } from './drag'
export type { DragOptions, DragEvent } from './drag'

export { resizable, Resizable } from './resize'
export type { ResizeOptions, ResizeEvent } from './resize'

export { gesturable, Gesturable } from './gesture'
export type { GestureOptions, GestureEvent } from './gesture'

export { dropzone, Dropzone, DropzoneManager } from './dropzone'
export type { DropzoneOptions, DropEvent } from './dropzone'

export { sortable, Sortable } from './sortable'
export type { SortableOptions, SortEvent, SortTransferEvent } from './sortable'

export type { Modifier, ModifierContext, ActiveEdges, Rect } from './types'
export { applyModifiers, prefersReducedMotion } from './types'

export * from './modifiers/index'

export { setMessages, getMessages, announce } from './aria'
export type { AriaMessages } from './aria'

// Interactable factory that creates drag, resize, and gesture instances
export interface InteractableOptions {
  drag?: boolean | DragOptions
  resize?: boolean | ResizeOptions
  gesture?: boolean | GestureOptions
}

import { DragOptions, Draggable } from './drag'
import { ResizeOptions, Resizable } from './resize'
import { GestureOptions, Gesturable } from './gesture'
import { draggable } from './drag'
import { resizable } from './resize'
import { gesturable } from './gesture'

export function interactable(element: HTMLElement | string, options: InteractableOptions = {}) {
  const el = typeof element === 'string' ? document.querySelector<HTMLElement>(element) : element

  if (!el) throw new Error(`Element not found: ${element}`)

  let dragInstance: Draggable | null = null
  let resizeInstance: Resizable | null = null
  let gestureInstance: Gesturable | null = null

  if (options.drag) {
    const dragOptions = typeof options.drag === 'object' ? options.drag : {}
    dragInstance = draggable(el, dragOptions)
  }

  if (options.resize) {
    const resizeOptions = typeof options.resize === 'object' ? options.resize : {}
    resizeInstance = resizable(el, resizeOptions)
  }

  if (options.gesture) {
    const gestureOptions = typeof options.gesture === 'object' ? options.gesture : {}
    gestureInstance = gesturable(el, gestureOptions)
  }

  return {
    drag: dragInstance,
    resize: resizeInstance,
    gesture: gestureInstance,
    destroy() {
      dragInstance?.destroy()
      resizeInstance?.destroy()
      gestureInstance?.destroy()
    },
  }
}

export function interactAll(selector: string, options: InteractableOptions = {}) {
  const elements = document.querySelectorAll<HTMLElement>(selector)
  const results = Array.from(elements).map((el) => interactable(el, options))
  return {
    instances: results,
    destroy() {
      results.forEach((r) => r.destroy())
    },
  }
}

export default interactable
