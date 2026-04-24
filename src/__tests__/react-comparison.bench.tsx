// React-mode benchmark: pointrix hooks vs interact.js in useEffect.
//
// interact.js has no official React hooks — users typically write:
//
//   useEffect(() => {
//     const inst = interact(ref.current).draggable({ listeners: ... })
//     return () => interact(ref.current).unset()
//   }, [...deps])
//
// Reproducing that pattern faithfully here. Each scenario uses React's
// own renderer so we measure the realistic cost users actually pay.
//
// What we're benchmarking:
//  1. Mount N items — initial setup cost
//  2. Rerender with new option — pointrix syncs via updateOptions;
//     the idiomatic interact.js useEffect pattern destroys+recreates.
//  3. Unmount N items — teardown
//
// Each bench encapsulates a full React tree lifecycle.

import { bench, describe } from 'vitest'
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import interact from 'interactjs'
import { useDraggable } from '../react'
import './helpers' // React act flag + PointerEvent polyfill

// React test-environment flag (also set by helpers.ts but belt-and-braces).
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mountRoot(ui: React.ReactElement): { container: HTMLElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(ui) })
  return { container, root }
}

function teardown(container: HTMLElement, root: Root) {
  act(() => { root.unmount() })
  container.remove()
}

// ──────────────────────────────────────────────────────────────
// interact.js-style hook — the pattern users hand-roll today.
// ──────────────────────────────────────────────────────────────

interface InteractDragOptions {
  axis?: 'x' | 'y' | undefined
  onDragMove?: () => void
}

function useInteractJsDraggable(options: InteractDragOptions) {
  const ref = React.useRef<HTMLElement | null>(null)
  // Standard React pattern — effect reruns whenever an option changes,
  // destroys + recreates the Interactable each time.
  React.useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const iface = interact(el).draggable({
      lockAxis: options.axis,
      listeners: {
        move: options.onDragMove ?? (() => {}),
      },
    })
    return () => { iface.unset() }
  }, [options.axis, options.onDragMove])
  return ref as React.RefObject<HTMLDivElement>
}

// ──────────────────────────────────────────────────────────────
// Pointrix item — uses the useDraggable hook from src/react.tsx
// ──────────────────────────────────────────────────────────────

function PointrixItem({ axis }: { axis: 'x' | 'y' | 'xy' }) {
  const ref = useDraggable({ axis, onDragMove: () => {} })
  return <div ref={ref as React.RefCallback<HTMLDivElement>} />
}

function InteractItem({ axis }: { axis: 'x' | 'y' }) {
  const ref = useInteractJsDraggable({ axis, onDragMove: () => {} })
  return <div ref={ref} />
}

// ──────────────────────────────────────────────────────────────
// 1. MOUNT COST
// ──────────────────────────────────────────────────────────────

for (const COUNT of [50, 200]) {
  describe(`Mount ${COUNT} draggables`, () => {
    bench('pointrix', () => {
      const { container, root } = mountRoot(
        React.createElement(
          'div',
          null,
          Array.from({ length: COUNT }, (_, i) => React.createElement(PointrixItem, { key: i, axis: 'xy' })),
        ),
      )
      teardown(container, root)
    })

    bench('interact.js (useEffect pattern)', () => {
      const { container, root } = mountRoot(
        React.createElement(
          'div',
          null,
          Array.from({ length: COUNT }, (_, i) => React.createElement(InteractItem, { key: i, axis: 'x' })),
        ),
      )
      teardown(container, root)
    })
  })
}

// ──────────────────────────────────────────────────────────────
// 2. RE-RENDER WITH NEW OPTIONS
//    The critical difference: pointrix calls updateOptions (shallow
//    assign, no teardown); the interact.js hook re-runs its effect,
//    which destroys + recreates every Interactable.
// ──────────────────────────────────────────────────────────────

for (const COUNT of [50, 200]) {
  describe(`Rerender ${COUNT} draggables with new axis option (10 rerenders)`, () => {
    bench('pointrix (updateOptions)', () => {
      const { container, root } = mountRoot(
        React.createElement(
          'div',
          null,
          Array.from({ length: COUNT }, (_, i) => React.createElement(PointrixItem, { key: i, axis: 'x' })),
        ),
      )
      // Rerender 10 times flipping axis each time.
      for (let r = 0; r < 10; r++) {
        const axis: 'x' | 'y' | 'xy' = r % 2 === 0 ? 'y' : 'x'
        act(() => {
          root.render(
            React.createElement(
              'div',
              null,
              Array.from({ length: COUNT }, (_, i) => React.createElement(PointrixItem, { key: i, axis })),
            ),
          )
        })
      }
      teardown(container, root)
    })

    bench('interact.js (destroy + recreate per rerender)', () => {
      const { container, root } = mountRoot(
        React.createElement(
          'div',
          null,
          Array.from({ length: COUNT }, (_, i) => React.createElement(InteractItem, { key: i, axis: 'x' })),
        ),
      )
      for (let r = 0; r < 10; r++) {
        const axis: 'x' | 'y' = r % 2 === 0 ? 'y' : 'x'
        act(() => {
          root.render(
            React.createElement(
              'div',
              null,
              Array.from({ length: COUNT }, (_, i) => React.createElement(InteractItem, { key: i, axis })),
            ),
          )
        })
      }
      teardown(container, root)
    })
  })
}

// ──────────────────────────────────────────────────────────────
// 3. PARENT-TRIGGERED RERENDER (CALLBACK IDENTITY CHANGES)
//    Common React antipattern: inline arrow function in JSX. pointrix
//    hooks handle this because callbacks route through a ref — the
//    interact.js useEffect re-runs on every render.
// ──────────────────────────────────────────────────────────────

// Module-level sink that the inline callbacks write to — forces the closure
// to capture `value` for real and prevents V8 from optimizing the callback
// identity away across renders.
let _callbackSink = 0

function PointrixItemWithCallback({ value }: { value: number }) {
  // Fresh inline callback every render — should NOT rebind.
  const ref = useDraggable({
    onDragMove: () => { _callbackSink = value },
  })
  return <div ref={ref as React.RefCallback<HTMLDivElement>} />
}

function InteractItemWithCallback({ value }: { value: number }) {
  // Fresh inline callback every render — WILL rebind (destroy + recreate).
  const ref = useInteractJsDraggable({
    axis: 'x',
    onDragMove: () => { _callbackSink = value },
  })
  return <div ref={ref} />
}

describe('Parent rerender with fresh inline callbacks (100 items × 10 rerenders)', () => {
  bench('pointrix (callback ref — no rebind)', () => {
    const { container, root } = mountRoot(
      React.createElement(
        'div',
        null,
        Array.from({ length: 100 }, (_, i) => React.createElement(PointrixItemWithCallback, { key: i, value: 0 })),
      ),
    )
    for (let r = 1; r <= 10; r++) {
      act(() => {
        root.render(
          React.createElement(
            'div',
            null,
            Array.from({ length: 100 }, (_, i) => React.createElement(PointrixItemWithCallback, { key: i, value: r })),
          ),
        )
      })
    }
    teardown(container, root)
  })

  bench('interact.js (rebinds every render)', () => {
    const { container, root } = mountRoot(
      React.createElement(
        'div',
        null,
        Array.from({ length: 100 }, (_, i) => React.createElement(InteractItemWithCallback, { key: i, value: 0 })),
      ),
    )
    for (let r = 1; r <= 10; r++) {
      act(() => {
        root.render(
          React.createElement(
            'div',
            null,
            Array.from({ length: 100 }, (_, i) => React.createElement(InteractItemWithCallback, { key: i, value: r })),
          ),
        )
      })
    }
    teardown(container, root)
  })
})
