// Ultra-optimized React wrapper for hyperact (~1KB minified)
import React, { useEffect, useRef, MutableRefObject } from 'react'
import { hyperact, Hyperact, HyperactOptions } from './nano'
import { draggable, Draggable, DragOptions } from './drag'
import { resizable, Resizable, ResizeOptions } from './resize'
import { gesturable, Gesturable, GestureOptions } from './gesture'
import { dropzone, Dropzone, DropzoneOptions } from './dropzone'
import { sortable, Sortable, SortableOptions } from './sortable'
import { interactable, InteractableOptions } from './index'

// Generic hook factory
function createHook<T extends Hyperact, O>(
  factory: (element: HTMLElement, options: O) => T
) {
  return function useHyperact(
    options: O = {} as O,
    deps: React.DependencyList = []
  ): { ref: MutableRefObject<HTMLElement | null>; instance: MutableRefObject<T | null> } {
    const ref = useRef<HTMLElement | null>(null)
    const instanceRef = useRef<T | null>(null)

    useEffect(() => {
      if (!ref.current) return

      // Clean up previous instance
      instanceRef.current?.destroy()

      // Create new instance
      instanceRef.current = factory(ref.current, options)

      return () => {
        instanceRef.current?.destroy()
        instanceRef.current = null
      }
    }, [ref.current, ...deps])

    return { ref, instance: instanceRef }
  }
}

// Specific hooks
export const useHyperact = createHook(hyperact)
export const useDraggable = createHook(draggable)
export const useResizable = createHook(resizable)
export const useGesturable = createHook(gesturable)

// Dropzone hook
export function useDropzone(
  options: DropzoneOptions = {},
  deps: React.DependencyList = []
): { ref: MutableRefObject<HTMLElement | null>; instance: MutableRefObject<Dropzone | null> } {
  const ref = useRef<HTMLElement | null>(null)
  const instanceRef = useRef<Dropzone | null>(null)

  useEffect(() => {
    if (!ref.current) return
    instanceRef.current?.destroy()
    instanceRef.current = dropzone(ref.current, options)
    return () => {
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [ref.current, ...deps])

  return { ref, instance: instanceRef }
}

// Sortable hook
export function useSortable(
  options: SortableOptions = {},
  deps: React.DependencyList = []
): { ref: MutableRefObject<HTMLElement | null>; instance: MutableRefObject<Sortable | null> } {
  const ref = useRef<HTMLElement | null>(null)
  const instanceRef = useRef<Sortable | null>(null)

  useEffect(() => {
    if (!ref.current) return
    instanceRef.current?.destroy()
    instanceRef.current = sortable(ref.current, options)
    return () => {
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [ref.current, ...deps])

  return { ref, instance: instanceRef }
}

// Special handling for interactable since it returns a combined object, not Hyperact
export function useInteractable(
  options: InteractableOptions = {},
  deps: React.DependencyList = []
): {
  ref: MutableRefObject<HTMLElement | null>
  instance: MutableRefObject<{
    drag: Draggable | null
    resize: Resizable | null
    gesture: Gesturable | null
    destroy: () => void
  } | null>
} {
  const ref = useRef<HTMLElement | null>(null)
  const instanceRef = useRef<{
    drag: Draggable | null
    resize: Resizable | null
    gesture: Gesturable | null
    destroy: () => void
  } | null>(null)

  useEffect(() => {
    if (!ref.current) return

    // Clean up previous instance
    instanceRef.current?.destroy()

    // Create new instance
    instanceRef.current = interactable(ref.current, options)

    return () => {
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [ref.current, ...deps])

  return { ref, instance: instanceRef }
}

// Component factory
function createComponent<O extends object>(
  hook: (options: O, deps: React.DependencyList) => { ref: MutableRefObject<HTMLElement | null>; instance: MutableRefObject<unknown> }
) {
  return function Component({
    children,
    as: Tag = 'div',
    className,
    style,
    ...options
  }: O & { children: React.ReactNode; as?: keyof React.JSX.IntrinsicElements; className?: string; style?: React.CSSProperties }) {
    const { ref } = hook(options as unknown as O, [JSON.stringify(options)])
    const El = Tag as React.ElementType
    return (
      <El ref={ref} className={className} style={style}>
        {children}
      </El>
    )
  }
}

// Components
export const HyperactComponent = createComponent<HyperactOptions>(useHyperact)
export const DraggableComponent = createComponent<DragOptions>(useDraggable)
export const ResizableComponent = createComponent<ResizeOptions>(useResizable)
export const GesturableComponent = createComponent<GestureOptions>(useGesturable)
export const InteractableComponent = createComponent<InteractableOptions>(useInteractable)

// Re-export types
export type {
  HyperactOptions,
  DragOptions,
  ResizeOptions,
  GestureOptions,
  InteractableOptions,
  InteractionEvent,
  DragEvent,
  ResizeEvent,
  GestureEvent,
  DropzoneOptions,
  DropEvent,
  SortableOptions,
  SortEvent,
} from './index'
