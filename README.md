# Hyperact

Ultra-fast, zero-dependency drag/resize/gesture library for modern browsers. A high-performance, tree-shakeable alternative to interact.js.

## Features

- **Tiny footprint** -- core is 1.6 KB gzipped; full bundle under 10 KB gzipped
- **Zero runtime dependencies** -- nothing to audit, nothing to break
- **Modular architecture** -- import only drag, resize, gesture, dropzone, or sortable
- **Modifier pipeline** -- composable restrict, snap, inertia, magnetic snap, rubberband, and auto-scroll modifiers
- **Unified pointer events** -- mouse, touch, and pen handled identically
- **RAF-batched updates** -- single shared `requestAnimationFrame` loop across all instances
- **GPU-accelerated** -- uses `translate3d` for all transforms
- **Framework integrations** -- first-class React hooks/components and Vue 3 composables/directives
- **TypeScript-first** -- strict types for every option, event, and return value
- **Tree-shakeable** -- ES module sub-path exports; bundlers drop what you don't use
- **Event listener API** -- chainable `.on()` / `.off()` for all interaction events
- **Batch creation** -- `interactAll()` to create instances for many elements at once
- **Advanced filtering** -- `allowFrom` / `ignoreFrom` selectors, mouse button filtering, hold delay
- **Tap and gesture detection** -- built-in tap, double-tap, and hold callbacks
- **ARIA accessibility** -- automatic ARIA attributes for draggable, sortable, and dropzone elements with live screen reader announcements
- **i18n / Localization** -- all screen reader strings are customizable via `setMessages()` for any language

## Bundle Sizes

Measured from the `dist/` output (minified with terser, gzipped):

| Import path | Min | Gzip | What you get |
|---|---|---|---|
| `pointrix/nano` | 5.4 KB | 1.6 KB | Core pointer tracking, velocity, tap detection |
| `pointrix/drag` | 11.9 KB | 3.3 KB | Draggable with axis, bounds, grid, momentum, modifiers |
| `pointrix/resize` | 11.5 KB | 3.2 KB | Resizable with edges, aspect ratio, min/max, modifiers |
| `pointrix/gesture` | 8.3 KB | 2.3 KB | Multi-touch pinch, rotate, pan |
| `pointrix/dropzone` | 3.0 KB | 1.0 KB | Drop targets with overlap modes |
| `pointrix/sortable` | 18.2 KB | 5.0 KB | Sortable lists with cross-container group support |
| `pointrix/modifiers` | 8.3 KB | 2.6 KB | All modifiers (restrict, snapGrid, snapTargets, magneticSnap, inertia, autoScroll) |
| `pointrix` | 38.6 KB | 9.8 KB | Full bundle with everything |

For comparison, interact.js ships approximately 140 KB minified.

## Installation

```bash
npm install pointrix
# or
pnpm add pointrix
# or
yarn add pointrix
```

## Quick Start

```ts
import { draggable } from 'pointrix/drag'

const drag = draggable('#my-element', {
  onDragMove: (e) => console.log(e.totalX, e.totalY),
})

// Later:
drag.destroy()
```

Every factory function accepts an `HTMLElement` or a CSS selector string. Every instance has a `.destroy()` method and an `.enabled` property.

---

## API Reference

### Core Options (HyperactOptions)

All interaction types (draggable, resizable, gesturable) inherit these base options:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `3` | Pixels of movement before interaction starts |
| `preventScroll` | `boolean` | `true` | Prevent touch scrolling while interacting |
| `holdDelay` | `number` | `0` | Hold delay in ms -- pointer must be held this long before the interaction starts |
| `mouseButtons` | `number` | `0` (any) | Bitmask of allowed mouse buttons: `1` = left, `2` = right, `4` = middle |
| `allowFrom` | `string` | -- | CSS selector -- only start if the pointer target matches |
| `ignoreFrom` | `string` | -- | CSS selector -- never start if the pointer target matches |
| `touchAction` | `string` | `'none'` | CSS `touch-action` value applied to the element |
| `styleCursor` | `boolean` | `true` | Whether to set cursor styles automatically |
| `enabled` | `boolean` | `true` | Enable or disable the instance (also available as a property) |
| `onTap` | `(event) => void` | -- | Called on tap (pointer down + up without exceeding threshold) |
| `onDoubleTap` | `(event) => void` | -- | Called on double-tap (two taps within 300 ms on the same target) |
| `onHold` | `(event) => void` | -- | Called when the pointer is held still for `holdDuration` ms without starting an interaction |
| `holdDuration` | `number` | `600` | Time in ms before `onHold` fires |

---

### Event Listener API

Every instance (Hyperact, Draggable, Resizable, Gesturable) exposes chainable `.on()` and `.off()` methods for subscribing to events imperatively. This is an alternative to passing callbacks in the options object.

```ts
const drag = draggable('#el')

drag.on('dragstart', (e) => console.log('started'))
drag.on('dragmove', (e) => console.log(e.totalX, e.totalY))
drag.off('dragmove', handler)
```

You can also read whether an interaction is currently in progress with the `.interacting` property:

```ts
if (drag.interacting) {
  console.log('drag is active')
}
```

#### Events by class

**Hyperact (nano)**

| Event | Description |
|---|---|
| `start` | Interaction started (threshold exceeded or hold delay elapsed) |
| `move` | Pointer moved during an active interaction |
| `end` | Interaction ended |
| `tap` | Pointer released without exceeding threshold |

**Draggable**

| Event | Description |
|---|---|
| `dragstart` | Drag started |
| `dragmove` | Pointer moved during drag |
| `dragend` | Drag ended |

**Resizable**

| Event | Description |
|---|---|
| `resizestart` | Resize started |
| `resizemove` | Size changed during resize |
| `resizeend` | Resize ended |

**Gesturable**

| Event | Description |
|---|---|
| `gesturestart` | Gesture started |
| `gesturemove` | Gesture updated |
| `gestureend` | Gesture ended |

---

### Draggable

```ts
import { draggable } from 'pointrix/drag'
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `axis` | `'x' \| 'y' \| 'xy' \| 'start'` | `'xy'` | Constrain movement to one axis. `'start'` auto-detects the axis from the initial movement direction |
| `startAxis` | `'x' \| 'y'` | -- | Only start the drag if the initial movement direction matches this axis |
| `handle` | `string \| HTMLElement` | -- | Only start drag when pointer is inside this element/selector |
| `bounds` | `'parent' \| HTMLElement \| {left?, top?, right?, bottom?}` | -- | Restrict movement within a region |
| `grid` | `{x: number, y: number}` | -- | Snap position to a grid |
| `momentum` | `boolean \| {friction?: number, minSpeed?: number}` | `false` | Physics-based momentum after release |
| `droppable` | `boolean` | `false` | Integrate with the `Dropzone` system |
| `modifiers` | `Modifier[]` | -- | Modifier chain applied each frame |
| `cursorChecker` | `(action: 'idle' \| 'grab' \| 'grabbing') => string` | -- | Custom function to determine the cursor for each drag state |
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
import { draggable } from 'pointrix/drag'
import { snapGrid, inertia } from 'pointrix/modifiers'

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

#### Example -- axis auto-detection

```ts
draggable('#swipeable', {
  axis: 'start', // locks to x or y based on initial swipe direction
  onDragEnd: (e) => console.log(e.totalX, e.totalY),
})
```

---

### Resizable

```ts
import { resizable } from 'pointrix/resize'
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
| `square` | `boolean` | `false` | Shorthand for `aspectRatio: 1` |
| `invert` | `'none' \| 'negate' \| 'reposition'` | `'none'` | How to handle resizing past the opposite edge. `'negate'` allows negative sizes; `'reposition'` flips the element |
| `grid` | `{width: number, height: number}` | -- | Snap size to a grid |
| `modifiers` | `Modifier[]` | -- | Modifier chain |
| `cursorChecker` | `(edge: string \| null) => string` | -- | Custom function to determine the cursor for each edge |

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

#### Example -- invert mode

```ts
resizable('#box', {
  invert: 'reposition', // allows dragging past opposite edge
  square: true,         // maintain 1:1 aspect ratio
  onResizeMove: (e) => console.log(e.width, e.height),
})
```

---

### Gesturable

```ts
import { gesturable } from 'pointrix/gesture'
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
import { gesturable } from 'pointrix/gesture'

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
import { dropzone } from 'pointrix/dropzone'
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
import { draggable } from 'pointrix/drag'
import { dropzone } from 'pointrix/dropzone'

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
import { sortable } from 'pointrix/sortable'
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
import {
  restrict, snapGrid, snapTargets, magneticSnap, inertia, autoScroll,
  rubberband, restrictSize, restrictEdges, snapSize, snapEdges,
} from 'pointrix/modifiers'
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

#### `rubberband(options)`

Allow the element to be dragged past bounds with elastic resistance, then snap back on release.

| Option | Type | Default | Description |
|---|---|---|---|
| `bounds` | `'parent' \| {left?, top?, right?, bottom?}` | -- | Bounding region |
| `resistance` | `number` | `0.15` | Resistance factor 0-1. Lower = more resistance |
| `maxOvershoot` | `number` | `100` | Maximum overshoot in pixels |

```ts
draggable('#el', {
  modifiers: [
    rubberband({ bounds: 'parent', resistance: 0.2 }),
  ],
})
```

#### `restrictSize(options)`

Clamp the element's size during a resize interaction.

| Option | Type | Description |
|---|---|---|
| `min` | `{width?: number, height?: number}` | Minimum size |
| `max` | `{width?: number, height?: number}` | Maximum size |

```ts
resizable('#panel', {
  modifiers: [
    restrictSize({ min: { width: 100, height: 100 }, max: { width: 800, height: 600 } }),
  ],
})
```

#### `restrictEdges(options)`

Restrict individual edge positions during a resize interaction.

| Option | Type | Description |
|---|---|---|
| `outer` | `{left?, top?, right?, bottom?}` | Edges cannot go beyond these values (outward limit) |
| `inner` | `{left?, top?, right?, bottom?}` | Edges cannot pass these values toward the center (inward limit) |

```ts
resizable('#panel', {
  modifiers: [
    restrictEdges({
      outer: { left: 0, top: 0, right: 800, bottom: 600 },
      inner: { left: 100, top: 100 },
    }),
  ],
})
```

#### `snapSize(options)`

Snap the element's width and height to a grid during resize.

| Option | Type | Description |
|---|---|---|
| `width` | `number` | Grid cell width for snapping |
| `height` | `number` | Grid cell height for snapping |
| `offset` | `{width?: number, height?: number}` | Grid origin offset |

```ts
resizable('#panel', {
  modifiers: [
    snapSize({ width: 50, height: 50 }),
  ],
})
```

#### `snapEdges(options)`

Snap individual edges to target positions during resize.

| Option | Type | Description |
|---|---|---|
| `targets` | `SnapEdgeTarget[]` | Array of `{left?, top?, right?, bottom?, range?}` |
| `range` | `number` (default `20`) | Default snap distance |

```ts
resizable('#panel', {
  modifiers: [
    snapEdges({
      targets: [{ left: 0, top: 0, right: 800, bottom: 600 }],
      range: 30,
    }),
  ],
})
```

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
import { interactable } from 'pointrix'
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

### interactAll()

```ts
import { interactAll } from 'pointrix'
```

Create interaction instances for every element matching a CSS selector. Returns an object with an `instances` array and a single `destroy()` method to tear down all of them.

```ts
const result = interactAll('.card', { drag: true, resize: true })

result.instances   // Array of interactable results
result.destroy()   // Destroys all instances at once
```

---

### Enabling and Disabling

Every instance has an `enabled` property. Setting it to `false` cancels any active interaction and ignores future pointer events. Setting it back to `true` re-enables the instance.

```ts
const drag = draggable('#el', { onDragMove: (e) => console.log(e.totalX) })

// Disable
drag.enabled = false

// Re-enable
drag.enabled = true
```

You can also check whether an interaction is in progress:

```ts
drag.interacting // true while a drag is active
```

---

## Accessibility (ARIA)

Hyperact automatically applies ARIA attributes and provides live screen reader announcements for draggable, sortable, and dropzone interactions. A visually hidden live region (`aria-live="assertive"`) and a shared instructions element are created lazily in the DOM when needed.

All ARIA behavior is enabled by default. No configuration is required for basic accessibility support.

### Draggable ARIA

When a `draggable` is created, the following attributes are set on the element:

| Attribute | Value | Purpose |
|---|---|---|
| `tabindex` | `0` | Makes the element keyboard-focusable (only set if not already present) |
| `role` | `button` | Identifies the element as an interactive control (only set if not already present) |
| `aria-roledescription` | `draggable` | Tells screen readers this is a draggable element |
| `aria-describedby` | `grip-instructions` | Points to a visually hidden element containing keyboard instructions |
| `aria-grabbed` | `true` / `false` | Toggled when a drag starts and ends |

Screen readers will announce the element as a "draggable button" and read the keyboard instructions on focus. When a drag starts, the live region announces "Picked up"; when it ends, "Dropped".

### Sortable ARIA

Sortable containers and their items receive additional attributes to convey list semantics and position:

**Container:**

| Attribute | Value | Purpose |
|---|---|---|
| `role` | `listbox` | Identifies the container as an ordered list (only set if not already present) |

**Items:**

| Attribute | Value | Purpose |
|---|---|---|
| `tabindex` | `0` | Keyboard-focusable |
| `role` | `option` | Identifies each item as a list option (only set if not already present) |
| `aria-roledescription` | `sortable` | Tells screen readers this is a sortable item |
| `aria-describedby` | `grip-instructions` | Keyboard instructions |
| `aria-posinset` | `1`, `2`, ... | Current position in the list (1-based) |
| `aria-setsize` | total count | Total number of items in the list |

During a sort operation, the live region announces position changes:

- **Pick up:** "Picked up [label], position 3 of 10"
- **Move:** "Moved to position 5 of 10"
- **Drop:** "Dropped [label] in position 5 of 10"

### Dropzone ARIA

Dropzone elements receive `aria-dropeffect` to communicate their state to assistive technology:

| State | `aria-dropeffect` value |
|---|---|
| Default (initialized) | `move` |
| Active (compatible drag in progress) | `move` |
| Inactive (no compatible drag) | `none` |

The attribute is toggled automatically when a compatible draggable starts or ends.

### Opting Out

Pass `aria: false` to any factory function to disable all ARIA attribute management for that instance:

```ts
draggable('#el', { aria: false })
```

### i18n / Localization

All screen reader announcement strings can be customized using `setMessages()`. This allows full translation of every ARIA string Hyperact produces.

#### The `AriaMessages` interface

```ts
interface AriaMessages {
  instructions: string
  pickedUp: (label: string, position: number, total: number) => string
  movedTo: (position: number, total: number) => string
  dropped: (label: string, position: number, total: number) => string
  dragPickedUp: string
  dragDropped: string
}
```

#### Default values

| Key | Default |
|---|---|
| `instructions` | `'Press Space or Enter to pick up. Use arrow keys to move. Press Space or Enter to drop. Press Escape to cancel.'` |
| `pickedUp` | `` (label, pos, total) => `Picked up ${label}, position ${pos} of ${total}` `` |
| `movedTo` | `` (pos, total) => `Moved to position ${pos} of ${total}` `` |
| `dropped` | `` (label, pos, total) => `Dropped ${label} in position ${pos} of ${total}` `` |
| `dragPickedUp` | `'Picked up'` |
| `dragDropped` | `'Dropped'` |

#### Overriding messages

Use `setMessages()` with a partial or full set of replacements. Any keys you omit will keep their current values.

```ts
import { setMessages } from 'pointrix'

setMessages({
  instructions: '...',
  pickedUp: (label, pos, total) => `...`,
  movedTo: (pos, total) => `...`,
  dropped: (label, pos, total) => `...`,
  dragPickedUp: '...',
  dragDropped: '...',
})
```

#### Full translation example (German)

```ts
import { setMessages } from 'pointrix'

setMessages({
  instructions:
    'Leertaste oder Eingabetaste drücken zum Aufnehmen. Pfeiltasten zum Verschieben. Leertaste oder Eingabetaste zum Ablegen. Escape zum Abbrechen.',
  pickedUp: (label, pos, total) => `${label} aufgenommen, Position ${pos} von ${total}`,
  movedTo: (pos, total) => `Verschoben auf Position ${pos} von ${total}`,
  dropped: (label, pos, total) => `${label} abgelegt auf Position ${pos} von ${total}`,
  dragPickedUp: 'Aufgenommen',
  dragDropped: 'Abgelegt',
})
```

You can also read the current messages at any time with `getMessages()`:

```ts
import { getMessages } from 'pointrix'

const current = getMessages()
console.log(current.instructions)
```

---

## React Integration

```ts
import { useDraggable, useResizable, useGesturable, useDropzone, useSortable, useInteractable } from 'pointrix/react'
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
import { DraggableComponent, ResizableComponent, InteractableComponent } from 'pointrix/react'

<DraggableComponent bounds="parent" as="section" className="card">
  Content
</DraggableComponent>
```

The `as` prop controls the rendered element (default `div`).

### Available hooks and components

| Hook | Component | Import |
|---|---|---|
| `useGrip` | `GripComponent` | `pointrix/react` |
| `useDraggable` | `DraggableComponent` | `pointrix/react` |
| `useResizable` | `ResizableComponent` | `pointrix/react` |
| `useGesturable` | `GesturableComponent` | `pointrix/react` |
| `useDropzone` | -- | `pointrix/react` |
| `useSortable` | -- | `pointrix/react` |
| `useInteractable` | `InteractableComponent` | `pointrix/react` |

---

## Vue 3 Integration

```ts
import { useDraggable, vDraggable, GripPlugin } from 'pointrix/vue'
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
import { GripPlugin } from 'pointrix/vue'

createApp(App).use(GripPlugin).mount('#app')
```

This registers `v-draggable`, `v-resizable`, `v-gesturable`, and `v-sortable`.

### Available composables and directives

| Composable | Directive |
|---|---|
| `useGrip` | -- |
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
import { draggable } from 'pointrix/drag'

// Only modifiers
import { snapGrid, inertia } from 'pointrix/modifiers'

// Only React hooks
import { useDraggable } from 'pointrix/react'

// Only Vue composables
import { useDraggable } from 'pointrix/vue'

// Full bundle if you need everything
import { interactable, interactAll, draggable, resizable, gesturable, dropzone, sortable } from 'pointrix'
```

All entry points ship ESM (`.mjs`) and CJS (`.cjs`) with full TypeScript declarations.

## License

MIT
