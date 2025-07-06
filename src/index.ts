// Full hyperact bundle with all features (~8KB minified)

export { hyperact, Hyperact } from './nano'
export type { Point, PointerState, InteractionEvent, HyperactOptions } from './nano'

export { draggable, Draggable } from './drag'
export type { DragOptions, DragEvent } from './drag'

export { resizable, Resizable } from './resize'
export type { ResizeOptions, ResizeEvent } from './resize'

// Interactable factory that creates both drag and resize instances
export interface InteractableOptions {
  drag?: boolean | DragOptions
  resize?: boolean | ResizeOptions
}

import { DragOptions } from './drag'
import { ResizeOptions } from './resize'
import { draggable } from './drag'
import { resizable } from './resize'

export function interactable(element: HTMLElement | string, options: InteractableOptions = {}) {
  const el = typeof element === 'string' 
    ? document.querySelector<HTMLElement>(element)
    : element
    
  if (!el) throw new Error(`Element not found: ${element}`)
  
  const instances: any[] = []
  
  // Create drag instance if requested
  if (options.drag) {
    const dragOptions = typeof options.drag === 'object' ? options.drag : {}
    instances.push(draggable(el, dragOptions))
  }
  
  // Create resize instance if requested
  if (options.resize) {
    const resizeOptions = typeof options.resize === 'object' ? options.resize : {}
    instances.push(resizable(el, resizeOptions))
  }
  
  // Return an object with both instances and combined methods
  return {
    drag: instances.find(i => i.constructor.name === 'Draggable') || null,
    resize: instances.find(i => i.constructor.name === 'Resizable') || null,
    destroy() {
      instances.forEach(instance => instance.destroy())
    }
  }
}

// Default export
export default interactable