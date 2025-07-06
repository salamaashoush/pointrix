// Ultra-optimized React wrapper for hyperact (~1KB minified)
import React, { useEffect, useRef, MutableRefObject } from 'react'
import { hyperact, Hyperact, HyperactOptions } from './nano'
import { draggable, Draggable, DragOptions } from './drag'
import { resizable, Resizable, ResizeOptions } from './resize'
import { interactable, InteractableOptions } from './index'

// Generic hook factory
function createHook<T extends Hyperact, O>(
  factory: (element: HTMLElement, options: O) => T
) {
  return function useHyperact(
    options: O = {} as O,
    deps: any[] = []
  ): MutableRefObject<HTMLElement | null> {
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
    
    return ref
  }
}

// Specific hooks
export const useHyperact = createHook(hyperact)
export const useDraggable = createHook(draggable)
export const useResizable = createHook(resizable)
// Special handling for interactable since it returns a combined object, not Hyperact
export function useInteractable(
  options: InteractableOptions = {},
  deps: any[] = []
): MutableRefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null)
  const instanceRef = useRef<{ drag: any; resize: any; destroy: () => void } | null>(null)
  
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
  
  return ref
}

// Component props
interface HyperactProps extends HyperactOptions {
  children: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}

interface DraggableProps extends DragOptions {
  children: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}

interface ResizableProps extends ResizeOptions {
  children: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}

interface InteractableProps extends InteractableOptions {
  children: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}

// Component factory
function createComponent<O>(hook: (options: O, deps: any[]) => MutableRefObject<HTMLElement | null>) {
  return function Component({ 
    children, 
    as: Component = 'div',
    className,
    style,
    ...options 
  }: any) {
    const ref = hook(options as O, [JSON.stringify(options)])
    
    return (
      <Component ref={ref} className={className} style={style}>
        {children}
      </Component>
    )
  }
}

// Components
export const HyperactComponent = createComponent<HyperactOptions>(useHyperact)
export const DraggableComponent = createComponent<DragOptions>(useDraggable)
export const ResizableComponent = createComponent<ResizeOptions>(useResizable)
export const InteractableComponent = createComponent<InteractableOptions>(useInteractable)

// Re-export types
export type { 
  HyperactOptions,
  DragOptions,
  ResizeOptions,
  InteractableOptions,
  InteractionEvent,
  DragEvent,
  ResizeEvent
} from './index'
