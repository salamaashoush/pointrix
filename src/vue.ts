// Vue 3 integration for grip - composables, directives, and plugin

import { ref, shallowRef, onMounted, onBeforeUnmount, watch, unref, isRef, type App, type Ref, type ShallowRef, type ObjectDirective } from 'vue'
import { grip, Grip, type GripOptions } from './nano'
import { draggable, Draggable, type DragOptions } from './drag'
import { resizable, Resizable, type ResizeOptions } from './resize'
import { gesturable, Gesturable, type GestureOptions } from './gesture'
import { dropzone, Dropzone, type DropzoneOptions } from './dropzone'
import { sortable, Sortable, type SortableOptions } from './sortable'
import { interactable, type InteractableOptions } from './index'

// Symbol key for storing instances on directive elements
const INSTANCE_KEY = Symbol('grip')

interface GripElement extends HTMLElement {
  [INSTANCE_KEY]?: { destroy(): void }
}

// ---------------------------------------------------------------------------
// Generic composable factory
// ---------------------------------------------------------------------------

type MaybeRef<T> = T | Ref<T>

function createComposable<T extends { destroy(): void }, O>(
  factory: (el: HTMLElement, opts: O) => T
) {
  return function useComposable(options?: MaybeRef<O>): {
    elRef: Ref<HTMLElement | null>
    instance: ShallowRef<T | null>
  } {
    const elRef = ref<HTMLElement | null>(null)
    const instanceShallowRef = shallowRef<T | null>(null)

    function create() {
      destroy()
      if (!elRef.value) return
      const opts = (isRef(options) ? unref(options) : options) ?? ({} as O)
      instanceShallowRef.value = factory(elRef.value, opts)
    }

    function destroy() {
      if (instanceShallowRef.value) {
        instanceShallowRef.value.destroy()
        instanceShallowRef.value = null
      }
    }

    onMounted(() => {
      create()

      // Watch reactive options for changes
      if (isRef(options)) {
        watch(options, () => create(), { deep: true })
      }
    })

    onBeforeUnmount(() => {
      destroy()
    })

    return { elRef: elRef as Ref<HTMLElement | null>, instance: instanceShallowRef as ShallowRef<T | null> }
  }
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

export const useGrip = createComposable<Grip, GripOptions>(grip)
export const useDraggable = createComposable<Draggable, DragOptions>(draggable)
export const useResizable = createComposable<Resizable, ResizeOptions>(resizable)
export const useGesturable = createComposable<Gesturable, GestureOptions>(gesturable)
export const useDropzone = createComposable<Dropzone, DropzoneOptions>(dropzone)
export const useSortable = createComposable<Sortable, SortableOptions>(sortable)

export function useInteractable(options?: MaybeRef<InteractableOptions>): {
  elRef: Ref<HTMLElement | null>
  instance: ShallowRef<{ drag: Draggable | null; resize: Resizable | null; gesture: Gesturable | null; destroy(): void } | null>
} {
  const elRef = ref<HTMLElement | null>(null)
  const instanceShallowRef = shallowRef<{ drag: Draggable | null; resize: Resizable | null; gesture: Gesturable | null; destroy(): void } | null>(null)

  function create() {
    destroy()
    if (!elRef.value) return
    const opts = (isRef(options) ? unref(options) : options) ?? {}
    instanceShallowRef.value = interactable(elRef.value, opts)
  }

  function destroy() {
    if (instanceShallowRef.value) {
      instanceShallowRef.value.destroy()
      instanceShallowRef.value = null
    }
  }

  onMounted(() => {
    create()

    if (isRef(options)) {
      watch(options, () => create(), { deep: true })
    }
  })

  onBeforeUnmount(() => {
    destroy()
  })

  return { elRef: elRef as Ref<HTMLElement | null>, instance: instanceShallowRef }
}

// ---------------------------------------------------------------------------
// Generic directive factory
// ---------------------------------------------------------------------------

function createDirective<T extends { destroy(): void }, O>(
  factory: (el: HTMLElement, opts: O) => T
): ObjectDirective<HTMLElement, O> {
  return {
    mounted(el, binding) {
      const opts = binding.value ?? ({} as O)
      const instance = factory(el, opts);
      (el as GripElement)[INSTANCE_KEY] = instance
    },
    updated(el, binding) {
      if (binding.value === binding.oldValue) return
      // Destroy old instance and create new one
      const old = (el as GripElement)[INSTANCE_KEY] as T | undefined
      old?.destroy()
      const opts = binding.value ?? ({} as O)
      const instance = factory(el, opts);
      (el as GripElement)[INSTANCE_KEY] = instance
    },
    beforeUnmount(el) {
      const instance = (el as GripElement)[INSTANCE_KEY] as T | undefined
      instance?.destroy()
      delete (el as GripElement)[INSTANCE_KEY]
    }
  }
}

// ---------------------------------------------------------------------------
// Directives
// ---------------------------------------------------------------------------

export const vDraggable: ObjectDirective<HTMLElement, DragOptions> = createDirective<Draggable, DragOptions>(draggable)
export const vResizable: ObjectDirective<HTMLElement, ResizeOptions> = createDirective<Resizable, ResizeOptions>(resizable)
export const vGesturable: ObjectDirective<HTMLElement, GestureOptions> = createDirective<Gesturable, GestureOptions>(gesturable)
export const vSortable: ObjectDirective<HTMLElement, SortableOptions> = createDirective<Sortable, SortableOptions>(sortable)

// ---------------------------------------------------------------------------
// Plugin installer
// ---------------------------------------------------------------------------

export const GripPlugin = {
  install(app: App) {
    app.directive('draggable', vDraggable)
    app.directive('resizable', vResizable)
    app.directive('gesturable', vGesturable)
    app.directive('sortable', vSortable)
  }
}

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type {
  GripOptions,
  InteractionEvent,
  Point,
  PointerState
} from './nano'

export type {
  DragOptions,
  DragEvent
} from './drag'

export type {
  ResizeOptions,
  ResizeEvent
} from './resize'

export type {
  GestureOptions,
  GestureEvent
} from './gesture'

export type {
  InteractableOptions
} from './index'

export type {
  DropzoneOptions,
  DropEvent
} from './dropzone'

export type {
  SortableOptions,
  SortEvent,
  SortTransferEvent
} from './sortable'
