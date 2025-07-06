# Hyperact

The smallest and fastest library for draggable and resizable elements. A complete rewrite focused on minimal size and maximum performance.

## Features

- 🚀 **Ultra-small**: Core is just ~3KB minified
- ⚡ **Blazing fast**: Optimized for 60fps interactions
- 📦 **Modular**: Import only what you need
- 🎯 **Simple API**: Intuitive and easy to use
- 📱 **Touch-first**: Built on pointer events
- 🔧 **Zero dependencies**: No external deps
- 🌳 **Tree-shakeable**: Modern ES modules

## Installation

```bash
npm install hyperact
```

## Quick Start

### Minimal Core (~3KB)
Just pointer tracking - build your own interactions:

```javascript
import { hyperact } from 'hyperact/nano'

hyperact('#element', {
  onStart: (e) => console.log('Started!'),
  onMove: (e) => {
    const pointer = e.pointers[0]
    e.target.style.transform = `translate(${pointer.total.x}px, ${pointer.total.y}px)`
  },
  onEnd: (e) => console.log('Done!')
})
```

### Drag Module (~5KB)
Full-featured dragging with momentum:

```javascript
import { draggable } from 'hyperact/drag'

draggable('#element', {
  axis: 'x',                    // Constrain to x-axis
  bounds: 'parent',             // Keep within parent
  grid: { x: 20, y: 20 },      // Snap to grid
  momentum: true,               // Physics-based momentum
  onDragMove: (e) => {
    console.log(e.totalX, e.totalY)
  }
})
```

### Resize Module (~6KB)
Resize from any edge or corner:

```javascript
import { resizable } from 'hyperact/resize'

resizable('#element', {
  edges: { top: true, right: true, bottom: true, left: true },
  minWidth: 100,
  minHeight: 100,
  aspectRatio: 16/9,
  onResizeMove: (e) => {
    console.log(e.width, e.height)
  }
})
```

### Full Bundle (~8KB)
Everything in one:

```javascript
import { interactable } from 'hyperact'

interactable('#element', {
  drag: {
    momentum: true
  },
  resize: {
    edges: { right: true, bottom: true }
  }
})
```

## API

### Core (hyperact/nano)

```typescript
hyperact(element, {
  onStart?: (event: InteractionEvent) => void
  onMove?: (event: InteractionEvent) => void
  onEnd?: (event: InteractionEvent) => void
  threshold?: number        // Movement threshold (default: 3)
  preventScroll?: boolean   // Prevent scrolling (default: true)
})
```

### Drag (hyperact/drag)

```typescript
draggable(element, {
  // Constraints
  axis?: 'x' | 'y' | 'xy'
  bounds?: 'parent' | Element | { left?: number, top?: number, right?: number, bottom?: number }
  grid?: { x: number, y: number }
  
  // Physics
  momentum?: boolean | { friction?: number, minSpeed?: number }
  
  // Events
  onDragStart?: (event: DragEvent) => void
  onDragMove?: (event: DragEvent) => void
  onDragEnd?: (event: DragEvent) => void
})
```

### Resize (hyperact/resize)

```typescript
resizable(element, {
  // Edges
  edges?: { top?: boolean, right?: boolean, bottom?: boolean, left?: boolean }
  handleSize?: number       // Resize handle area (default: 10)
  
  // Constraints
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: number | 'preserve'
  grid?: { width: number, height: number }
  
  // Events
  onResizeStart?: (event: ResizeEvent) => void
  onResizeMove?: (event: ResizeEvent) => void
  onResizeEnd?: (event: ResizeEvent) => void
})
```

## Performance

Hyperact is designed for maximum performance:

- Single shared RAF loop for all instances
- Passive event listeners where possible
- GPU-accelerated transforms (translate3d)
- Minimal DOM operations
- Efficient pointer tracking
- Smart update batching

## Bundle Sizes

| Module | Size (min) | Size (gzip) | Features |
|--------|------------|-------------|----------|
| `hyperact/nano` | ~3KB | ~1.2KB | Core pointer tracking |
| `hyperact/drag` | ~5KB | ~2KB | Drag with momentum |
| `hyperact/resize` | ~6KB | ~2.4KB | Resize with constraints |
| `hyperact` | ~8KB | ~3.2KB | Everything |

## Browser Support

All modern browsers that support:
- Pointer Events
- ES6 Modules
- CSS Transforms

## Why Hyperact?

- **10x smaller** than interact.js (~140KB)
- **Faster startup** - no complex initialization
- **Better performance** - optimized for modern browsers
- **Simpler API** - focused on core functionality
- **Modern codebase** - TypeScript, ES modules

## License

MIT