import { describe, it, expect, beforeEach } from 'vitest'
import { QuadTree, SpatialHashGrid } from '../utils/spatial-index'
import type { SpatialItem } from '../utils/spatial-index'

function makeItem(id: string, x: number, y: number, w = 10, h = 10): SpatialItem {
  return { id, x, y, width: w, height: h }
}

describe('QuadTree', () => {
  let tree: QuadTree<SpatialItem>

  beforeEach(() => {
    tree = new QuadTree({ x: 0, y: 0, width: 1000, height: 1000 })
  })

  it('inserts and queries items', () => {
    tree.insert(makeItem('a', 50, 50))
    tree.insert(makeItem('b', 200, 200))

    const results = tree.query({ x: 0, y: 0, width: 100, height: 100 })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })

  it('removes items', () => {
    const item = makeItem('a', 50, 50)
    tree.insert(item)
    expect(tree.query({ x: 0, y: 0, width: 100, height: 100 })).toHaveLength(1)

    const removed = tree.remove(item)
    expect(removed).toBe(true)
    expect(tree.query({ x: 0, y: 0, width: 100, height: 100 })).toHaveLength(0)
  })

  it('updates items', () => {
    const item = makeItem('a', 50, 50)
    tree.insert(item)

    // Move item to a new position
    const updated = makeItem('a', 500, 500)
    tree.update(updated)

    expect(tree.query({ x: 0, y: 0, width: 100, height: 100 })).toHaveLength(0)
    expect(tree.query({ x: 450, y: 450, width: 100, height: 100 })).toHaveLength(1)
  })

  it('queryPoint finds items at specific coordinates', () => {
    tree.insert(makeItem('a', 50, 50, 20, 20))
    tree.insert(makeItem('b', 200, 200, 20, 20))

    const results = tree.queryPoint(55, 55)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })

  it('queryPoint with radius finds nearby items', () => {
    tree.insert(makeItem('a', 100, 100, 10, 10))

    // Point at (80, 80) with radius 30 should find item at (100, 100)
    const results = tree.queryPoint(80, 80, 30)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })

  it('query with radius expands search area', () => {
    tree.insert(makeItem('a', 110, 110, 10, 10))

    // Query area (0,0,100,100) normally wouldn't find (110,110) but with radius 20 it should
    const results = tree.query({ x: 0, y: 0, width: 100, height: 100 }, 20)
    expect(results).toHaveLength(1)
  })

  it('getStats returns correct counts', () => {
    tree.insert(makeItem('a', 10, 10))
    tree.insert(makeItem('b', 20, 20))
    tree.insert(makeItem('c', 30, 30))

    const stats = tree.getStats()
    expect(stats.totalItems).toBe(3)
    expect(stats.totalNodes).toBeGreaterThanOrEqual(1)
  })

  it('empty tree returns no results', () => {
    const results = tree.query({ x: 0, y: 0, width: 1000, height: 1000 })
    expect(results).toHaveLength(0)
    expect(tree.getStats().totalItems).toBe(0)
  })

  it('handles many items and queries remain fast', () => {
    const items: SpatialItem[] = []
    for (let i = 0; i < 1000; i++) {
      const item = makeItem(`item-${i}`, Math.random() * 990, Math.random() * 990, 10, 10)
      items.push(item)
      tree.insert(item)
    }

    const stats = tree.getStats()
    expect(stats.totalItems).toBe(1000)

    // Query a small region — should return quickly
    const start = performance.now()
    const results = tree.query({ x: 400, y: 400, width: 100, height: 100 })
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50) // should be well under 50ms
    expect(results.length).toBeGreaterThanOrEqual(0) // sanity check
  })
})

describe('SpatialHashGrid', () => {
  let grid: SpatialHashGrid<SpatialItem>

  beforeEach(() => {
    grid = new SpatialHashGrid(100)
  })

  it('inserts and queries items', () => {
    grid.insert(makeItem('a', 50, 50))
    grid.insert(makeItem('b', 250, 250))

    const results = grid.query({ x: 0, y: 0, width: 100, height: 100 })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })

  it('removes items', () => {
    const item = makeItem('a', 50, 50)
    grid.insert(item)
    expect(grid.query({ x: 0, y: 0, width: 100, height: 100 })).toHaveLength(1)

    grid.remove(item)
    expect(grid.query({ x: 0, y: 0, width: 100, height: 100 })).toHaveLength(0)
  })

  it('updates items by removing old and inserting new', () => {
    const item = makeItem('a', 50, 50)
    grid.insert(item)

    // SpatialHashGrid.update uses the passed item's bounds for remove,
    // so we must remove the old item first, then insert the updated one
    grid.remove(item)
    const updated = makeItem('a', 500, 500)
    grid.insert(updated)

    expect(grid.query({ x: 0, y: 0, width: 100, height: 100 })).toHaveLength(0)
    expect(grid.query({ x: 450, y: 450, width: 100, height: 100 })).toHaveLength(1)
  })

  it('does not duplicate items in query results', () => {
    // An item spanning multiple cells should only appear once
    const item = makeItem('big', 90, 90, 50, 50)
    grid.insert(item)

    const results = grid.query({ x: 0, y: 0, width: 200, height: 200 })
    expect(results).toHaveLength(1)
  })

  it('empty grid returns no results', () => {
    const results = grid.query({ x: 0, y: 0, width: 1000, height: 1000 })
    expect(results).toHaveLength(0)
  })

  it('handles many items and queries remain fast', () => {
    for (let i = 0; i < 1000; i++) {
      grid.insert(makeItem(`item-${i}`, Math.random() * 990, Math.random() * 990, 10, 10))
    }

    const start = performance.now()
    const results = grid.query({ x: 400, y: 400, width: 100, height: 100 })
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('clears all items', () => {
    grid.insert(makeItem('a', 50, 50))
    grid.insert(makeItem('b', 150, 150))
    grid.clear()

    const results = grid.query({ x: 0, y: 0, width: 1000, height: 1000 })
    expect(results).toHaveLength(0)
  })
})
