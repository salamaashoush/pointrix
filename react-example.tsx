// Example usage of hyperact React components
import React, { useState } from 'react'
import { 
  useDraggable, 
  useResizable, 
  useInteractable,
  DraggableComponent,
  ResizableComponent,
  InteractableComponent 
} from './src/react'

// Hook example - maximum control
function HookExample() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  
  const dragRef = useDraggable({
    onDragMove: (e) => {
      setPosition({ x: e.totalX, y: e.totalY })
    },
    momentum: true,
    grid: { x: 10, y: 10 }
  })
  
  return (
    <div 
      ref={dragRef}
      style={{
        width: 100,
        height: 100,
        background: '#3498db',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        cursor: 'grab',
        position: 'absolute',
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
    >
      Drag me!
    </div>
  )
}

// Component example - simple and declarative
function ComponentExample() {
  return (
    <div style={{ height: 400, position: 'relative', background: '#f0f0f0' }}>
      {/* Simple draggable */}
      <DraggableComponent
        momentum
        bounds="parent"
        style={{
          width: 100,
          height: 100,
          background: '#e74c3c',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          position: 'absolute',
          top: 20,
          left: 20
        }}
      >
        Drag me!
      </DraggableComponent>
      
      {/* Simple resizable */}
      <ResizableComponent
        minWidth={100}
        minHeight={100}
        aspectRatio={16/9}
        style={{
          width: 200,
          height: 112,
          background: '#9b59b6',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          position: 'absolute',
          top: 20,
          right: 20
        }}
      >
        Resize me!
      </ResizableComponent>
      
      {/* Both drag and resize */}
      <InteractableComponent
        drag={{ momentum: true }}
        resize={{ edges: { right: true, bottom: true } }}
        style={{
          width: 150,
          height: 150,
          background: '#1abc9c',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        Drag & Resize!
      </InteractableComponent>
    </div>
  )
}

// Performance test - 1000 draggable elements
function PerformanceTest() {
  const [count, setCount] = useState(100)
  const [elements, setElements] = useState<number[]>(() => 
    Array.from({ length: count }, (_, i) => i)
  )
  
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => {
          const newCount = 100
          setCount(newCount)
          setElements(Array.from({ length: newCount }, (_, i) => i))
        }}>
          100 Elements
        </button>
        <button onClick={() => {
          const newCount = 1000
          setCount(newCount)
          setElements(Array.from({ length: newCount }, (_, i) => i))
        }}>
          1000 Elements
        </button>
        <span style={{ marginLeft: 20 }}>Count: {count}</span>
      </div>
      
      <div style={{ 
        height: 600, 
        position: 'relative', 
        background: '#f0f0f0',
        overflow: 'auto'
      }}>
        {elements.map(i => (
          <DraggableComponent
            key={i}
            momentum
            style={{
              width: 40,
              height: 40,
              background: `hsl(${(i * 360) / count}, 70%, 50%)`,
              borderRadius: 4,
              position: 'absolute',
              top: Math.random() * 500,
              left: Math.random() * 90 + '%'
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Main app
export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h1>Hyperact React Examples</h1>
      
      <h2>Hook Example</h2>
      <div style={{ height: 200, position: 'relative', background: '#f9f9f9' }}>
        <HookExample />
      </div>
      
      <h2>Component Example</h2>
      <ComponentExample />
      
      <h2>Performance Test</h2>
      <PerformanceTest />
    </div>
  )
}