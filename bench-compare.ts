// Live side-by-side benchmark: pointrix vs interact.js in a real browser.
//
// Methodology:
//  - Both sides get the same number of items with the same drag options.
//  - Mount time is measured around the creation loop (synchronous).
//  - FPS and frame-time percentiles are sampled PER SIDE, and only while
//    that side has an active pointer press — so moving a pointrix item
//    doesn't tax the interact.js FPS meter and vice versa.
//  - Frame-time samples are a sliding window of the last 240 frames.
//
// The test does not try to be automated — it's a visual sanity check.
// The headless vitest benches give the reproducible numbers.

import interact from 'interactjs'
import { draggable, Draggable } from './src/drag'

type PanelKey = 'p' | 'i'

interface PanelState {
  count: number
  mountMs: number
  // Frame samples (sliding window)
  frames: number[]
  lastFrameStart: number | null
  // Active FPS window
  framesInSecond: number
  lastSecond: number
  currentFps: number
  // Active pointer tracking — only sample while pressed.
  activePointers: Set<number>
}

const state: Record<PanelKey, PanelState> = {
  p: emptyState(),
  i: emptyState(),
}

function emptyState(): PanelState {
  return {
    count: 0,
    mountMs: 0,
    frames: [],
    lastFrameStart: null,
    framesInSecond: 0,
    lastSecond: performance.now(),
    currentFps: 0,
    activePointers: new Set(),
  }
}

const pointrixStage = document.getElementById('pointrix-stage') as HTMLElement
const interactStage = document.getElementById('interact-stage') as HTMLElement

const pointrixInstances: Draggable[] = []

function mountPointrix(n: number): number {
  clearPointrix()
  const start = performance.now()
  const frag = document.createDocumentFragment()
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'item p'
    el.textContent = String(i)
    frag.appendChild(el)
  }
  pointrixStage.appendChild(frag)
  // Create draggables after DOM insertion to match typical library usage.
  for (const el of pointrixStage.children) {
    pointrixInstances.push(
      draggable(el as HTMLElement, {
        onDragStart: (e) => onDragStart('p', e.originalEvent.pointerId),
        onDragMove: () => {
          /* nothing — the library writes the transform itself */
        },
        onDragEnd: (e) => onDragEnd('p', e.originalEvent.pointerId),
      }),
    )
  }
  const elapsed = performance.now() - start
  state.p.count = n
  state.p.mountMs = elapsed
  return elapsed
}

function clearPointrix() {
  for (const inst of pointrixInstances) inst.destroy()
  pointrixInstances.length = 0
  pointrixStage.textContent = ''
  state.p = emptyState()
}

function mountInteract(n: number): number {
  clearInteract()
  const start = performance.now()
  const frag = document.createDocumentFragment()
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'item i'
    el.textContent = String(i)
    frag.appendChild(el)
  }
  interactStage.appendChild(frag)
  for (const el of interactStage.children) {
    interact(el as HTMLElement).draggable({
      listeners: {
        start: (e) => onDragStart('i', e.pointerId ?? 0),
        move: (e) => {
          // interact.js exposes dx/dy; we have to write the transform ourselves.
          const target = e.target as HTMLElement
          const tx = (parseFloat(target.dataset.x || '0') + e.dx) || 0
          const ty = (parseFloat(target.dataset.y || '0') + e.dy) || 0
          target.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
          target.dataset.x = String(tx)
          target.dataset.y = String(ty)
        },
        end: (e) => onDragEnd('i', e.pointerId ?? 0),
      },
    })
  }
  const elapsed = performance.now() - start
  state.i.count = n
  state.i.mountMs = elapsed
  return elapsed
}

function clearInteract() {
  for (const el of Array.from(interactStage.children)) {
    interact(el as HTMLElement).unset()
  }
  interactStage.textContent = ''
  state.i = emptyState()
}

function onDragStart(side: PanelKey, pointerId: number) {
  state[side].activePointers.add(pointerId)
  // Reset per-press timing so we only measure this interaction.
  state[side].lastFrameStart = null
  state[side].frames = []
}

function onDragEnd(side: PanelKey, pointerId: number) {
  state[side].activePointers.delete(pointerId)
}

// ──────────────────────────────────────────────────────────────
// Frame sampler: runs every frame, records dt only for sides that
// currently have an active pointer.
// ──────────────────────────────────────────────────────────────

function sampleFrame() {
  const now = performance.now()

  for (const key of ['p', 'i'] as PanelKey[]) {
    const s = state[key]
    const active = s.activePointers.size > 0
    if (active) {
      if (s.lastFrameStart != null) {
        const dt = now - s.lastFrameStart
        s.frames.push(dt)
        if (s.frames.length > 240) s.frames.shift()
      }
      s.lastFrameStart = now
      s.framesInSecond++
    } else {
      s.lastFrameStart = null
    }

    // FPS sampled per second, independent of active state — when idle, shows 0.
    if (now - s.lastSecond >= 1000) {
      s.currentFps = active ? s.framesInSecond : 0
      s.framesInSecond = 0
      s.lastSecond = now
    }
  }

  updateUI()
  requestAnimationFrame(sampleFrame)
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = arr.slice().sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[idx]
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  let sum = 0
  for (const v of arr) sum += v
  return sum / arr.length
}

function set(id: string, value: string | number) {
  const el = document.getElementById(id)
  if (el) el.textContent = typeof value === 'number' ? value.toFixed(1) : value
}

function updateUI() {
  for (const key of ['p', 'i'] as PanelKey[]) {
    const s = state[key]
    set(`${key}-count`, s.count)
    set(`${key}-fps`, s.currentFps || '—')
    set(`${key}-mount`, s.mountMs ? `${s.mountMs.toFixed(1)}` : '—')
    set(`${key}-avgframe`, s.frames.length ? avg(s.frames).toFixed(2) : '—')
    set(`${key}-p95frame`, s.frames.length ? percentile(s.frames, 0.95).toFixed(2) : '—')
  }
}

// ──────────────────────────────────────────────────────────────
// Wiring
// ──────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('button[data-n]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const n = Number(btn.dataset.n)
    mountPointrix(n)
    mountInteract(n)
    updateUI()
  })
})

document.getElementById('clear')!.addEventListener('click', () => {
  clearPointrix()
  clearInteract()
  updateUI()
})

document.getElementById('reset-metrics')!.addEventListener('click', () => {
  state.p.frames = []
  state.i.frames = []
  state.p.currentFps = 0
  state.i.currentFps = 0
  updateUI()
})

requestAnimationFrame(sampleFrame)
updateUI()
