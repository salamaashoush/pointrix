import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { useDraggable, useResizable, useInteractable, DraggableComponent, ResizableComponent } from './src/react'

// ─── Utilities ───────────────────────────────────────────────────────────────

function useRenderTimer() {
  const renderCount = useRef(0)
  const totalTime = useRef(0)

  useEffect(() => {
    const start = performance.now()
    return () => {
      totalTime.current += performance.now() - start
    }
  })

  renderCount.current++
  return {
    renderCount: renderCount.current,
    avgTime: renderCount.current > 0 ? totalTime.current / renderCount.current : 0,
  }
}

function useFPS() {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let frames = 0
    let lastTime = performance.now()
    let id: number
    function tick() {
      frames++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        setFps(frames)
        frames = 0
        lastTime = now
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
  return fps
}

function useMemoryUsage() {
  const [memory, setMemory] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      if ((performance as any).memory) {
        setMemory((performance as any).memory.usedJSHeapSize / 1048576)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [])
  return memory
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  app: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: 1400,
    margin: '0 auto',
    padding: 24,
    background: '#0a0a0f',
    color: '#e0e0e8',
    minHeight: '100vh',
  } as React.CSSProperties,
  header: {
    textAlign: 'center' as const,
    marginBottom: 48,
    padding: '32px 0',
    borderBottom: '1px solid #1e1e2e',
  } as React.CSSProperties,
  title: {
    fontSize: 36,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    color: '#8888a0',
    fontSize: 14,
    marginTop: 8,
  } as React.CSSProperties,
  metricsBar: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    marginBottom: 32,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  metric: {
    background: '#12121e',
    border: '1px solid #1e1e2e',
    borderRadius: 12,
    padding: '12px 24px',
    textAlign: 'center' as const,
    minWidth: 120,
  } as React.CSSProperties,
  metricValue: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: 'monospace',
  } as React.CSSProperties,
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase' as const,
    color: '#6668a0',
    letterSpacing: 1,
    marginTop: 4,
  } as React.CSSProperties,
  section: {
    background: '#12121e',
    border: '1px solid #1e1e2e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  badge: {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 999,
    background: '#6366f1',
    color: 'white',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  } as React.CSSProperties,
  btn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 13,
    transition: 'all 0.15s',
  } as React.CSSProperties,
  btnPrimary: {
    background: '#6366f1',
    color: 'white',
  } as React.CSSProperties,
  btnSecondary: {
    background: '#1e1e2e',
    color: '#a0a0b8',
    border: '1px solid #2a2a3e',
  } as React.CSSProperties,
  btnDanger: {
    background: '#ef4444',
    color: 'white',
  } as React.CSSProperties,
  btnGroup: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    marginBottom: 16,
  } as React.CSSProperties,
  results: {
    background: '#0a0a14',
    borderRadius: 8,
    padding: 16,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap' as const,
    color: '#a0d0a0',
    marginTop: 12,
  } as React.CSSProperties,
  grid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    maxHeight: 400,
    overflow: 'auto',
    padding: 8,
    background: '#0a0a14',
    borderRadius: 8,
  } as React.CSSProperties,
  draggableBox: {
    width: 40,
    height: 40,
    background: '#6366f1',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 600,
    color: 'white',
    touchAction: 'none',
    userSelect: 'none' as const,
    position: 'relative' as const,
  } as React.CSSProperties,
  splitView: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
  } as React.CSSProperties,
  exampleArea: {
    background: '#0a0a14',
    borderRadius: 8,
    padding: 16,
    minHeight: 300,
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
}

// ─── A. Hook Performance Test ────────────────────────────────────────────────

function DraggableItem({ index }: { index: number }) {
  const ref = useDraggable()
  const hue = (index * 7) % 360
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        ...styles.draggableBox,
        background: `hsl(${hue}, 60%, 50%)`,
      }}
    >
      {index}
    </div>
  )
}

function HookPerformanceTest() {
  const [count, setCount] = useState(0)
  const [results, setResults] = useState<string[]>([])
  const fps = useFPS()

  const mount = useCallback((n: number) => {
    const start = performance.now()
    setCount(n)
    requestAnimationFrame(() => {
      const elapsed = performance.now() - start
      setResults((prev) => [
        ...prev,
        `Mount ${n} elements: ${elapsed.toFixed(2)}ms (${(elapsed / n).toFixed(3)}ms/element)`,
      ])
    })
  }, [])

  const unmount = useCallback(() => {
    const start = performance.now()
    setCount(0)
    requestAnimationFrame(() => {
      const elapsed = performance.now() - start
      setResults((prev) => [...prev, `Unmount: ${elapsed.toFixed(2)}ms`])
    })
  }, [])

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        Hook Mount/Unmount Performance
        <span style={styles.badge}>Benchmark</span>
      </h2>
      <div style={styles.btnGroup}>
        {[100, 500, 1000].map((n) => (
          <button key={n} style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => mount(n)}>
            Mount {n}
          </button>
        ))}
        <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={unmount}>
          Unmount All
        </button>
        <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setResults([])}>
          Clear Results
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: '#6366f1' }}>{count}</div>
          <div style={styles.metricLabel}>Elements</div>
        </div>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: fps > 50 ? '#22c55e' : fps > 30 ? '#eab308' : '#ef4444' }}>
            {fps}
          </div>
          <div style={styles.metricLabel}>FPS</div>
        </div>
      </div>

      {count > 0 && (
        <div style={styles.grid}>
          {Array.from({ length: count }, (_, i) => (
            <DraggableItem key={i} index={i} />
          ))}
        </div>
      )}

      {results.length > 0 && <div style={styles.results}>{results.join('\n')}</div>}
    </div>
  )
}

// ─── B. Re-render Stress Test ────────────────────────────────────────────────

function StressItem({ index }: { index: number }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const { renderCount, avgTime } = useRenderTimer()

  const ref = useDraggable(
    {
      onDragMove: (e: any) => {
        setPos({ x: e.totalX ?? 0, y: e.totalY ?? 0 })
      },
    },
    [],
  )

  const hue = (index * 37) % 360
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        width: 80,
        height: 60,
        background: `hsl(${hue}, 55%, 45%)`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 600,
        color: 'white',
        touchAction: 'none',
        userSelect: 'none',
        position: 'relative',
        fontFamily: 'monospace',
      }}
    >
      <div>#{index}</div>
      <div style={{ fontSize: 8, opacity: 0.7 }}>
        {pos.x.toFixed(0)}, {pos.y.toFixed(0)}
      </div>
      <div style={{ fontSize: 7, opacity: 0.5 }}>
        r:{renderCount} ~{avgTime.toFixed(1)}ms
      </div>
    </div>
  )
}

function ReRenderStressTest() {
  const [count, setCount] = useState(0)
  const fps = useFPS()
  const { renderCount, avgTime } = useRenderTimer()

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        Re-render Stress Test
        <span style={styles.badge}>Stress</span>
      </h2>
      <p style={{ color: '#8888a0', fontSize: 13, marginTop: 0 }}>
        Drag any element -- each move triggers setState. Watch FPS and render counts to verify performance.
      </p>
      <div style={styles.btnGroup}>
        {[20, 50, 100].map((n) => (
          <button key={n} style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setCount(n)}>
            Spawn {n}
          </button>
        ))}
        <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={() => setCount(0)}>
          Clear
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: '#a855f7' }}>{count}</div>
          <div style={styles.metricLabel}>Elements</div>
        </div>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: fps > 50 ? '#22c55e' : fps > 30 ? '#eab308' : '#ef4444' }}>
            {fps}
          </div>
          <div style={styles.metricLabel}>FPS</div>
        </div>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: '#38bdf8' }}>{renderCount}</div>
          <div style={styles.metricLabel}>Parent Renders</div>
        </div>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: '#f97316' }}>{avgTime.toFixed(2)}</div>
          <div style={styles.metricLabel}>Avg Render (ms)</div>
        </div>
      </div>

      {count > 0 && (
        <div style={{ ...styles.grid, gap: 8 }}>
          {Array.from({ length: count }, (_, i) => (
            <StressItem key={i} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── C. Dynamic List ─────────────────────────────────────────────────────────

let nextId = 0

function DynamicItem({ id, onRemove }: { id: number; onRemove: (id: number) => void }) {
  const ref = useDraggable()
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#1a1a2e',
        borderRadius: 8,
        marginBottom: 6,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'grab',
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
      <span style={{ flex: 1, fontSize: 13 }}>Item #{id}</span>
      <button
        style={{
          ...styles.btn,
          ...styles.btnDanger,
          padding: '4px 10px',
          fontSize: 11,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(id)}
      >
        Remove
      </button>
    </div>
  )
}

function DynamicListTest() {
  const [items, setItems] = useState<number[]>([])
  const memory = useMemoryUsage()

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, nextId++])
  }, [])

  const addMany = useCallback((n: number) => {
    const newItems: number[] = []
    for (let i = 0; i < n; i++) newItems.push(nextId++)
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item !== id))
  }, [])

  const removeAll = useCallback(() => {
    setItems([])
  }, [])

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        Dynamic List
        <span style={styles.badge}>Lifecycle</span>
      </h2>
      <p style={{ color: '#8888a0', fontSize: 13, marginTop: 0 }}>
        Tests hook mount/unmount lifecycle. Add and remove items to verify no memory leaks.
      </p>
      <div style={styles.btnGroup}>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={addItem}>
          Add 1
        </button>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => addMany(10)}>
          Add 10
        </button>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => addMany(50)}>
          Add 50
        </button>
        <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={removeAll}>
          Remove All
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: '#22c55e' }}>{items.length}</div>
          <div style={styles.metricLabel}>Active Items</div>
        </div>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: '#eab308' }}>{nextId}</div>
          <div style={styles.metricLabel}>Total Created</div>
        </div>
        {memory > 0 && (
          <div style={styles.metric}>
            <div style={{ ...styles.metricValue, color: '#f97316' }}>{memory.toFixed(1)}</div>
            <div style={styles.metricLabel}>Heap (MB)</div>
          </div>
        )}
      </div>

      <div style={{ maxHeight: 300, overflow: 'auto', padding: 4 }}>
        {items.map((id) => (
          <DynamicItem key={id} id={id} onRemove={removeItem} />
        ))}
      </div>
    </div>
  )
}

// ─── D. Component vs Hook Comparison ─────────────────────────────────────────

function HookDraggable() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useDraggable(
    {
      onDragMove: (e: any) => setPos({ x: e.totalX ?? 0, y: e.totalY ?? 0 }),
    },
    [],
  )

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        width: 160,
        height: 100,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 600,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'grab',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>useDraggable</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
        {pos.x.toFixed(0)}, {pos.y.toFixed(0)}
      </div>
    </div>
  )
}

function ComponentDraggable() {
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <DraggableComponent
      onDragMove={(e: any) => setPos({ x: e.totalX ?? 0, y: e.totalY ?? 0 })}
      style={{
        width: 160,
        height: 100,
        background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 600,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'grab',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>DraggableComponent</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
        {pos.x.toFixed(0)}, {pos.y.toFixed(0)}
      </div>
    </DraggableComponent>
  )
}

function ComponentVsHook() {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        Component vs Hook
        <span style={styles.badge}>Comparison</span>
      </h2>
      <p style={{ color: '#8888a0', fontSize: 13, marginTop: 0 }}>
        Both approaches should behave identically. Drag each to compare.
      </p>
      <div style={styles.splitView}>
        <div>
          <h3 style={{ fontSize: 14, color: '#6366f1', marginBottom: 12 }}>Hook API</h3>
          <div style={{ ...styles.exampleArea, minHeight: 200 }}>
            <HookDraggable />
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 14, color: '#ec4899', marginBottom: 12 }}>Component API</h3>
          <div style={{ ...styles.exampleArea, minHeight: 200 }}>
            <ComponentDraggable />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── E. Interactive Examples ─────────────────────────────────────────────────

// Sortable List
function SortableItem({ label, color }: { label: string; color: string }) {
  const ref = useDraggable({ axis: 'y' }, [])

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        padding: '12px 16px',
        background: color,
        borderRadius: 8,
        marginBottom: 4,
        color: 'white',
        fontWeight: 500,
        fontSize: 14,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'grab',
      }}
    >
      {label}
    </div>
  )
}

function SortableList() {
  const items = useMemo(
    () => [
      { label: 'First item', color: '#6366f1' },
      { label: 'Second item', color: '#8b5cf6' },
      { label: 'Third item', color: '#a855f7' },
      { label: 'Fourth item', color: '#c084fc' },
      { label: 'Fifth item', color: '#d946ef' },
    ],
    [],
  )

  return (
    <div>
      <h3 style={{ fontSize: 14, color: '#a855f7', marginTop: 0, marginBottom: 12 }}>Sortable List (Y-axis only)</h3>
      <div style={styles.exampleArea}>
        {items.map((item, i) => (
          <SortableItem key={i} label={item.label} color={item.color} />
        ))}
      </div>
    </div>
  )
}

// Draggable Cards
function DraggableCard({ title, index }: { title: string; index: number }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const ref = useDraggable(
    {
      onDragStart: () => setDragging(true),
      onDragMove: (e: any) => setPos({ x: e.totalX ?? 0, y: e.totalY ?? 0 }),
      onDragEnd: () => setDragging(false),
    },
    [],
  )

  const hue = index * 60

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        width: 140,
        padding: 16,
        background: dragging ? `hsl(${hue}, 70%, 40%)` : `hsl(${hue}, 50%, 30%)`,
        borderRadius: 12,
        color: 'white',
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'grab',
        position: 'absolute',
        left: 20 + index * 160,
        top: 20,
        boxShadow: dragging ? '0 12px 32px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
        transition: dragging ? 'none' : 'box-shadow 0.2s',
        zIndex: dragging ? 10 : 1,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}>
        x: {pos.x.toFixed(0)}
        <br />
        y: {pos.y.toFixed(0)}
      </div>
    </div>
  )
}

function DraggableCards() {
  const cards = useMemo(() => ['Alpha', 'Beta', 'Gamma', 'Delta'], [])

  return (
    <div>
      <h3 style={{ fontSize: 14, color: '#22c55e', marginTop: 0, marginBottom: 12 }}>
        Draggable Cards (live position)
      </h3>
      <div style={{ ...styles.exampleArea, minHeight: 200 }}>
        {cards.map((title, i) => (
          <DraggableCard key={title} title={title} index={i} />
        ))}
      </div>
    </div>
  )
}

// Resizable Panels
function ResizablePanel({ title, color }: { title: string; color: string }) {
  const [size, setSize] = useState({ w: 200, h: 150 })
  const ref = useResizable(
    {
      edges: { top: true, right: true, bottom: true, left: true },
      minWidth: 100,
      minHeight: 80,
      onResizeMove: (e: any) => setSize({ w: e.width ?? 200, h: e.height ?? 150 }),
    },
    [],
  )

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      style={{
        width: 200,
        height: 150,
        background: color,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 600,
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 13 }}>{title}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7, marginTop: 4 }}>
        {size.w.toFixed(0)} x {size.h.toFixed(0)}
      </div>
      <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>Drag edges to resize</div>
    </div>
  )
}

function ResizablePanels() {
  return (
    <div>
      <h3 style={{ fontSize: 14, color: '#f97316', marginTop: 0, marginBottom: 12 }}>Resizable Panels</h3>
      <div style={{ ...styles.exampleArea, display: 'flex', gap: 24, flexWrap: 'wrap', minHeight: 200 }}>
        <ResizablePanel title="Panel A" color="#1e40af" />
        <ResizablePanel title="Panel B" color="#7e22ce" />
      </div>
    </div>
  )
}

// Combined Drag + Resize
function DragResizeWidget() {
  const [info, setInfo] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const ref = useInteractable(
    {
      drag: {
        onDragMove: (e: any) => setInfo((prev) => ({ ...prev, x: e.totalX ?? 0, y: e.totalY ?? 0 })),
      },
      resize: {
        edges: { top: true, right: true, bottom: true, left: true },
        minWidth: 120,
        minHeight: 80,
        onResizeMove: (e: any) => setInfo((prev) => ({ ...prev, w: e.width ?? 0, h: e.height ?? 0 })),
      },
    },
    [],
  )

  return (
    <div>
      <h3 style={{ fontSize: 14, color: '#ec4899', marginTop: 0, marginBottom: 12 }}>Combined Drag + Resize</h3>
      <div style={{ ...styles.exampleArea, minHeight: 250 }}>
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          style={{
            width: 200,
            height: 140,
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 600,
            userSelect: 'none',
            touchAction: 'none',
            position: 'relative',
          }}
        >
          <div style={{ fontSize: 13 }}>Drag + Resize</div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7, marginTop: 6 }}>
            pos: {info.x.toFixed(0)}, {info.y.toFixed(0)}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7 }}>
            size: {info.w.toFixed(0)} x {info.h.toFixed(0)}
          </div>
          <div style={{ fontSize: 9, opacity: 0.4, marginTop: 4 }}>Center to drag, edges to resize</div>
        </div>
      </div>
    </div>
  )
}

function InteractiveExamples() {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        Interactive Examples
        <span style={styles.badge}>Demo</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <SortableList />
        <DraggableCards />
        <ResizablePanels />
        <DragResizeWidget />
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const fps = useFPS()
  const memory = useMemoryUsage()

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>Grip React Performance</h1>
        <p style={styles.subtitle}>Testing hooks, components, and interaction performance in React</p>
      </header>

      <div style={styles.metricsBar}>
        <div style={styles.metric}>
          <div style={{ ...styles.metricValue, color: fps > 50 ? '#22c55e' : fps > 30 ? '#eab308' : '#ef4444' }}>
            {fps}
          </div>
          <div style={styles.metricLabel}>Global FPS</div>
        </div>
        {memory > 0 && (
          <div style={styles.metric}>
            <div style={{ ...styles.metricValue, color: '#38bdf8' }}>{memory.toFixed(1)}</div>
            <div style={styles.metricLabel}>Heap (MB)</div>
          </div>
        )}
      </div>

      <HookPerformanceTest />
      <ReRenderStressTest />
      <DynamicListTest />
      <ComponentVsHook />
      <InteractiveExamples />

      <footer style={{ textAlign: 'center', padding: '32px 0', color: '#4a4a6a', fontSize: 12 }}>
        Grip React Performance Testing Page
      </footer>
    </div>
  )
}

// ─── Mount ───────────────────────────────────────────────────────────────────

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
