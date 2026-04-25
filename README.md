# pointrix

Ultra-fast, zero-dependency drag / resize / gesture library for modern browsers. Drop-in alternative to interact.js with a fraction of the bundle size and faster per-event hot path.

- **14.4 KB gzipped** full bundle (2.5 KB gzipped for just pointer tracking). interact.js is ~100 KB gzipped.
- **13–15× faster synchronous event-dispatch cost** than interact.js in real Chromium (see [Benchmarks](#benchmarks)).
- Tree-shakeable sub-path exports: pull in only `drag`, only `sortable`, only React, etc.
- Zero runtime dependencies. Zero global state.
- TypeScript-first, ESM + CJS, strict typing throughout.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Core options](#core-options)
- [Draggable](#draggable)
- [Resizable](#resizable)
- [Gesturable](#gesturable)
- [Dropzone](#dropzone)
- [Sortable](#sortable)
- [Modifiers](#modifiers)
- [Custom geometry: `rectChecker` and `origin`](#custom-geometry-rectchecker-and-origin)
- [Imperative API: cancel, updateOptions, startFromEvent](#imperative-api)
- [Interactable (combined)](#interactable-combined)
- [React integration](#react-integration)
- [Vue 3 integration](#vue-3-integration)
- [Accessibility](#accessibility)
- [Bundle sizes and tree-shaking](#bundle-sizes-and-tree-shaking)
- [Benchmarks](#benchmarks)

---

## Install

```bash
npm install pointrix
# or
pnpm add pointrix
# or
bun add pointrix
```

All entry points ship ESM (`.mjs`) and CJS (`.cjs`) with full TypeScript declarations.

## Quick start

```ts
import { draggable } from 'pointrix/drag'

const drag = draggable('#my-element', {
  bounds: 'parent',
  onDragMove: (e) => console.log(e.totalX, e.totalY),
})

// Later:
drag.destroy()
```

Every factory accepts an `HTMLElement` or a CSS selector string. Every instance has `.destroy()`, `.cancel()`, and an `.enabled` property.

---

## Core options

`PointrixOptions` is the base shape every interaction inherits (Draggable, Resizable, Gesturable).

| Option           | Type                                | Default   | Description                                                                                                                                                             |
| ---------------- | ----------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `threshold`      | `number`                            | `3`       | Pixels of movement before the interaction starts                                                                                                                        |
| `preventScroll`  | `boolean`                           | `true`    | `preventDefault()` on pointermove to block touch scroll. When `false`, the library registers a passive pointermove listener (faster scroll on non-interacting regions). |
| `holdDelay`      | `number`                            | `0`       | Pointer must be held this long (ms) before the interaction starts                                                                                                       |
| `holdDuration`   | `number`                            | `600`     | Time in ms before `onHold` fires (pointer stationary, no interaction yet)                                                                                               |
| `doubleTapDelay` | `number`                            | `300`     | Max ms between taps to register a double-tap                                                                                                                            |
| `mouseButtons`   | `number`                            | `0` (any) | Bitmask: `1` = left, `2` = right, `4` = middle                                                                                                                          |
| `allowFrom`      | `string`                            | —         | CSS selector — only start when the pointer target matches                                                                                                               |
| `ignoreFrom`     | `string`                            | —         | CSS selector — never start when the pointer target matches                                                                                                              |
| `touchAction`    | `string`                            | `'none'`  | CSS `touch-action` applied to the element                                                                                                                               |
| `styleCursor`    | `boolean`                           | `true`    | Whether to set cursor styles automatically                                                                                                                              |
| `rectChecker`    | `(el) => DOMRect`                   | —         | Custom geometry resolver (see [Custom geometry](#custom-geometry-rectchecker-and-origin))                                                                               |
| `origin`         | `HTMLElement \| 'parent' \| {x, y}` | —         | Translate pointer coords relative to this element/offset                                                                                                                |
| `onStart`        | `(event) => void`                   | —         | Interaction started                                                                                                                                                     |
| `onMove`         | `(event) => void`                   | —         | Pointer moved during an active interaction                                                                                                                              |
| `onEnd`          | `(event) => void`                   | —         | Interaction ended                                                                                                                                                       |
| `onCancel`       | `(event) => void`                   | —         | Interaction was cancelled via `.cancel()` or `enabled=false`                                                                                                            |
| `onTap`          | `(event) => void`                   | —         | Pointer released without exceeding threshold                                                                                                                            |
| `onDoubleTap`    | `(event) => void`                   | —         | Two taps within `doubleTapDelay` ms on the same target                                                                                                                  |
| `onHold`         | `(event) => void`                   | —         | Pointer held stationary for `holdDuration` ms without starting an interaction                                                                                           |

Every instance exposes:

- `.destroy()` — remove all listeners and state.
- `.cancel()` — force-end the current interaction (fires `onCancel` and `onEnd`).
- `.enabled` (get/set) — toggle responsiveness. Setting to `false` during an interaction cancels it.
- `.interacting` (get) — `true` while an interaction is active.
- `.updateOptions(partial)` — swap options without tearing down the instance.
- `.startFromEvent(pointerEvent)` — programmatically start an interaction from a captured PointerEvent.

See [Imperative API](#imperative-api) for details.

### Global configuration

```ts
import { setMaxInteractions, getActiveInteractionCount } from 'pointrix'

setMaxInteractions(2) // Cap concurrent drags/resizes/gestures across the whole page.
getActiveInteractionCount() // Current active count.
```

---

## Draggable

```ts
import { draggable } from 'pointrix/drag'
```

### Options

Extends `PointrixOptions` plus:

| Option          | Type                                                        | Default | Description                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axis`          | `'x' \| 'y' \| 'xy' \| 'auto'`                              | `'xy'`  | Constrain movement. `'auto'` locks to whichever axis the user moves first (decided once per drag).                                                                                |
| `handle`        | `string \| HTMLElement`                                     | —       | Only start drag when pointer is inside this element/selector                                                                                                                      |
| `bounds`        | `'parent' \| HTMLElement \| {left?, top?, right?, bottom?}` | —       | Restrict movement within a region                                                                                                                                                 |
| `grid`          | `{x: number, y: number}`                                    | —       | Snap position to a grid                                                                                                                                                           |
| `momentum`      | `boolean \| {friction?, minSpeed?, minVelocity?}`           | `false` | Physics-based momentum after release. `friction` is remaining-velocity-per-second (0.95 = 5% loss/s). `minVelocity` (default 10 px/s) is required at lift-off to engage momentum. |
| `droppable`     | `boolean`                                                   | `false` | Integrate with the [Dropzone](#dropzone) system                                                                                                                                   |
| `modifiers`     | `Modifier[]`                                                | —       | Modifier chain applied each frame                                                                                                                                                 |
| `cursorChecker` | `(action: 'idle' \| 'grab' \| 'grabbing') => string`        | —       | Custom cursor per drag state                                                                                                                                                      |
| `aria`          | `boolean`                                                   | `true`  | Automatically apply ARIA attributes                                                                                                                                               |

### Event type

```ts
interface DragEvent extends InteractionEvent {
  dx: number // Pointer delta since last frame
  dy: number
  totalX: number // Pointer delta since drag start
  totalY: number
  velocityX: number // px/s
  velocityY: number
}
```

### Methods

```ts
const d = draggable(el, options)
d.setPosition(100, 200) // Jump to a transform position
d.getPosition() // { x, y }
d.updateOptions({ axis: 'y' })
d.cancel()
d.destroy()
```

### Example

```ts
import { draggable } from 'pointrix/drag'
import { snapGrid, inertia } from 'pointrix/modifiers'

draggable('#card', {
  bounds: 'parent',
  axis: 'auto', // Lock to first-moved axis
  momentum: { friction: 0.92 },
  modifiers: [snapGrid({ x: 20, y: 20 }), inertia({ resistance: 8 })],
  onDragEnd: (e) => console.log('Dropped at', e.totalX, e.totalY),
})
```

---

## Resizable

```ts
import { resizable } from 'pointrix/resize'
```

### Options

Extends `PointrixOptions` plus:

| Option                   | Type                                 | Default    | Description                                                                                |
| ------------------------ | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| `edges`                  | `{top?, right?, bottom?, left?}`     | all `true` | Which edges/corners can be dragged                                                         |
| `handleSize`             | `number`                             | `10`       | Pixel width of the resize handle area                                                      |
| `minWidth` / `minHeight` | `number`                             | `50`       | Minimum dimensions                                                                         |
| `maxWidth` / `maxHeight` | `number`                             | `Infinity` | Maximum dimensions                                                                         |
| `aspectRatio`            | `number \| 'preserve'`               | —          | Lock aspect ratio (number or preserve current)                                             |
| `square`                 | `boolean`                            | `false`    | Shorthand for `aspectRatio: 1`                                                             |
| `invert`                 | `'none' \| 'negate' \| 'reposition'` | `'none'`   | How to handle dragging past the opposite edge. `'reposition'` flips the element naturally. |
| `grid`                   | `{width: number, height: number}`    | —          | Snap size to a grid                                                                        |
| `modifiers`              | `Modifier[]`                         | —          | Modifier chain                                                                             |
| `cursorChecker`          | `(edge: string \| null) => string`   | —          | Custom cursor per edge                                                                     |

### Event type

```ts
interface ResizeEvent extends InteractionEvent {
  width: number
  height: number
  deltaWidth: number
  deltaHeight: number
  edges: { top: boolean; right: boolean; bottom: boolean; left: boolean }
}
```

### Methods

```ts
const r = resizable(el, options)
r.setSize(300, 200)
r.getSize() // { width, height }
r.updateOptions({ maxWidth: 1000 })
r.cancel()
r.destroy()
```

### Example

```ts
resizable('#panel', {
  edges: { right: true, bottom: true },
  minWidth: 200,
  aspectRatio: 16 / 9,
  onResizeMove: (e) => console.log(`${e.width}×${e.height}`),
})
```

---

## Gesturable

```ts
import { gesturable } from 'pointrix/gesture'
```

Multi-touch pinch / rotate / pan recognition. Activates when the required number of pointers are down.

### Options

Extends `PointrixOptions` plus:

| Option        | Type     | Default | Description                        |
| ------------- | -------- | ------- | ---------------------------------- |
| `minPointers` | `number` | `2`     | Pointer count required to activate |

### Event type

```ts
interface GestureEvent extends InteractionEvent {
  scale: number // Current / start distance ratio
  rotation: number // Degrees from start angle
  distance: number // Current pointer distance (px)
  angle: number // Current angle (degrees)
  center: { x; y }
  deltaScale: number // Scale change since last frame
  deltaAngle: number // Angle change since last frame
}
```

### Example

```ts
gesturable('#canvas', {
  onGestureMove: (e) => {
    applyZoom(e.scale)
    applyRotation(e.rotation)
  },
})
```

---

## Dropzone

```ts
import { dropzone } from 'pointrix/dropzone'
```

Define drop targets that respond to `draggable` elements created with `droppable: true`.

### Options

| Option        | Type                              | Default     | Description                                             |
| ------------- | --------------------------------- | ----------- | ------------------------------------------------------- |
| `accept`      | `string \| (el) => boolean`       | —           | Filter which draggables can drop here                   |
| `overlap`     | `'pointer' \| 'center' \| number` | `'pointer'` | How overlap is computed (`number` = minimum area ratio) |
| `activeClass` | `string`                          | —           | CSS class while a compatible drag is in progress        |
| `hoverClass`  | `string`                          | —           | CSS class while a draggable is hovering                 |
| `rectChecker` | `(el) => DOMRect`                 | —           | Custom geometry for the zone's own rect                 |
| `aria`        | `boolean`                         | `true`      | Manage `aria-dropeffect` automatically                  |

### Events

| Callback       | When                                                        |
| -------------- | ----------------------------------------------------------- |
| `onActivate`   | A compatible drag started somewhere on the page             |
| `onDeactivate` | That drag ended                                             |
| `onDragEnter`  | Draggable entered this zone                                 |
| `onDragLeave`  | Draggable left this zone                                    |
| `onDragOver`   | Draggable is over this zone (fires each frame while inside) |
| `onDrop`       | Draggable was released over this zone                       |

`DropEvent` contains `target` (zone element), `draggable`, `overlap` (number), and `dragEvent`.

### Example

```ts
draggable('#item', { droppable: true })

dropzone('#bin', {
  accept: '.deletable',
  hoverClass: 'drop-hover',
  onDrop: (e) => e.draggable.remove(),
})
```

---

## Sortable

```ts
import { sortable } from 'pointrix/sortable'
```

Drag-to-reorder lists with animated item displacement. Supports cross-container transfers via the `group` option.

### Options

| Option              | Type              | Default               | Description                                                                                                                                |
| ------------------- | ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `items`             | `string`          | direct children       | CSS selector for sortable items                                                                                                            |
| `axis`              | `'x' \| 'y'`      | `'y'`                 | Sort direction                                                                                                                             |
| `handle`            | `string`          | —                     | CSS selector for a drag handle within each item                                                                                            |
| `animationDuration` | `number`          | `200`                 | Transition duration in ms for shifting items. Respects `prefers-reduced-motion` automatically.                                             |
| `dragClass`         | `string`          | `'sortable-dragging'` | CSS class on the item being dragged                                                                                                        |
| `hoverClass`        | `string`          | `'sortable-hover'`    | CSS class on a container receiving a grouped item                                                                                          |
| `dragZIndex`        | `string`          | `'9999'`              | z-index applied to the item being dragged. Pass `''` to skip.                                                                              |
| `group`             | `string`          | —                     | Group name — sortables sharing a group can exchange items                                                                                  |
| `id`                | `(el) => string`  | —                     | Map an item element to a stable string id. When set, sort events expose `oldId`, `newId`, and an `order: string[]` for easy state binding. |
| `rectChecker`       | `(el) => DOMRect` | —                     | Custom geometry for items and container (also inherited by each item's internal Draggable)                                                 |
| `aria`              | `boolean`         | `true`                | Manage ARIA attributes and live announcements                                                                                              |

### Event types

```ts
interface SortEvent {
  item: HTMLElement
  oldIndex: number
  newIndex: number
  items: HTMLElement[]
  oldId?: string // when `id` option is set
  newId?: string // when `id` option is set
  order?: string[] // current order as ids (when `id` is set)
}

interface SortTransferEvent {
  item: HTMLElement
  from: Sortable
  to: Sortable
  oldIndex: number
  newIndex: number
  itemId?: string // when either side has `id` set
}
```

### Methods

```ts
const s = sortable('#list', options)
s.getOrder() // Current item elements in order
s.move(fromIndex, toIndex) // Programmatic reorder
s.refresh() // Re-scan items (after DOM changes)
s.updateOptions({ animationDuration: 0 })
s.destroy()
```

### Example — within a list

```ts
sortable('#todo-list', {
  handle: '.drag-handle',
  id: (el) => el.dataset.id!,
  onSortEnd: ({ order }) => saveOrder(order!), // order is string[]
})
```

### Example — cross-container groups (Kanban)

```ts
sortable('#backlog', { group: 'kanban', onRemove: (e) => console.log('removed', e.itemId) })
sortable('#in-progress', { group: 'kanban', onAdd: (e) => console.log('added', e.itemId) })
sortable('#done', { group: 'kanban' })
```

---

## Modifiers

```ts
import {
  restrict,
  snapGrid,
  snapTargets,
  magneticSnap,
  inertia,
  autoScroll,
  rubberband,
  restrictSize,
  restrictEdges,
  snapSize,
  snapEdges,
} from 'pointrix/modifiers'
```

Modifiers are composable transforms applied to the position each frame. Pass them as an array to the `modifiers` option of `draggable` or `resizable`.

### The modifier contract (for custom modifiers)

Modifiers **mutate the shared `ModifierContext` in place**. There is no return value — the context's `position`, `velocity`, and `size` fields carry the running state through the pipeline.

```ts
import type { Modifier, ModifierContext } from 'pointrix'

const halfSpeed: Modifier = {
  name: 'half-speed',
  modify(ctx: ModifierContext) {
    // Mutate in place — no allocation per frame.
    ctx.position.x *= 0.5
    ctx.position.y *= 0.5
  },
  // Optional: run once at interaction start to cache expensive setup.
  onStart(ctx) {
    /* … */
  },
  // Optional: fires at end — typical for snap-back / rubberband effects.
  onEnd(ctx) {
    /* … */
  },
}
```

This is a deliberate v1 design choice: the old "return a `ModifierResult`" API allocated ~2 objects per modifier per frame. In-place mutation kills the GC tax entirely.

### Built-in modifiers

#### `restrict({ bounds, elementRect?, endOnly? })`

Clamp position within bounds. `bounds` accepts `'parent'`, an HTMLElement, or `{left?, top?, right?, bottom?}`. `endOnly: true` clamps only on release.

#### `snapGrid({ x, y, offset?, limits? })`

Snap to a regular grid cell.

#### `snapTargets({ targets, range?, relativePoints?, coordinateMode? })`

Snap to arbitrary target positions with pivot support. Targets: `{x?, y?, range?}[]`. Pivot presets: `'top-left'`, `'top'`, `'top-right'`, `'left'`, `'center'`, `'right'`, `'bottom-left'`, `'bottom'`, `'bottom-right'` — or `{x, y}` in 0-1 ratios.

The modifier instance exposes `snappedTarget`, `snappedIndex`, `isSnapped`.

#### `magneticSnap({ targets, distance?, strength?, onSnap?, onUnsnap? })`

Attract toward named targets with distance-based pull. Targets: `{id, x, y, width?, height?, strength?}[]`.

Methods: `updateTargets(targets)`, `addTarget(target)`, `removeTarget(id)`, `getCurrentTarget()`, `isSnapped()`.

#### `inertia({ resistance?, minSpeed?, endSpeed?, smoothEnd?, smoothEndDuration? })`

Continue movement after release using exponential decay. `resistance` is the decay constant, `endSpeed` is the minimum lift-off speed to engage.

#### `autoScroll({ container?, speed?, margin?, acceleration? })`

Scroll a container when the pointer approaches its edges. `container` defaults to the nearest scrollable ancestor.

#### `rubberband({ bounds, resistance?, maxOvershoot? })`

Allow dragging past bounds with elastic resistance, snap back on release. `resistance` is 0–1 (lower = more rigid).

#### `restrictSize({ min?, max? })`

Clamp the element's size during a resize.

#### `restrictEdges({ outer?, inner? })`

Restrict individual edge positions during resize. `outer` caps outward travel; `inner` prevents edges crossing past the center.

#### `snapSize({ width?, height?, offset? })`

Snap the element's width / height to a grid during resize.

#### `snapEdges({ targets, range? })`

Snap individual edges to target positions during resize. Targets: `{left?, top?, right?, bottom?, range?}[]`.

### Composing

```ts
draggable('#el', {
  modifiers: [
    restrict({ bounds: 'parent' }),
    snapGrid({ x: 25, y: 25 }),
    inertia({ resistance: 12 }),
    autoScroll({ margin: 60 }),
  ],
})
```

Modifiers run in array order. Each sees the context mutated by the previous one.

---

## Custom geometry: `rectChecker` and `origin`

Every interaction (and dropzone, sortable) accepts two options that decouple the library from real `getBoundingClientRect()` / client-space coordinates:

- `rectChecker(el): DOMRect` — replace `el.getBoundingClientRect()` everywhere the library measures an element (bounds, edges, hit tests, sortable items).
- `origin: HTMLElement | 'parent' | {x, y}` — translate all pointer coordinates so `origin` is the `(0, 0)` reference instead of the viewport top-left.

### Why they exist

- **SVG / canvas editors** — client-space rects for inline SVG children are quirky; you often want element-local coords.
- **Virtualized lists** — off-screen rows have logical positions but no real DOM rect.
- **Test environments** — jsdom's default rect is all zeros; pass a stub instead of mocking.
- **Iframes, shadow-roots, coordinate-transformed ancestors** — normalize coords once, use them everywhere.

### Example — drive a drag with fully custom geometry

```ts
draggable(svgChild, {
  rectChecker: (el) => {
    // Convert SVG element bounds to client-space, or provide any other
    // coordinate system you want the library to operate in.
    const bbox = (el as SVGGraphicsElement).getBoundingClientRect()
    return bbox
  },
  origin: canvasRoot, // Pointer coords become relative to canvasRoot's top-left
  onDragMove: (e) => {
    // e.totalX/Y is now in canvas-local space.
  },
})
```

---

## Imperative API

### `cancel()`

Force-end an in-progress interaction. Fires `onCancel` and `onEnd` in that order, tears down internal state, removes global pointer listeners.

```ts
const d = draggable('#el', {
  onCancel: (e) => console.log('cancelled'),
})

// From anywhere — inside a callback, outside, another instance, etc.
d.cancel()
```

No-op when the interaction isn't active.

### `updateOptions(partial)`

Swap options without destroying the instance. Safe to call mid-interaction — data options (axis, bounds, grid, modifiers, etc.) take effect on the next frame; style-affecting options (cursor, touch-action) are re-applied immediately.

```ts
const d = draggable('#el', { axis: 'x' })

// Later — flip to y axis without losing state:
d.updateOptions({ axis: 'y', bounds: 'parent' })
```

Callbacks **can** be updated this way, but most React / Vue users should let their integration's option-ref forwarding handle it (it does by default).

### `startFromEvent(pointerEvent)`

Kick off an interaction from a captured `PointerEvent` — bypasses movement-threshold / hold-delay checks. Useful for triggering a drag from a button click, keyboard action, or any source that has an in-flight pointer event to start from.

```ts
const d = draggable('#el')

button.addEventListener('pointerdown', (e) => {
  d.startFromEvent(e) // Drag begins immediately
})
```

---

## Interactable (combined)

```ts
import { interactable } from 'pointrix'
```

Convenience factory that creates drag, resize, and gesture instances on the same element. The library coordinates them automatically (resize takes priority over drag when the pointer is near an edge).

```ts
const ia = interactable('#widget', {
  drag: { momentum: true },
  resize: { edges: { right: true, bottom: true }, minWidth: 120 },
  gesture: true,
})

ia.drag // Draggable | null
ia.resize // Resizable | null
ia.gesture // Gesturable | null
ia.destroy()
```

Pass `true` for defaults, an options object to configure, or omit the key entirely to skip.

### `interactAll(selector, options)`

Create `interactable` instances for every matching element, returns a single `.destroy()`.

```ts
import { interactAll } from 'pointrix'

const r = interactAll('.card', { drag: true, resize: true })
r.instances // per-element results
r.destroy() // tear down everything
```

---

## React integration

```ts
import { useDraggable, useResizable, useGesturable, useDropzone, useSortable, useInteractable } from 'pointrix/react'
```

### Hook shape

Each hook returns a `RefCallback<HTMLElement>` you attach to your JSX element. For imperative access, pass a ref as the **second** argument — matches the `useImperativeHandle` pattern.

```tsx
function DraggableCard() {
  const ref = useDraggable({
    bounds: 'parent',
    onDragEnd: (e) => console.log(e.totalX, e.totalY),
  })
  return <div ref={ref}>Drag me</div>
}
```

```tsx
import { useRef } from 'react'
import type { Draggable } from 'pointrix/drag'

function Controllable() {
  const inst = useRef<Draggable>(null)
  const ref = useDraggable({}, inst)

  return (
    <>
      <button onClick={() => inst.current?.setPosition(0, 0)}>Reset</button>
      <div ref={ref}>Drag me</div>
    </>
  )
}
```

### Key behaviors

- **Instance is created once per element.** Option changes are synced via `updateOptions` inside a layout effect — no destroy/recreate.
- **Inline callbacks are safe.** `onDragMove: (e) => setState(...)` works without memoization. The hook wraps callbacks in stable delegates that always read the latest closure.
- **Stable-reference short circuit.** If you pass the same options object two renders in a row (via memoization or a module-level constant), the sync layout effect is a no-op.

### `useStableOptions` helper

Small shallow-equality memoizer for callers who want reference stability without thinking about it:

```tsx
import { useStableOptions, useDraggable } from 'pointrix/react'

function Item({ axis, onDragMove }: Props) {
  const opts = useStableOptions({ axis, onDragMove })
  const ref = useDraggable(opts)
  return <div ref={ref} />
}
```

### Available hooks

| Hook              | Instance type               |
| ----------------- | --------------------------- |
| `usePointrix`     | `Pointrix`                  |
| `useDraggable`    | `Draggable`                 |
| `useResizable`    | `Resizable`                 |
| `useGesturable`   | `Gesturable`                |
| `useDropzone`     | `Dropzone`                  |
| `useSortable`     | `Sortable`                  |
| `useInteractable` | `{ drag, resize, gesture }` |

### React-driven sortable list

```tsx
import { useSortable } from 'pointrix/react'

function TodoList({ items, setItems }: Props) {
  const ref = useSortable({
    id: (el) => el.dataset.id!,
    onSortEnd: ({ order }) => {
      // `order` is a string[] of ids in the new order.
      const map = new Map(items.map((i) => [i.id, i]))
      setItems(order!.map((id) => map.get(id)!))
    },
  })

  return (
    <ul ref={ref}>
      {items.map((item) => (
        <li key={item.id} data-id={item.id}>
          {item.label}
        </li>
      ))}
    </ul>
  )
}
```

---

## Vue 3 integration

```ts
import { useDraggable, vDraggable, PointrixPlugin } from 'pointrix/vue'
```

### Composables

Each composable returns `{ elRef, instance }`. Bind `elRef` with `ref=` in your template.

```vue
<script setup lang="ts">
import { useDraggable } from 'pointrix/vue'

const { elRef } = useDraggable({
  bounds: 'parent',
  onDragEnd: (e) => console.log(e.totalX, e.totalY),
})
</script>

<template>
  <div :ref="elRef">Drag me</div>
</template>
```

Pass a Vue `ref()` for reactive options:

```ts
import { ref } from 'vue'

const opts = ref({ axis: 'x' as const })
const { elRef } = useDraggable(opts)
// Mutating opts.value.axis triggers recreation.
```

### Directives

```vue
<template>
  <div v-draggable="{ bounds: 'parent' }">Drag me</div>
  <div v-resizable="{ minWidth: 100 }">Resize me</div>
  <div v-gesturable>Pinch me</div>
  <div v-sortable="{ axis: 'y' }">Sort me</div>
</template>
```

### Plugin

Register all directives globally:

```ts
import { createApp } from 'vue'
import { PointrixPlugin } from 'pointrix/vue'

createApp(App).use(PointrixPlugin).mount('#app')
```

Registers `v-draggable`, `v-resizable`, `v-gesturable`, `v-sortable`.

---

## Accessibility

pointrix applies ARIA attributes and provides live screen-reader announcements for draggable, sortable, and dropzone interactions. A visually hidden `aria-live="assertive"` region and a shared instructions element are created lazily in the DOM.

Pass `aria: false` to any factory to disable ARIA management for that instance.

### Draggable ARIA

| Attribute              | Value                                |
| ---------------------- | ------------------------------------ |
| `tabindex`             | `0` (only if not already set)        |
| `role`                 | `button` (only if not already set)   |
| `aria-roledescription` | `draggable`                          |
| `aria-describedby`     | `pointrix-instructions`              |
| `aria-grabbed`         | toggled `true` / `false` during drag |

### Sortable ARIA

Container: `role="listbox"`. Each item: `role="option"`, `aria-posinset`, `aria-setsize`, `aria-roledescription="sortable"`.

Live-region announcements fire on pick-up, move, and drop.

### Dropzone ARIA

`aria-dropeffect` is toggled between `"move"` (active / at-rest) and `"none"` (no compatible drag).

### Reduced motion

pointrix checks `prefers-reduced-motion: reduce` (cached, with change listener) and:

- Skips drag-end rubberband transition.
- Sets sortable animation duration to 0.

You can call `prefersReducedMotion()` (exported from the main entry) in your own code to follow the same setting.

### i18n

All screen-reader strings are overridable via `setMessages()`:

```ts
import { setMessages } from 'pointrix'

setMessages({
  instructions: 'Leertaste oder Eingabetaste drücken zum Aufnehmen …',
  pickedUp: (label, pos, total) => `${label} aufgenommen, Position ${pos} von ${total}`,
  movedTo: (pos, total) => `Verschoben auf Position ${pos} von ${total}`,
  dropped: (label, pos, total) => `${label} abgelegt auf Position ${pos} von ${total}`,
  dragPickedUp: 'Aufgenommen',
  dragDropped: 'Abgelegt',
})
```

Read the current set with `getMessages()`.

---

## Bundle sizes and tree-shaking

Measured from the production `dist/` output (gzipped):

| Import path             |     Raw |        Gzip |
| ----------------------- | ------: | ----------: |
| `pointrix/nano`         |  8.4 KB |  **2.5 KB** |
| `pointrix/drag`         | 19.4 KB |  **5.5 KB** |
| `pointrix/resize`       | ~ 15 KB |    ~ 4.5 KB |
| `pointrix/gesture`      | ~ 11 KB |      ~ 3 KB |
| `pointrix/dropzone`     |  ~ 5 KB |    ~ 1.5 KB |
| `pointrix/sortable`     | ~ 23 KB |      ~ 6 KB |
| `pointrix/modifiers`    |  ~ 9 KB |    ~ 2.5 KB |
| `pointrix/react`        | 44.5 KB | **11.7 KB** |
| `pointrix/vue`          | 44.5 KB | **11.7 KB** |
| `pointrix` (everything) | 55.9 KB | **14.4 KB** |

For comparison: interact.js is ~100 KB gzipped.

### Sub-path imports

```ts
// Only drag (pulls in nano as a dep)
import { draggable } from 'pointrix/drag'

// Only modifiers
import { snapGrid, inertia } from 'pointrix/modifiers'

// Framework integrations
import { useDraggable } from 'pointrix/react'
import { useDraggable } from 'pointrix/vue'

// Everything
import { draggable, resizable, sortable, interactable } from 'pointrix'
```

All entry points ship ESM (`.mjs`) and CJS (`.cjs`) with `.d.mts` / `.d.cts` typings.

---

## Benchmarks

Two benchmark suites live in the repo. Ratios are the defensible number; absolute ms varies by hardware.

### Headless (vitest bench)

Run with `bun run bench`. Runs in jsdom — measures computation, not event dispatch.

Representative numbers (pointrix vs interact.js, higher-is-better ratio):

| Scenario                                            |                              Speedup |
| --------------------------------------------------- | -----------------------------------: |
| 1000 base-instance setup                            |                             **3.9×** |
| 200 Draggables with options                         |                             **2.0×** |
| 100-item Sortable setup                             |                             **2.7×** |
| 200 instances × 100 option updates                  |                             **9.9×** |
| React: mount 200 draggables                         |                             **1.9×** |
| React: 200 rerenders with new axis                  |                             **8.1×** |
| React: 100 items × 10 renders with inline callbacks |                             **6.0×** |
| Hot-path position math                              | tie (both are just `Math.min`/`max`) |

### Real-browser (Playwright, Chromium)

Run with `bun run bench:browser`. Uses real `PointerEvent` dispatch inside headless Chromium.

Primary metric — **burst**: ms per event when dispatching as fast as possible (no RAF between). Captures the synchronous pointermove hot path.

| Scenario        |     pointrix |  interact.js |   Speedup |
| --------------- | -----------: | -----------: | --------: |
| draggable × 50  | 0.0016 ms/ev | 0.0234 ms/ev | **14.2×** |
| draggable × 200 | 0.0017 ms/ev | 0.0240 ms/ev | **14.6×** |
| draggable × 500 | 0.0016 ms/ev | 0.0212 ms/ev | **13.3×** |
| sortable × 50   | 0.0018 ms/ev | 0.0238 ms/ev | **13.6×** |
| sortable × 200  | 0.0016 ms/ev | 0.0243 ms/ev | **15.2×** |

pointrix is O(1) in instance count on the per-event path — adding more instances doesn't slow any one pointermove.

Under normal drag loads, both libraries hit 60Hz vsync (16.6ms/frame) because neither runs long enough to miss a frame. The ratio shows up when you stack many libraries together, handle very high-frequency pointers, or run on low-powered devices.

---

## License

MIT
