// Vue binding tests. Mirrors the React test suite:
//   - Mount creates the native instance exactly once.
//   - Reactive option change does NOT destroy + recreate.
//   - Inline callback identity changes work without rebinding.
//   - Unmount destroys.
//   - v-directive uses updateOptions on update (no recreate).

import './helpers' // PointerEvent polyfill + RAF hook
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, defineComponent, h, ref, type App, type Ref } from 'vue'
import { useDraggable, useSortable, vDraggable, vResizable } from '../vue'
import type { Draggable } from '../drag'
import { firePointerDown, firePointerMove, firePointerUp, flushRAF, resetRAF } from './helpers'

interface MountResult {
  container: HTMLElement
  app: App
  unmount: () => void
}

/**
 * Mount a Vue component into a fresh div. Returns the container + an unmount
 * fn. Vue runs setup and reactivity synchronously enough for our tests —
 * no microtask flushing needed for most assertions; tests that need reactive
 * updates to propagate can call `await Promise.resolve()` (Vue batches
 * updates to the next microtask).
 */
function mount(component: ReturnType<typeof defineComponent>): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(component)
  app.mount(container)
  return {
    container,
    app,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('useDraggable (Vue)', () => {
  beforeEach(() => resetRAF())

  it('creates exactly one Draggable on mount', () => {
    const Comp = defineComponent({
      setup() {
        const { elRef } = useDraggable({})
        return () => h('div', { ref: elRef, 'data-testid': 'target' })
      },
    })
    const { container, unmount } = mount(Comp)
    const el = container.querySelector('[data-testid="target"]') as HTMLElement

    expect(el.getAttribute('aria-roledescription')).toBe('draggable')
    unmount()
  })

  it('reactive option change does NOT destroy + recreate the instance', async () => {
    const holder: {
      opts: Ref<{ axis: 'x' | 'y' | 'xy' }> | null
      instance: { value: Draggable | null } | null
    } = { opts: null, instance: null }

    const Comp = defineComponent({
      setup() {
        const opts = ref<{ axis: 'x' | 'y' | 'xy' }>({ axis: 'x' })
        const { elRef, instance } = useDraggable(opts as unknown as Ref<import('../drag').DragOptions>)
        holder.opts = opts
        holder.instance = instance as unknown as { value: Draggable | null }
        return () => h('div', { ref: elRef })
      },
    })

    const { unmount } = mount(Comp)
    const initial = holder.instance!.value
    expect(initial).not.toBeNull()

    // Mutate the reactive option. Vue flushes on the next microtask.
    holder.opts!.value = { axis: 'y' }
    await Promise.resolve()
    holder.opts!.value = { axis: 'xy' }
    await Promise.resolve()

    // Same instance reference — no teardown.
    expect(holder.instance!.value).toBe(initial)
    unmount()
  })

  it('callback identity change routes through without recreating the instance', async () => {
    const first = vi.fn()
    const second = vi.fn()

    // Using module-level holders so the component can see the latest opts
    // ref. Mutating opts.value with a fresh object (different onDragMove) is
    // the scenario we care about: the wrapped callback must dispatch to the
    // NEW function without tearing down the Draggable.
    const holder: {
      opts: Ref<import('../drag').DragOptions> | null
      instance: { value: Draggable | null } | null
    } = { opts: null, instance: null }

    const Comp = defineComponent({
      setup() {
        const opts = ref<import('../drag').DragOptions>({
          onDragMove: first,
          threshold: 0,
        })
        holder.opts = opts
        const { elRef, instance } = useDraggable(opts)
        holder.instance = instance
        return () =>
          h('div', { ref: elRef, 'data-testid': 'target', style: 'width: 100px; height: 100px;' })
      },
    })

    const { container, unmount } = mount(Comp)
    const el = container.querySelector('[data-testid="target"]') as HTMLElement
    const originalInstance = holder.instance!.value

    // Swap callbacks. Vue flushes reactivity on the next microtask.
    holder.opts!.value = { onDragMove: second, threshold: 0 }
    await Promise.resolve()

    // Same instance — no recreation.
    expect(holder.instance!.value).toBe(originalInstance)

    // Drive a drag: the second callback should fire, not the first.
    firePointerDown(el, { clientX: 10, clientY: 10 })
    firePointerMove(document, { clientX: 40, clientY: 40 })
    flushRAF()
    firePointerUp(document, { clientX: 40, clientY: 40 })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
    unmount()
  })

  it('unmount destroys the instance', () => {
    const Comp = defineComponent({
      setup() {
        const { elRef, instance } = useDraggable({})
        ;(Comp as unknown as { __inst: unknown }).__inst = instance
        return () => h('div', { ref: elRef })
      },
    })

    const { unmount } = mount(Comp)
    const instanceRef = (Comp as unknown as { __inst: { value: Draggable | null } }).__inst
    expect(instanceRef.value).not.toBeNull()
    unmount()
    expect(instanceRef.value).toBeNull()
  })

  it('reactive option change syncs to the live instance (via updateOptions)', async () => {
    const Comp = defineComponent({
      setup() {
        const opts = ref<import('../drag').DragOptions>({ axis: 'x' })
        const { elRef, instance } = useDraggable(opts)
        ;(Comp as unknown as { __opts: Ref<import('../drag').DragOptions> }).__opts = opts
        ;(Comp as unknown as { __inst: { value: Draggable | null } }).__inst = instance
        return () => h('div', { ref: elRef })
      },
    })

    const { unmount } = mount(Comp)
    const opts = (Comp as unknown as { __opts: Ref<import('../drag').DragOptions> }).__opts
    const instance = (Comp as unknown as { __inst: { value: Draggable | null } }).__inst

    const original = instance.value
    opts.value = { axis: 'y' }
    await Promise.resolve()

    // Same instance reference after option change.
    expect(instance.value).toBe(original)
    unmount()
  })
})

describe('useSortable (Vue)', () => {
  beforeEach(() => resetRAF())

  it('creates Sortable on mount with items', () => {
    const Comp = defineComponent({
      setup() {
        const { elRef } = useSortable({})
        return () =>
          h('ul', { ref: elRef }, [
            h('li', 'a'),
            h('li', 'b'),
            h('li', 'c'),
          ])
      },
    })
    const { container, unmount } = mount(Comp)
    const ul = container.querySelector('ul') as HTMLElement
    expect(ul.getAttribute('role')).toBe('listbox')
    const items = ul.querySelectorAll('li')
    expect(items[0].getAttribute('role')).toBe('option')
    unmount()
  })
})

describe('v-draggable directive', () => {
  beforeEach(() => resetRAF())

  it('applies ARIA attributes on mount', () => {
    const app = createApp({ template: `<div v-draggable data-testid="target" />` })
    app.directive('draggable', vDraggable)
    const container = document.createElement('div')
    document.body.appendChild(container)
    app.mount(container)

    const el = container.querySelector('[data-testid="target"]') as HTMLElement
    expect(el.getAttribute('aria-roledescription')).toBe('draggable')
    app.unmount()
    container.remove()
  })

  it('updating binding options calls updateOptions (does not recreate)', async () => {
    // We track recreate via ARIA: if the Draggable were recreated on update,
    // the aria-roledescription would be re-applied (same value) — hard to
    // distinguish from not-recreating. Instead, we pick an observable side
    // effect: updateOptions for `styleCursor: false` clears element.style.cursor.
    const app = createApp({
      data: () => ({ opts: { styleCursor: true } as import('../drag').DragOptions }),
      template: `<div v-draggable="opts" data-testid="target" />`,
    })
    app.directive('draggable', vDraggable)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const vm = app.mount(container) as unknown as { opts: import('../drag').DragOptions }

    const el = container.querySelector('[data-testid="target"]') as HTMLElement
    expect(el.style.cursor).toBe('grab')

    // Change options — should call updateOptions, which clears the cursor.
    vm.opts = { styleCursor: false }
    await Promise.resolve()
    await Promise.resolve()

    expect(el.style.cursor).toBe('')
    app.unmount()
    container.remove()
  })

  it('v-resizable works via plugin-less registration', () => {
    const app = createApp({ template: `<div v-resizable data-testid="target" />` })
    app.directive('resizable', vResizable)
    const container = document.createElement('div')
    document.body.appendChild(container)
    app.mount(container)

    const el = container.querySelector('[data-testid="target"]') as HTMLElement
    // Resizable sets position: relative on the element.
    expect(el.style.position).toBe('relative')
    app.unmount()
    container.remove()
  })
})

describe('pointer-driven behaviour', () => {
  beforeEach(() => resetRAF())

  it('composable-attached Draggable fires onDragMove through the ref', () => {
    const onDragMove = vi.fn()
    const Comp = defineComponent({
      setup() {
        const { elRef } = useDraggable({ onDragMove, threshold: 0 })
        return () => h('div', { ref: elRef, 'data-testid': 'target' })
      },
    })

    const { container, unmount } = mount(Comp)
    const el = container.querySelector('[data-testid="target"]') as HTMLElement

    firePointerDown(el, { clientX: 10, clientY: 10 })
    firePointerMove(document, { clientX: 40, clientY: 40 })
    flushRAF()
    firePointerUp(document, { clientX: 40, clientY: 40 })

    expect(onDragMove).toHaveBeenCalled()
    unmount()
  })
})
