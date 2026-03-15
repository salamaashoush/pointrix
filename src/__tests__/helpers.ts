// Test helpers for pointrix unit tests

import { vi } from 'vitest'

// PointerEvent polyfill for jsdom
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    readonly width: number
    readonly height: number
    readonly pressure: number
    readonly tangentialPressure: number
    readonly tiltX: number
    readonly tiltY: number
    readonly twist: number
    readonly pointerType: string
    readonly isPrimary: boolean

    constructor(type: string, params: PointerEventInit & MouseEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.width = params.width ?? 1
      this.height = params.height ?? 1
      this.pressure = params.pressure ?? 0
      this.tangentialPressure = params.tangentialPressure ?? 0
      this.tiltX = params.tiltX ?? 0
      this.tiltY = params.tiltY ?? 0
      this.twist = params.twist ?? 0
      this.pointerType = params.pointerType ?? ''
      this.isPrimary = params.isPrimary ?? false
    }

    getCoalescedEvents(): PointerEvent[] { return [] }
    getPredictedEvents(): PointerEvent[] { return [] }
  }

  ;(globalThis as any).PointerEvent = PointerEventPolyfill
}

export function createMockElement(rect?: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)

  const defaultRect: DOMRect = {
    x: 0, y: 0, width: 200, height: 200,
    top: 0, right: 200, bottom: 200, left: 0,
    toJSON() { return this },
    ...rect,
  } as DOMRect

  el.getBoundingClientRect = vi.fn().mockReturnValue(defaultRect)
  return el
}

export function firePointerDown(
  el: HTMLElement,
  opts: { clientX: number; clientY: number; pointerId?: number },
): PointerEvent {
  const e = new PointerEvent('pointerdown', {
    clientX: opts.clientX, clientY: opts.clientY,
    pointerId: opts.pointerId ?? 1, isPrimary: (opts.pointerId ?? 1) === 1,
    bubbles: true, cancelable: true,
  })
  el.dispatchEvent(e)
  return e
}

export function firePointerMove(
  target: EventTarget,
  opts: { clientX: number; clientY: number; pointerId?: number },
): PointerEvent {
  const e = new PointerEvent('pointermove', {
    clientX: opts.clientX, clientY: opts.clientY,
    pointerId: opts.pointerId ?? 1, isPrimary: (opts.pointerId ?? 1) === 1,
    bubbles: true, cancelable: true,
  })
  target.dispatchEvent(e)
  return e
}

export function firePointerUp(
  target: EventTarget,
  opts: { clientX: number; clientY: number; pointerId?: number },
): PointerEvent {
  const e = new PointerEvent('pointerup', {
    clientX: opts.clientX, clientY: opts.clientY,
    pointerId: opts.pointerId ?? 1, isPrimary: (opts.pointerId ?? 1) === 1,
    bubbles: true, cancelable: true,
  })
  target.dispatchEvent(e)
  return e
}

export function firePointerSequence(
  el: HTMLElement,
  events: Array<{
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'
    clientX: number; clientY: number; pointerId?: number
  }>,
): void {
  for (const evt of events) {
    const target = evt.type === 'pointerdown' ? el : document
    const e = new PointerEvent(evt.type, {
      clientX: evt.clientX, clientY: evt.clientY,
      pointerId: evt.pointerId ?? 1, isPrimary: (evt.pointerId ?? 1) === 1,
      bubbles: true, cancelable: true,
    })
    target.dispatchEvent(e)
  }
}

// RAF mock — captures requestAnimationFrame callbacks for synchronous flushing.
// Override the global directly — this works because nano.ts calls
// requestAnimationFrame at runtime (not import time).
const rafCallbacks: Array<FrameRequestCallback> = []
let rafCounter = 0

globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
  const id = ++rafCounter
  rafCallbacks.push(cb)
  return id
}) as typeof requestAnimationFrame

globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame

export function flushRAF(): void {
  const cbs = rafCallbacks.splice(0)
  const now = performance.now()
  for (const cb of cbs) {
    cb(now)
  }
}

// Drain any stale RAF callbacks without triggering new ones.
// Call in afterEach to prevent leaks between tests.
export function resetRAF(): void {
  rafCallbacks.length = 0
  rafCounter = 0
}

export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
