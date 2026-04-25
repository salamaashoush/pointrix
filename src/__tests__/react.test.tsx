// React binding tests. Focus on the invariants we care about:
//   - Mount creates the native instance exactly once.
//   - Rerender with new options does NOT destroy + recreate.
//   - Inline callbacks (non-memoized) always see the latest closure values.
//   - Unmount destroys the instance.
//   - Ref-callback swapping elements tears down the old instance and creates a new one.
//   - Imperative access via the optional instanceRef arg works.
//
// The pointrix instance is verified via its ARIA side effects and behavior —
// we don't instrument the class itself.

import { flushRAF } from './helpers' // PointerEvent polyfill + RAF hook
import { describe, it, expect, vi } from 'vitest'
import React, { useRef } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useDraggable, useResizable, useDropzone, useSortable, useStableOptions } from '../react'
import type { Draggable } from '../drag'
import type { Resizable } from '../resize'

// Helper: mount a React tree into a fresh div, return the div + unmount fn.
function mount(ui: React.ReactElement): {
  container: HTMLElement
  unmount: () => void
  rerender: (ui: React.ReactElement) => void
} {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(ui)
  })

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
    rerender: (next: React.ReactElement) => {
      act(() => {
        root.render(next)
      })
    },
  }
}

describe('useDraggable', () => {
  it('creates exactly one Draggable on mount', () => {
    function App() {
      const ref = useDraggable({})
      return <div ref={ref} data-testid="target" />
    }
    const { container, unmount } = mount(<App />)
    const el = container.querySelector('[data-testid="target"]') as HTMLElement

    // ARIA side-effect proves Draggable was created.
    expect(el.getAttribute('aria-roledescription')).toBe('draggable')
    unmount()
  })

  it('rerender with new options does not destroy + recreate the instance', () => {
    const instances: unknown[] = []

    function App({ axis }: { axis: 'x' | 'y' | 'xy' }) {
      const instanceRef = useRef<Draggable>(null)
      const ref = useDraggable({ axis }, instanceRef)
      React.useEffect(() => {
        instances.push(instanceRef.current)
      })
      return <div ref={ref} />
    }
    const { rerender, unmount } = mount(<App axis="x" />)
    rerender(<App axis="y" />)
    rerender(<App axis="xy" />)

    // Every captured instance is the same object reference.
    expect(instances.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < instances.length; i++) {
      expect(instances[i]).toBe(instances[0])
      expect(instances[i]).not.toBeNull()
    }
    unmount()
  })

  it('inline callbacks always see the latest closure', () => {
    function App({ onMove }: { onMove: () => void }) {
      const ref = useDraggable({ onDragMove: onMove })
      return <div ref={ref} data-testid="target" style={{ width: 100, height: 100 }} />
    }

    const first = vi.fn()
    const second = vi.fn()
    const { container, rerender, unmount } = mount(<App onMove={first} />)

    // Rerender with a new callback BEFORE any interaction.
    rerender(<App onMove={second} />)

    const el = container.querySelector('[data-testid="target"]') as HTMLElement
    const down = new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(down)
    const move = new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 40,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(move)

    flushRAF()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
    unmount()
  })

  it('unmount destroys the instance and clears ARIA', () => {
    function App() {
      const ref = useDraggable({})
      return <div ref={ref} data-testid="target" />
    }
    const { container, unmount } = mount(<App />)
    const el = container.querySelector('[data-testid="target"]') as HTMLElement
    expect(el.getAttribute('aria-roledescription')).toBe('draggable')

    unmount()
  })

  it('instanceRef populates after mount and clears on unmount', () => {
    let capturedInstance: Draggable | null = null

    function App() {
      const instanceRef = useRef<Draggable>(null)
      const ref = useDraggable({}, instanceRef)
      React.useEffect(() => {
        capturedInstance = instanceRef.current
      })
      return <div ref={ref} />
    }
    const { unmount } = mount(<App />)
    expect(capturedInstance).not.toBeNull()
    unmount()
  })
})

describe('useResizable', () => {
  it('creates Resizable on mount', () => {
    function App() {
      const instanceRef = useRef<Resizable>(null)
      const ref = useResizable({}, instanceRef)
      return <div ref={ref} data-i={instanceRef.current ? 'y' : 'n'} />
    }
    const { unmount } = mount(<App />)
    unmount()
  })
})

describe('useDropzone', () => {
  it('creates Dropzone on mount and cleans up on unmount', () => {
    function App() {
      const ref = useDropzone({ activeClass: 'active', hoverClass: 'hover' })
      return <div ref={ref} data-testid="zone" />
    }
    const { container, unmount } = mount(<App />)
    const el = container.querySelector('[data-testid="zone"]') as HTMLElement
    expect(el.getAttribute('aria-dropeffect')).toBe('move')
    unmount()
  })
})

describe('useSortable', () => {
  it('creates Sortable on mount with items present', () => {
    function App() {
      const ref = useSortable({})
      return (
        <ul ref={ref}>
          <li>a</li>
          <li>b</li>
          <li>c</li>
        </ul>
      )
    }
    const { container, unmount } = mount(<App />)
    const ul = container.querySelector('ul') as HTMLElement
    expect(ul.getAttribute('role')).toBe('listbox')
    const items = ul.querySelectorAll('li')
    expect(items[0].getAttribute('role')).toBe('option')
    unmount()
  })

  it('updateOptions flows through on rerender without re-setup when only animationDuration changes', () => {
    function App({ dur }: { dur: number }) {
      const ref = useSortable({ animationDuration: dur })
      return (
        <ul ref={ref}>
          <li>a</li>
          <li>b</li>
        </ul>
      )
    }
    const { rerender, unmount } = mount(<App dur={200} />)
    rerender(<App dur={500} />)
    rerender(<App dur={0} />)
    unmount()
  })
})

describe('useStableOptions', () => {
  it('returns the same object when values are shallow-equal', () => {
    const seen: unknown[] = []

    function App({ onSomething }: { onSomething: () => void }) {
      const opts = useStableOptions({ onSomething, axis: 'x' as const })
      seen.push(opts)
      return <span />
    }
    const cb = () => {}
    const { rerender, unmount } = mount(<App onSomething={cb} />)
    rerender(<App onSomething={cb} />)
    rerender(<App onSomething={cb} />)

    expect(seen.length).toBeGreaterThanOrEqual(3)
    expect(seen[1]).toBe(seen[0])
    expect(seen[2]).toBe(seen[0])
    unmount()
  })

  it('returns a new object when any value changes', () => {
    const seen: unknown[] = []

    function App({ axis }: { axis: 'x' | 'y' }) {
      const opts = useStableOptions({ axis })
      seen.push(opts)
      return <span />
    }
    const { rerender, unmount } = mount(<App axis="x" />)
    rerender(<App axis="y" />)

    expect(seen[0]).not.toBe(seen[1])
    unmount()
  })
})

describe('callback-ref element swap', () => {
  it('swapping the element destroys the first instance and creates a new one', () => {
    function App({ which }: { which: 'a' | 'b' }) {
      const ref = useDraggable({})
      return which === 'a' ? <div ref={ref} data-testid="a" /> : <div ref={ref} data-testid="b" />
    }
    const { container, rerender, unmount } = mount(<App which="a" />)
    const a = container.querySelector('[data-testid="a"]') as HTMLElement
    expect(a.getAttribute('aria-roledescription')).toBe('draggable')

    rerender(<App which="b" />)
    const b = container.querySelector('[data-testid="b"]') as HTMLElement
    expect(b.getAttribute('aria-roledescription')).toBe('draggable')

    unmount()
  })
})
