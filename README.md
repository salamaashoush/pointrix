# Hyperact

Ultra-fast, zero-dependency drag/resize/gesture library for modern browsers. A high-performance, tree-shakeable alternative to interact.js.

## Features

- **Tiny footprint** -- core is 1.6 KB gzipped; full bundle under 10 KB gzipped
- **Zero runtime dependencies** -- nothing to audit, nothing to break
- **Modular architecture** -- import only drag, resize, gesture, dropzone, or sortable
- **Modifier pipeline** -- composable restrict, snap, inertia, magnetic snap, and auto-scroll modifiers
- **Unified pointer events** -- mouse, touch, and pen handled identically
- **RAF-batched updates** -- single shared `requestAnimationFrame` loop across all instances
- **GPU-accelerated** -- uses `translate3d` for all transforms
- **Framework integrations** -- first-class React hooks/components and Vue 3 composables/directives
- **TypeScript-first** -- strict types for every option, event, and return value
- **Tree-shakeable** -- ES module sub-path exports; bundlers drop what you don't use

## Bundle Sizes

Measured from the `dist/` output (minified with terser, gzipped):

| Import path | Min | Gzip | What you get |
|---|---|---|---|
| `hyperact/nano` | 5.4 KB | 1.6 KB | Core pointer tracking, velocity, tap detection |
| `hyperact/drag` | 11.9 KB | 3.3 KB | Draggable with axis, bounds, grid, momentum, modifiers |
| `hyperact/resize` | 11.5 KB | 3.2 KB | Resizable with edges, aspect ratio, min/max, modifiers |
| `hyperact/gesture` | 8.3 KB | 2.3 KB | Multi-touch pinch, rotate, pan |
| `hyperact/dropzone` | 3.0 KB | 1.0 KB | Drop targets with overlap modes |
| `hyperact/sortable` | 18.2 KB | 5.0 KB | Sortable lists with cross-container group support |
| `hyperact/modifiers` | 8.3 KB | 2.6 KB | All modifiers (restrict, snapGrid, snapTargets, magneticSnap, inertia, autoScroll) |
| `hyperact` | 38.6 KB | 9.8 KB | Full bundle with everything |

For comparison, interact.js ships approximately 140 KB minified.

## Installation

```bash
npm install hyperact
# or
pnpm add hyperact
# or
yarn add hyperact
```

## Quick Start

```ts
import { draggable } from 'hyperact/drag'

const drag = draggable('#my-element', {
  onDragMove: (e) => console.log(e.totalX, e.totalY),
})

// Later:
drag.destroy()
```

Every factory function accepts an `HTMLElement` or a CSS selector string. Every instance has a `.destroy()` method and an `.enabled` property.

---

## API Reference

### Draggable

```ts
import { draggable } from 'hyperact/drag'
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `axis` | `'x' \| 'y' \| 'xy'` | `'xy'` | Constrain movement to one axis |
| `handle` | `string \| HTMLElement` | -- | Only start drag when pointer is inside this element/selector |
| `bounds` | `'parent' \| HTMLElement \| {left?, top?, right?, bottom?}` | -- | Restrict movement within a region |
| `grid` | `{x: number, y: number}` | -- | Snap position to a grid |
| `momentum` | `boolean \| {friction?: number, minSpeed?: number}` | `false` | Physics-based momentum after release |
| `droppable` | `boolean` | `false` | Integrate with `Dropzone` system |
| `modifiers` | `Modifier[]` | -- | Modifier chain applied each frame |
| `threshold` | `number` | `3` | Pixels of movement before drag starts |
| `preventScroll` | `boolean` | `true` | Prevent touch scrolling while dragging |

#### Events

| Callback | Event type | Key fields |
|---|---|---|
| `onDragStart` | `DragEvent` | `dx`, `dy`, `totalX`, `totalY`, `velocityX`, `velocityY` |
| `onDragMove` | `DragEvent` | Same as above, updated each frame |
| `onDragEnd` | `DragEvent` | Final values |

#### Methods

```ts
const d = draggable(el, options)
d.setPosition(100, 200)       // Jump to a transform position
d.getPosition()               // { x: number, y: number }
d.enabled = false              // Disable (cancels active drag)
d.destroy()                    // Remove all listeners
```

#### Example

```ts
import { draggable } from 'hyperact/drag'
import { snapGrid, inertia } from 'hyperact/modifiers'

draggable('#card', {
  bounds: 'parent',
  momentum: { friction: 0.92 },
  modifiers: [
    snapGrid({ x: 20, y: 20 }),
    inertia({ resistance: 8 }),
  ],
  onDragEnd: (e) => console.log('Dropped at', e.totalX, e.totalY),
})
```

---

### Resizable

```ts
import { resizable } from 'hyperact/resize'
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `edges` | `{top?, right?, bottom?, left?}` (booleans) | All `true` | Which edges/corners can be dragged |
| `handleSize` | `number` | `10` | Pixel width of the resize handle area |
| `minWidth` | `number` | `50` | Minimum width in px |
| `minHeight` | `number` | `50` | Minimum height in px |
| `maxWidth` | `number` | `Infinity` | Maximum width in px |
| `maxHeight` | `number` | `Infinity` | Maximum height in px |
| `aspectRatio` | `number \| 'preserve'` | -- | Lock aspect ratio (number or preserve current) |
| `grid` | `{width: number, height: number}` | -- | Snap size to a grid |
| `modifiers` | `Modifier[]` | -- | Modifier chain |

#### Events

| Callback | Event type | Key fields |
|---|---|---|
| `onResizeStart` | `ResizeEvent` | `width`, `height`, `deltaWidth`, `deltaHeight`, `edges` |
| `onResizeMove` | `ResizeEvent` | Same, updated each frame |
| `onResizeEnd` | `ResizeEvent` | Final values |

#### Methods

```ts
const r = resizable(el, options)
r.setSize(300, 200)
r.getSize()                    // { width: number, height: number }
r.enabled = false
r.destroy()
```

#### Example

```ts
resizable('#panel', {
  edges: { right: true, bottom: true },
  minWidth: 200,
  aspectRatio: 16 / 9,
  onResizeMove: (e) => console.log(`${e.width}x${e.height}`),
})
```

---

### Gesturable

```ts
import { gesturable } from 'hyperact/gesture'
```

Multi-touch gesture recognition (pinch-to-zoom, rotate). Activates when the required number of pointers are down.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `minPointers` | `number` | `2` | Pointer count required to activate |

#### Events

| Callback | Event type | Key fields |
|---|---|---|
| `onGestureStart` | `GestureEvent` | `scale`, `rotation`, `distance`, `angle`, `center`, `deltaScale`, `deltaAngle` |
| `onGestureMove` | `GestureEvent` | Same, updated each frame |
| `onGestureEnd` | `GestureEvent` | Final values |

#### Example

```ts
import { gesturable } from 'hyperact/gesture'

gesturable('#canvas', {
  onGestureMove: (e) => {
    applyZoom(e.scale)
    applyRotation(e.rotation)
  },
})
```

---

### Dropzone

```ts
import { dropzone } from 'hyperact/dropzone'
```

Define drop targets that respond to `draggable` elements created with `droppable: true`.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `accept` | `string \| (el: HTMLElement) => boolean` | -- | Filter which draggables can drop here |
| `overlap` | `'pointer' \| 'center' \| number` | `'pointer'` | How overlap is computed (`number` = area ratio threshold) |
| `activeClass` | `string` | -- | CSS class added while a compatible drag is in progress |
| `hoverClass` | `string` | -- | CSS class added while a draggable hovers over the zone |

#### Events

| Callback | Event type | Description |
|---|---|---|
| `onActivate` | `DropEvent` | A compatible drag started somewhere |
| `onDeactivate` | `DropEvent` | That drag ended |
| `onDragEnter` | `DropEvent` | Draggable entered this zone |
| `onDragLeave` | `DropEvent` | Draggable left this zone |
| `onDragOver` | `DropEvent` | Draggable is over this zone (fires each frame) |
| `onDrop` | `DropEvent` | Draggable was released over this zone |

`DropEvent` contains `target` (dropzone element), `draggable` (the dragged element), `overlap` (number), and `dragEvent`.

#### Example

```ts
import { draggable } from 'hyperact/drag'
import { dropzone } from 'hyperact/dropzone'

draggable('#item', { droppable: true })

dropzone('#bin', {
  accept: '.deletable',
  hoverClass: 'drop-hover',
  onDrop: (e) => e.draggable.remove(),
})
```

---

### Sortable

```ts
import { sortable } from 'hyperact/sortable'
```

Drag-to-reorder lists with animated item displacement. Supports cross-container transfers via the `group` option.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `string` | direct children | CSS selector for sortable items |
| `axis` | `'x' \| 'y'` | `'y'` | Sort direction |
| `handle` | `string` | -- | CSS selector for drag handle within each item |
| `animationDuration` | `number` | `200` | Transition duration in ms for shifting items |
| `dragClass` | `string` | `'sortable-dragging'` | CSS class on the item being dragged |
| `hoverClass` | `string` | `'sortable-hover'` | CSS class on a container receiving a grouped item |
| `group` | `string` | -- | Group name; sortables sharing a group can exchange items |

#### Events

| Callback | Event type | Description |
|---|---|---|
| `onSort` | `SortEvent` | Order changed during drag (`item`, `oldIndex`, `newIndex`, `items`) |
| `onSortEnd` | `SortEvent` | Drag finished and DOM was reordered |
| `onAdd` | `SortTransferEvent` | An item was added from another sortable (`item`, `from`, `to`, `oldIndex`, `newIndex`) |
| `onRemove` | `SortTransferEvent` | An item was removed to another sortable |

#### Methods

```ts
const s = sortable('#list', options)
s.getOrder()                   // Current item elements in order
s.move(fromIndex, toIndex)     // Programmatic reorder
s.refresh()                    // Re-scan items (after DOM changes)
s.enabled = false
s.destroy()
```

#### Example -- single list

```ts
sortable('#todo-list', {
  handle: '.grip',
  onSortEnd: (e) => saveOrder(e.items.map(el => el.dataset.id)),
})
```

#### Example -- cross-container groups

```ts
sortable('#backlog', { group: 'kanban', onRemove: (e) => console.log('removed', e.item) })
sortable('#in-progress', { group: 'kanban', onAdd: (e) => console.log('added', e.item) })
sortable('#done', { group: 'kanban' })
```

---

### Modifiers

```ts
import { restrict, snapGrid, snapTargets, magneticSnap, inertia, autoScroll } from 'hyperact/modifiers'
```

Modifiers are composable transforms applied to the position each frame. Pass them as an array to the `modifiers` option of `draggable` or `resizable`.

#### `restrict(options)`

Clamp position within bounds.

| Option | Type | Description |
|---|---|---|
| `bounds` | `'parent' \| HTMLElement \| {left?, top?, right?, bottom?}` | Bounding region |
| `elementRect` | `{left, top, right, bottom}` (0-1 ratios) | Which part of the element must stay inside bounds |
| `endOnly` | `boolean` | Only apply restriction at drag end |

#### `snapGrid(options)`

Snap to a regular grid.

| Option | Type | Description |
|---|---|---|
| `x` | `number` | Grid cell width |
| `y` | `number` | Grid cell height |
| `offset` | `{x, y}` | Grid origin offset |
| `limits` | `{top?, left?, bottom?, right?}` | Clamp snapped position |

#### `snapTargets(options)`

Snap to arbitrary target positions with pivot support.

| Option | Type | Description |
|---|---|---|
| `targets` | `SnapTarget[]` | Array of `{x?, y?, range?}` |
| `range` | `number` (default `50`) | Default snap distance |
| `relativePoints` | `Array<PivotPreset \| {x, y}>` | Which point(s) on the element to test |
| `coordinateMode` | `'offset' \| 'parent'` | Target coordinate system |

**Pivot presets:** `'top-left'`, `'top'`, `'top-right'`, `'left'`, `'center'`, `'right'`, `'bottom-left'`, `'bottom'`, `'bottom-right'`

The returned modifier exposes `snappedTarget`, `snappedIndex`, and `isSnapped` for reading snap state.

#### `magneticSnap(options)`

Attract the element toward named targets with distance-based pull strength.

| Option | Type | Description |
|---|---|---|
| `targets` | `MagneticTarget[]` | Array of `{id, x, y, width?, height?, strength?}` |
| `distance` | `number` (default `30`) | Activation distance |
| `strength` | `number` (default `0.5`) | Pull strength (0-1) |
| `onSnap` | `(target) => void` | Called when element snaps to a target |
| `onUnsnap` | `(target) => void` | Called when element leaves a target |

Methods: `updateTargets(targets)`, `addTarget(target)`, `removeTarget(id)`, `getCurrentTarget()`, `isSnapped()`.

#### `inertia(options?)`

Continue movement after release using exponential decay.

| Option | Type | Default | Description |
|---|---|---|---|
| `resistance` | `number` | `10` | Decay constant (higher = more friction) |
| `minSpeed` | `number` | `10` | Speed below which inertia stops |
| `endSpeed` | `number` | `100` | Minimum release speed to trigger inertia |
| `smoothEnd` | `boolean` | `false` | Decelerate smoothly to current position |
| `smoothEndDuration` | `number` | `300` | Duration for smooth end (ms) |

#### `autoScroll(options?)`

Scroll a container when the pointer approaches its edges.

| Option | Type | Default | Description |
|---|---|---|---|
| `container` | `HTMLElement \| Window` | auto-detected | Scroll container |
| `speed` | `number` | `10` | Scroll speed (px/frame) |
| `margin` | `number` | `50` | Edge proximity threshold (px) |
| `acceleration` | `number` | `5` | Acceleration multiplier |

#### Composing modifiers

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

Modifiers run in array order. Each modifier receives the output of the previous one.

---

### Interactable

```ts
import { interactable } from 'hyperact'
```

Convenience factory that creates drag, resize, and gesture instances on the same element. Hyperact coordinates them automatically (resize has priority over drag when pointer is near an edge).

```ts
const ia = interactable('#widget', {
  drag: { momentum: true },
  resize: { edges: { right: true, bottom: true }, minWidth: 120 },
  gesture: true,
})

ia.drag    // Draggable | null
ia.resize  // Resizable | null
ia.gesture // Gesturable | null
ia.destroy()
```

Pass `true` for default options or an options object.

---

## React Integration

```ts
import { useDraggable, useResizable, useGesturable, useDropzone, useSortable, useInteractable } from 'hyperact/react'
```

Each hook returns `{ ref, instance }`. Attach `ref` to your element; read or control the interaction through `instance.current`.

### Hooks

```tsx
function DraggableCard() {
  const { ref } = useDraggable({
    bounds: 'parent',
    onDragEnd: (e) => console.log(e.totalX, e.totalY),
  })

  return <div ref={ref}>Drag me</div>
}
```

Pass a dependency array as the second argument to recreate the instance when values change:

```tsx
const { ref } = useDraggable({ axis }, [axis])
```

### Components

Pre-built components that forward options as props:

```tsx
import { DraggableComponent, ResizableComponent, InteractableComponent } from 'hyperact/react'

<DraggableComponent bounds="parent" as="section" className="card">
  Content
</DraggableComponent>
```

The `as` prop controls the rendered element (default `div`).

### Available hooks and components

| Hook | Component | Import |
|---|---|---|
| `useHyperact` | `HyperactComponent` | `hyperact/react` |
| `useDraggable` | `DraggableComponent` | `hyperact/react` |
| `useResizable` | `ResizableComponent` | `hyperact/react` |
| `useGesturable` | `GesturableComponent` | `hyperact/react` |
| `useDropzone` | -- | `hyperact/react` |
| `useSortable` | -- | `hyperact/react` |
| `useInteractable` | `InteractableComponent` | `hyperact/react` |

---

## Vue 3 Integration

```ts
import { useDraggable, vDraggable, HyperactPlugin } from 'hyperact/vue'
```

### Composables

Each composable returns `{ elRef, instance }`. Bind `elRef` with `ref=` in your template.

```vue
<script setup lang="ts">
import { useDraggable } from 'hyperact/vue'

const { elRef } = useDraggable({
  bounds: 'parent',
  onDragEnd: (e) => console.log(e.totalX, e.totalY),
})
</script>

<template>
  <div :ref="elRef">Drag me</div>
</template>
```

Pass a `ref()` as options to automatically recreate the instance when options change:

```ts
const opts = ref<DragOptions>({ axis: 'x' })
const { elRef } = useDraggable(opts)
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
import { HyperactPlugin } from 'hyperact/vue'

createApp(App).use(HyperactPlugin).mount('#app')
```

This registers `v-draggable`, `v-resizable`, `v-gesturable`, and `v-sortable`.

### Available composables and directives

| Composable | Directive |
|---|---|
| `useHyperact` | -- |
| `useDraggable` | `vDraggable` |
| `useResizable` | `vResizable` |
| `useGesturable` | `vGesturable` |
| `useDropzone` | -- |
| `useSortable` | `vSortable` |
| `useInteractable` | -- |

---

## Tree-Shaking and Sub-Path Imports

Every module is available as a separate entry point. Your bundler will only include the code you actually import.

```ts
// Only drag -- pulls in nano as a dependency (~3.3 KB gzip)
import { draggable } from 'hyperact/drag'

// Only modifiers
import { snapGrid, inertia } from 'hyperact/modifiers'

// Only React hooks
import { useDraggable } from 'hyperact/react'

// Only Vue composables
import { useDraggable } from 'hyperact/vue'

// Full bundle if you need everything
import { interactable, draggable, resizable, gesturable, dropzone, sortable } from 'hyperact'
```

All entry points ship ESM (`.mjs`) and CJS (`.cjs`) with full TypeScript declarations.

## License

MIT
