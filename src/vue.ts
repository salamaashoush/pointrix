// Vue 3 integration for pointrix — composables, directives, and plugin.
//
// Design mirrors the React integration:
//  - Each composable mounts the native instance ONCE per element.
//  - Callbacks are wrapped with stable delegates that read from a shallowRef,
//    so identity changes on `onDragMove` etc. don't rebuild the instance.
//  - Non-callback options are synced via `instance.updateOptions(partial)` on
//    watch triggers — no destroy/recreate.
//  - Directives do the same on their `updated` hook.

import {
  ref, shallowRef, onMounted, onBeforeUnmount, watch, unref, isRef,
  type App, type Ref, type ShallowRef, type ObjectDirective, type WatchStopHandle,
} from 'vue'
import { pointrix, Pointrix, type PointrixOptions } from './nano'
import { draggable, Draggable, type DragOptions } from './drag'
import { resizable, Resizable, type ResizeOptions } from './resize'
import { gesturable, Gesturable, type GestureOptions } from './gesture'
import { dropzone, Dropzone, type DropzoneOptions } from './dropzone'
import { sortable, Sortable, type SortableOptions } from './sortable'
import type { InteractableOptions } from './index'

const INSTANCE_KEY = Symbol('pointrix-instance')

interface PointrixElement extends HTMLElement {
  [INSTANCE_KEY]?: { destroy(): void; updateOptions(partial: unknown): void }
}

type MaybeRef<T> = T | Ref<T>
type AnyFn = (...args: never[]) => unknown

// ─── Shared helpers ──────────────────────────────────────────────────────

/**
 * Build a new options object where every function-valued key is a stable
 * delegate that reads the latest callback from `latest.value`. Non-function
 * values are copied through unchanged — it's the caller's job to keep them
 * current via updateOptions.
 */
function wrapCallbacks<T extends object>(latest: ShallowRef<T>, template: T): T {
  const out: Record<string, unknown> = {}
  for (const key in template) {
    const v = (template as Record<string, unknown>)[key]
    if (typeof v === 'function') {
      out[key] = (...args: unknown[]) => {
        const fn = (latest.value as Record<string, unknown>)[key] as AnyFn | undefined
        return fn?.(...(args as never[]))
      }
    } else {
      out[key] = v
    }
  }
  return out as T
}

/** Strip function-valued keys — safe to pass to updateOptions. */
function stripCallbacks<T extends object>(options: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const key in options) {
    const v = (options as Record<string, unknown>)[key]
    if (typeof v !== 'function') out[key] = v
  }
  return out as Partial<T>
}

function readOptions<O>(options: MaybeRef<O> | undefined): O {
  if (options === undefined) return {} as O
  return (isRef(options) ? unref(options) : options) as O
}

// ─── Generic composable factory ──────────────────────────────────────────

function createComposable<
  T extends { destroy(): void; updateOptions(partial: Partial<O>): void },
  O extends object,
>(factory: (el: HTMLElement, opts: O) => T) {
  return function useComposable(options?: MaybeRef<O>): {
    elRef: Ref<HTMLElement | null>
    instance: ShallowRef<T | null>
  } {
    const elRef = ref<HTMLElement | null>(null)
    const instance: ShallowRef<T | null> = shallowRef<T | null>(null)
    // Always-latest options the callback wrappers read from.
    const latest: ShallowRef<O> = shallowRef(readOptions(options)) as ShallowRef<O>
    let stopWatch: WatchStopHandle | null = null

    function start() {
      if (!elRef.value || instance.value) return
      latest.value = readOptions(options)
      // One-time construction with wrapped callbacks that permanently route
      // through `latest` — callback identity can change on any render and we
      // still dispatch to the freshest one.
      instance.value = factory(elRef.value, wrapCallbacks(latest, latest.value))

      // If the caller passed a ref, keep `latest` in sync and push non-
      // callback option changes through to the live instance.
      if (isRef(options)) {
        stopWatch = watch(
          options,
          (next) => {
            const o = next as O
            latest.value = o
            instance.value?.updateOptions(stripCallbacks(o))
          },
          { deep: true },
        )
      }
    }

    function stop() {
      if (stopWatch) { stopWatch(); stopWatch = null }
      if (instance.value) {
        instance.value.destroy()
        instance.value = null
      }
    }

    onMounted(start)
    onBeforeUnmount(stop)

    return { elRef: elRef as Ref<HTMLElement | null>, instance }
  }
}

// ─── Composables ─────────────────────────────────────────────────────────

export const usePointrix    = createComposable<Pointrix,    PointrixOptions     >(pointrix)
export const useDraggable   = createComposable<Draggable,   DragOptions     >(draggable)
export const useResizable   = createComposable<Resizable,   ResizeOptions   >(resizable)
export const useGesturable  = createComposable<Gesturable,  GestureOptions  >(gesturable)
export const useDropzone    = createComposable<Dropzone,    DropzoneOptions >(dropzone)
export const useSortable    = createComposable<Sortable,    SortableOptions >(sortable)

// ─── useInteractable ─────────────────────────────────────────────────────

interface InteractableInstance {
  drag: Draggable | null
  resize: Resizable | null
  gesture: Gesturable | null
  destroy(): void
}

/**
 * For useInteractable: build sub-options whose callbacks read from
 * latest.value[sub] (matches the React implementation).
 */
function wrapSubOptions<K extends 'drag' | 'resize' | 'gesture'>(
  latest: ShallowRef<InteractableOptions>,
  sub: K,
): Record<string, unknown> {
  const current = latest.value[sub]
  if (typeof current !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key in current) {
    const v = (current as Record<string, unknown>)[key]
    if (typeof v === 'function') {
      out[key] = (...args: unknown[]) => {
        const sub2 = latest.value[sub]
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

export function useInteractable(options?: MaybeRef<InteractableOptions>): {
  elRef: Ref<HTMLElement | null>
  instance: ShallowRef<InteractableInstance | null>
} {
  const elRef = ref<HTMLElement | null>(null)
  const instance = shallowRef<InteractableInstance | null>(null)
  const latest = shallowRef<InteractableOptions>(readOptions(options))
  let stopWatch: WatchStopHandle | null = null

  function start() {
    if (!elRef.value || instance.value) return
    latest.value = readOptions(options)
    const el = elRef.value
    const current = latest.value
    const inst: InteractableInstance = {
      drag: current.drag
        ? new Draggable(el, (typeof current.drag === 'object' ? wrapSubOptions(latest, 'drag') : {}) as DragOptions)
        : null,
      resize: current.resize
        ? new Resizable(el, (typeof current.resize === 'object' ? wrapSubOptions(latest, 'resize') : {}) as ResizeOptions)
        : null,
      gesture: current.gesture
        ? new Gesturable(el, (typeof current.gesture === 'object' ? wrapSubOptions(latest, 'gesture') : {}) as GestureOptions)
        : null,
      destroy() {
        this.drag?.destroy()
        this.resize?.destroy()
        this.gesture?.destroy()
      },
    }
    instance.value = inst

    if (isRef(options)) {
      stopWatch = watch(
        options,
        (next) => {
          const o = next as InteractableOptions
          latest.value = o
          const cur = instance.value
          if (!cur) return
          if (cur.drag && typeof o.drag === 'object') {
            cur.drag.updateOptions(stripCallbacks(o.drag))
          }
          if (cur.resize && typeof o.resize === 'object') {
            cur.resize.updateOptions(stripCallbacks(o.resize))
          }
          if (cur.gesture && typeof o.gesture === 'object') {
            cur.gesture.updateOptions(stripCallbacks(o.gesture))
          }
        },
        { deep: true },
      )
    }
  }

  function stop() {
    if (stopWatch) { stopWatch(); stopWatch = null }
    if (instance.value) {
      instance.value.destroy()
      instance.value = null
    }
  }

  onMounted(start)
  onBeforeUnmount(stop)

  return { elRef: elRef as Ref<HTMLElement | null>, instance }
}

// ─── Generic directive factory ───────────────────────────────────────────
//
// Directives get a fresh binding on every template render. For pointrix
// subclasses we call `instance.updateOptions(newOpts)` instead of destroying
// and recreating — identical perf win to the composable path, and means
// `v-draggable="{ bounds: 'parent' }"` with an inline literal is safe.

function createDirective<
  T extends { destroy(): void; updateOptions(partial: Partial<O>): void },
  O extends object,
>(factory: (el: HTMLElement, opts: O) => T): ObjectDirective<HTMLElement, O> {
  return {
    mounted(el, binding) {
      const opts = (binding.value ?? {}) as O
      ;(el as PointrixElement)[INSTANCE_KEY] = factory(el, opts) as unknown as PointrixElement[typeof INSTANCE_KEY]
    },
    updated(el, binding) {
      if (binding.value === binding.oldValue) return
      const inst = (el as PointrixElement)[INSTANCE_KEY] as T | undefined
      if (!inst) return
      const opts = (binding.value ?? {}) as O
      // updateOptions covers both callback and data options for directive
      // users — there's no closure/callback stability concern because each
      // template render just replaces the callback reference.
      inst.updateOptions(opts)
    },
    beforeUnmount(el) {
      const inst = (el as PointrixElement)[INSTANCE_KEY] as T | undefined
      inst?.destroy()
      delete (el as PointrixElement)[INSTANCE_KEY]
    },
  }
}

// ─── Directives ──────────────────────────────────────────────────────────

export const vDraggable:  ObjectDirective<HTMLElement, DragOptions>     = createDirective<Draggable,  DragOptions    >(draggable)
export const vResizable:  ObjectDirective<HTMLElement, ResizeOptions>   = createDirective<Resizable,  ResizeOptions  >(resizable)
export const vGesturable: ObjectDirective<HTMLElement, GestureOptions>  = createDirective<Gesturable, GestureOptions >(gesturable)
export const vSortable:   ObjectDirective<HTMLElement, SortableOptions> = createDirective<Sortable,   SortableOptions>(sortable)

// ─── Plugin installer ────────────────────────────────────────────────────

export const PointrixPlugin = {
  install(app: App) {
    app.directive('draggable',  vDraggable)
    app.directive('resizable',  vResizable)
    app.directive('gesturable', vGesturable)
    app.directive('sortable',   vSortable)
  },
}

// ─── Re-export types ─────────────────────────────────────────────────────

export type { PointrixOptions, InteractionEvent, Point, PointerState } from './nano'
export type { DragOptions, DragEvent } from './drag'
export type { ResizeOptions, ResizeEvent } from './resize'
export type { GestureOptions, GestureEvent } from './gesture'
export type { InteractableOptions } from './index'
export type { DropzoneOptions, DropEvent } from './dropzone'
export type { SortableOptions, SortEvent, SortTransferEvent } from './sortable'
