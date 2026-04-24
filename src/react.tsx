// React bindings for pointrix.
//
// Design:
//  - Each hook returns a RefCallback — attach it to your JSX element.
//  - The native instance is created once when the element mounts; callbacks
//    route through a ref that's updated every render, so inline handlers
//    (`onDragMove={e => ...}`) don't rebind or destroy/recreate anything.
//  - Data-only options (axis, bounds, grid, etc.) flow through `updateOptions`
//    via a layout effect so they take effect before the next paint.
//  - For imperative access (setPosition, cancel, getSize), pass a RefObject as
//    the second arg — matches React's useImperativeHandle pattern:
//
//      const instance = useRef<Draggable>(null)
//      const ref = useDraggable({ ... }, instance)
//      <div ref={ref} />
//      // later: instance.current?.setPosition(100, 100)

import React, { useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import type { RefObject, RefCallback } from 'react'
import { Pointrix, PointrixOptions } from './nano'
import { Draggable, DragOptions } from './drag'
import { Resizable, ResizeOptions } from './resize'
import { Gesturable, GestureOptions } from './gesture'
import { Dropzone, DropzoneOptions } from './dropzone'
import { Sortable, SortableOptions } from './sortable'

// Prefer useLayoutEffect on the client, useEffect on the server (silences the SSR warning).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type AnyFn = (...args: never[]) => unknown

/**
 * Wrap every function-valued key in `options` so the returned object's
 * callbacks read from a ref. Non-function values are passed through unchanged.
 * The wrapper functions themselves are stable across renders — reassigning
 * the ref is enough to pick up new user callbacks.
 */
function wrapCallbacks<T extends object>(
  latest: RefObject<T>,
  template: T,
): T {
  const out: Record<string, unknown> = {}
  for (const key in template) {
    const v = (template as Record<string, unknown>)[key]
    if (typeof v === 'function') {
      out[key] = (...args: unknown[]) => {
        const fn = (latest.current as Record<string, unknown>)[key] as AnyFn | undefined
        return fn?.(...(args as never[]))
      }
    } else {
      out[key] = v
    }
  }
  return out as T
}

/**
 * Strip function-valued keys from `options`. Returned object is safe to pass
 * to `updateOptions` — callbacks are already wrapped at construction time and
 * should not be replaced on every render.
 */
function stripCallbacks<T extends object>(options: T): T {
  const out: Record<string, unknown> = {}
  for (const key in options) {
    const v = (options as Record<string, unknown>)[key]
    if (typeof v !== 'function') out[key] = v
  }
  return out as T
}

/**
 * Factory that produces a React hook for any Pointrix subclass. Returns a stable
 * callback-ref. Users who need imperative access (setPosition, cancel, etc.)
 * pass a RefObject as the second argument — the hook populates its `.current`
 * when the element mounts and clears it on unmount.
 */
function createHook<TInst extends { destroy(): void; updateOptions(partial: Partial<TOpts>): void }, TOpts extends object>(
  factory: (element: HTMLElement, options: TOpts) => TInst,
) {
  return function useHook(options: TOpts = {} as TOpts, instanceRef?: RefObject<TInst | null>): RefCallback<HTMLElement> {
    // Always-latest options, read by the wrapped callbacks.
    const latest = useRef(options)
    latest.current = options

    // Track the previous options reference so we can skip the sync entirely
    // when the caller passes a stable reference (via useStableOptions, a
    // module-level constant, or upstream memoization).
    const lastSynced = useRef<TOpts | undefined>(undefined)

    // Hook-owned instance ref — separate from the user's optional one so
    // updateOptions always has access even when the caller didn't pass a ref.
    const internal = useRef<TInst | null>(null)
    // Hold the element between the ref callback firing and the layout effect,
    // so we can create the instance synchronously with DOM already attached.
    const elementRef = useRef<HTMLElement | null>(null)

    // Stable callback-ref. React calls with null on unmount and the element on mount.
    const ref = useCallback<RefCallback<HTMLElement>>((el) => {
      if (el === elementRef.current) return
      // Element changed (or going away) — tear down any existing instance.
      if (internal.current) {
        internal.current.destroy()
        internal.current = null
        if (instanceRef) instanceRef.current = null
      }
      elementRef.current = el
      if (!el) return
      // Create once. Wrapped callbacks read `latest.current` on every fire.
      const inst = factory(el, wrapCallbacks(latest, latest.current) as TOpts)
      internal.current = inst
      if (instanceRef) instanceRef.current = inst
      // Mark the construction options as synced so the following layout
      // effect doesn't redundantly re-apply them.
      lastSynced.current = options
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync data options after every render. Short-circuit when the caller
    // passes a stable reference — `stripCallbacks` + `updateOptions` would
    // both be no-ops but still walk the whole options object.
    useIsomorphicLayoutEffect(() => {
      if (!internal.current) return
      if (lastSynced.current === options) return
      internal.current.updateOptions(stripCallbacks(options) as Partial<TOpts>)
      lastSynced.current = options
    })

    return ref
  }
}

// ─── Specific hooks ────────────────────────────────────────────────────────

export const usePointrix = createHook<Pointrix, PointrixOptions>(
  (el, opts) => new Pointrix(el, opts),
)

export const useDraggable = createHook<Draggable, DragOptions>(
  (el, opts) => new Draggable(el, opts),
)

export const useResizable = createHook<Resizable, ResizeOptions>(
  (el, opts) => new Resizable(el, opts),
)

export const useGesturable = createHook<Gesturable, GestureOptions>(
  (el, opts) => new Gesturable(el, opts),
)

export const useDropzone = createHook<Dropzone, DropzoneOptions>(
  (el, opts) => new Dropzone(el, opts),
)

export const useSortable = createHook<Sortable, SortableOptions>(
  (el, opts) => new Sortable(el, opts),
)

// ─── Composite hook: useInteractable ───────────────────────────────────────

export interface UseInteractableOptions {
  drag?: boolean | DragOptions
  resize?: boolean | ResizeOptions
  gesture?: boolean | GestureOptions
}

export interface InteractableInstance {
  drag: Draggable | null
  resize: Resizable | null
  gesture: Gesturable | null
}

/**
 * Composite hook for elements that need multiple interaction types on a
 * single node. Each sub-instance is managed independently — flipping
 * `drag: true` on and off mounts/unmounts only the Draggable.
 *
 * Pass `instanceRef` for imperative access to the sub-instances.
 */
export function useInteractable(
  options: UseInteractableOptions = {},
  instanceRef?: RefObject<InteractableInstance | null>,
): RefCallback<HTMLElement> {
  const latest = useRef(options)
  latest.current = options

  const internal = useRef<InteractableInstance | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const lastSynced = useRef<UseInteractableOptions | undefined>(undefined)

  const ref = useCallback<RefCallback<HTMLElement>>((el) => {
    if (el === elementRef.current) return
    if (internal.current) {
      internal.current.drag?.destroy()
      internal.current.resize?.destroy()
      internal.current.gesture?.destroy()
      internal.current = null
      if (instanceRef) instanceRef.current = null
    }
    elementRef.current = el
    if (!el) return
    const current: UseInteractableOptions = latest.current
    const inst: InteractableInstance = {
      drag: current.drag ? new Draggable(el, (typeof current.drag === 'object' ? wrapSubOptions(latest, 'drag') : {}) as DragOptions) : null,
      resize: current.resize ? new Resizable(el, (typeof current.resize === 'object' ? wrapSubOptions(latest, 'resize') : {}) as ResizeOptions) : null,
      gesture: current.gesture ? new Gesturable(el, (typeof current.gesture === 'object' ? wrapSubOptions(latest, 'gesture') : {}) as GestureOptions) : null,
    }
    internal.current = inst
    if (instanceRef) instanceRef.current = inst
    lastSynced.current = options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync data options for each active sub-instance after every render.
  // Short-circuits when the options reference hasn't changed since the last
  // sync — three sub-instance walks skipped per render for stable callers.
  useIsomorphicLayoutEffect(() => {
    const inst = internal.current
    if (!inst) return
    if (lastSynced.current === options) return
    const current: UseInteractableOptions = latest.current
    if (inst.drag && typeof current.drag === 'object') {
      inst.drag.updateOptions(stripCallbacks(current.drag))
    }
    if (inst.resize && typeof current.resize === 'object') {
      inst.resize.updateOptions(stripCallbacks(current.resize))
    }
    if (inst.gesture && typeof current.gesture === 'object') {
      inst.gesture.updateOptions(stripCallbacks(current.gesture))
    }
    lastSynced.current = options
  })

  return ref
}

/**
 * For useInteractable: build a stable options object whose callbacks read
 * from latest.current[sub].
 */
function wrapSubOptions<K extends 'drag' | 'resize' | 'gesture'>(
  latest: RefObject<UseInteractableOptions>,
  sub: K,
): Record<string, unknown> {
  const current = latest.current[sub]
  if (typeof current !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key in current) {
    const v = (current as Record<string, unknown>)[key]
    if (typeof v === 'function') {
      out[key] = (...args: unknown[]) => {
        const sub2 = latest.current[sub]
        if (typeof sub2 !== 'object') return
        const fn = (sub2 as Record<string, unknown>)[key] as AnyFn | undefined
        return fn?.(...(args as never[]))
      }
    } else {
      out[key] = v
    }
  }
  return out
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * useMemo wrapper that memoizes a plain options object by shallow comparison
 * of its values. Handy when callers don't want to inline-memo every prop.
 *
 *   const opts = useStableOptions({ axis, bounds, onDragMove })
 *   const { ref } = useDraggable(opts)
 */
export function useStableOptions<T extends object>(options: T): T {
  const ref = useRef(options)
  // Shallow compare: if all values match by reference, keep the old object.
  const prev = ref.current
  let same = prev !== options && Object.keys(prev).length === Object.keys(options).length
  if (same) {
    for (const key in options) {
      if ((prev as Record<string, unknown>)[key] !== (options as Record<string, unknown>)[key]) {
        same = false
        break
      }
    }
  }
  if (!same) ref.current = options
  return ref.current
}

// ─── Re-export types ───────────────────────────────────────────────────────

export type {
  PointrixOptions,
  DragOptions,
  ResizeOptions,
  GestureOptions,
  DropzoneOptions,
  SortableOptions,
  InteractionEvent,
  DragEvent,
  ResizeEvent,
  GestureEvent,
  DropEvent,
  SortEvent,
  SortTransferEvent,
} from './index'

// Keep the default export working for folks who do `import pointrix from 'pointrix/react'`.
export default {
  usePointrix,
  useDraggable,
  useResizable,
  useGesturable,
  useDropzone,
  useSortable,
  useInteractable,
  useStableOptions,
}
