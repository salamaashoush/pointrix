// Browser-bench page. Loads pointrix OR interact.js based on ?lib=... and
// creates N draggables based on ?count=... or a Sortable based on
// ?mode=sortable&count=N. Exposes window.__bench to the Playwright driver.
//
// We measure SYNCHRONOUS event-dispatch cost per pointermove — the library's
// per-event CPU work. Wall-clock between RAFs is useless here because both
// libraries vsync-lock to 16.7ms when the work fits in a frame; the signal
// is in the micro-tasks, not the frame deadline.
//
// Two benches are exposed:
//   run(frames) — drives one pointermove per RAF for `frames` frames,
//                 records dispatch duration + total RAF-callback duration
//                 per frame. Models realistic user drags.
//   burst(count) — dispatches `count` pointermove events in a tight loop
//                  (no RAF between), returns total ms. Pure CPU throughput.

import interact from 'interactjs'
import { draggable, type Draggable } from '../src/drag'
import { sortable, type Sortable } from '../src/sortable'

interface FrameSample {
  dispatchMs: number  // sync cost of dispatchEvent('pointermove')
  rafMs: number       // RAF-callback duration (how long after-move work took)
}

interface BenchAPI {
  readonly lib: string
  readonly count: number
  readonly mode: string
  run(frames: number): Promise<{ samples: FrameSample[]; totalMs: number }>
  burst(events: number): Promise<{ totalMs: number; perEventMs: number }>
}

declare global {
  interface Window {
    __bench: BenchAPI
    __benchReady: boolean
  }
}

const params = new URLSearchParams(location.search)
const LIB = (params.get('lib') ?? 'pointrix') as 'pointrix' | 'interact'
const COUNT = Number(params.get('count') ?? '100')
const MODE = (params.get('mode') ?? 'draggable') as 'draggable' | 'sortable'

const stage = document.getElementById('stage')!
const status = document.getElementById('status')!

// ─── Build the DOM ────────────────────────────────────────────────────────

const items: HTMLElement[] = []
let container: HTMLElement = stage

if (MODE === 'sortable') {
  container = document.createElement('div')
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1px;'
  stage.appendChild(container)
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div')
    el.className = 'item'
    el.style.cssText = 'width: 200px; height: 24px; border-radius: 3px;'
    el.textContent = String(i)
    container.appendChild(el)
    items.push(el)
  }
} else {
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div')
    el.className = 'item'
    el.textContent = String(i)
    stage.appendChild(el)
    items.push(el)
  }
}

// ─── Wire the library ────────────────────────────────────────────────────

const pointrixInstances: Draggable[] = []
let pointrixSortable: Sortable | null = null

function wirePointrixDraggable() {
  for (const el of items) pointrixInstances.push(draggable(el))
}

function wirePointrixSortable() {
  pointrixSortable = sortable(container, { aria: false })
}

function wireInteractDraggable() {
  for (const el of items) {
    interact(el).draggable({
      listeners: {
        move: (e) => {
          const target = e.target as HTMLElement
          const tx = (parseFloat(target.dataset.x ?? '0') || 0) + e.dx
          const ty = (parseFloat(target.dataset.y ?? '0') || 0) + e.dy
          target.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
          target.dataset.x = String(tx)
          target.dataset.y = String(ty)
        },
      },
    })
  }
}

function wireInteractSortable() {
  // interact.js has no native Sortable; emulate by enabling drag on each item.
  // This is what users actually do with interact.js for sortable lists.
  wireInteractDraggable()
}

if (LIB === 'pointrix') {
  if (MODE === 'sortable') wirePointrixSortable()
  else wirePointrixDraggable()
} else {
  if (MODE === 'sortable') wireInteractSortable()
  else wireInteractDraggable()
}

status.textContent = `lib=${LIB} · mode=${MODE} · count=${COUNT} · ready`

// ─── Helpers ──────────────────────────────────────────────────────────────

function dispatchPointer(type: string, target: EventTarget, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  )
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

// ─── Bench API ────────────────────────────────────────────────────────────

window.__bench = {
  lib: LIB,
  count: COUNT,
  mode: MODE,

  async run(frames) {
    const item = items[0]
    const rect = item.getBoundingClientRect()
    let x = rect.left + rect.width / 2
    let y = rect.top + rect.height / 2

    // Prime: discard first couple of frames for paint/JIT stabilization.
    await nextFrame()
    await nextFrame()

    const startTotal = performance.now()

    // pointerdown on the first item
    dispatchPointer('pointerdown', item, x, y)
    await nextFrame()

    const samples: FrameSample[] = []

    for (let i = 0; i < frames; i++) {
      x += 1
      y += 1

      const t0 = performance.now()
      dispatchPointer('pointermove', document, x, y)
      const t1 = performance.now()

      // Wait for RAF; use double-wait to ensure the library's RAF callback
      // ran and we captured its completion time relative to t1.
      await nextFrame()
      const t2 = performance.now()

      samples.push({
        dispatchMs: t1 - t0,
        rafMs: t2 - t1,
      })
    }

    dispatchPointer('pointerup', document, x, y)
    await nextFrame()

    return { samples, totalMs: performance.now() - startTotal }
  },

  async burst(events) {
    const item = items[0]
    const rect = item.getBoundingClientRect()
    let x = rect.left + rect.width / 2
    let y = rect.top + rect.height / 2

    await nextFrame()
    await nextFrame()

    dispatchPointer('pointerdown', item, x, y)
    await nextFrame()

    // Tight loop: no RAF, no awaits. Measures pure synchronous throughput of
    // the event-dispatch + listener path.
    const t0 = performance.now()
    for (let i = 0; i < events; i++) {
      x += 1
      y += 1
      dispatchPointer('pointermove', document, x, y)
    }
    const t1 = performance.now()

    dispatchPointer('pointerup', document, x, y)
    await nextFrame()

    return { totalMs: t1 - t0, perEventMs: (t1 - t0) / events }
  },
}

window.__benchReady = true
