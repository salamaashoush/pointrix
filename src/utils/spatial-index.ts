export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface SpatialItem extends Bounds {
  id: string
}

interface QuadTreeNode<T extends SpatialItem> {
  bounds: Bounds
  items: T[]
  children: QuadTreeNode<T>[] | null
  depth: number
}

export class QuadTree<T extends SpatialItem> {
  private root: QuadTreeNode<T>
  private maxItems = 4
  private maxDepth = 8

  constructor(bounds: Bounds, options: { maxItems?: number; maxDepth?: number } = {}) {
    this.maxItems = options.maxItems ?? this.maxItems
    this.maxDepth = options.maxDepth ?? this.maxDepth
    this.root = this.createNode(bounds, 0)
  }

  private createNode(bounds: Bounds, depth: number): QuadTreeNode<T> {
    return {
      bounds,
      items: [],
      children: null,
      depth
    }
  }

  insert(item: T): void {
    this.insertIntoNode(this.root, item)
  }

  private insertIntoNode(node: QuadTreeNode<T>, item: T): boolean {
    if (!this.intersects(node.bounds, item)) {
      return false
    }

    if (node.children === null) {
      node.items.push(item)

      if (node.items.length > this.maxItems && node.depth < this.maxDepth) {
        this.subdivide(node)
      }
      return true
    }

    for (const child of node.children) {
      if (this.insertIntoNode(child, item)) {
        return true
      }
    }

    node.items.push(item)
    return true
  }

  private subdivide(node: QuadTreeNode<T>): void {
    const { x, y, width, height } = node.bounds
    const halfWidth = width / 2
    const halfHeight = height / 2

    node.children = [
      this.createNode({ x, y, width: halfWidth, height: halfHeight }, node.depth + 1),
      this.createNode({ x: x + halfWidth, y, width: halfWidth, height: halfHeight }, node.depth + 1),
      this.createNode({ x, y: y + halfHeight, width: halfWidth, height: halfHeight }, node.depth + 1),
      this.createNode({ x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight }, node.depth + 1)
    ]

    const items = node.items
    node.items = []

    for (const item of items) {
      let inserted = false
      for (const child of node.children) {
        if (this.insertIntoNode(child, item)) {
          inserted = true
          break
        }
      }
      if (!inserted) {
        node.items.push(item)
      }
    }
  }

  query(bounds: Bounds, radius = 0): T[] {
    const results: T[] = []
    const expandedBounds = {
      x: bounds.x - radius,
      y: bounds.y - radius,
      width: bounds.width + radius * 2,
      height: bounds.height + radius * 2
    }
    this.queryNode(this.root, expandedBounds, results)
    return results
  }

  private queryNode(node: QuadTreeNode<T>, bounds: Bounds, results: T[]): void {
    if (!this.intersects(node.bounds, bounds)) {
      return
    }

    for (const item of node.items) {
      if (this.intersects(item, bounds)) {
        results.push(item)
      }
    }

    if (node.children !== null) {
      for (const child of node.children) {
        this.queryNode(child, bounds, results)
      }
    }
  }

  queryPoint(x: number, y: number, radius = 0): T[] {
    return this.query({
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2
    })
  }

  remove(item: T): boolean {
    return this.removeFromNode(this.root, item)
  }

  private removeFromNode(node: QuadTreeNode<T>, item: T): boolean {
    const index = node.items.findIndex(i => i.id === item.id)
    if (index !== -1) {
      node.items.splice(index, 1)
      return true
    }

    if (node.children !== null) {
      for (const child of node.children) {
        if (this.removeFromNode(child, item)) {
          return true
        }
      }
    }

    return false
  }

  update(item: T): void {
    this.remove(item)
    this.insert(item)
  }

  clear(): void {
    this.root = this.createNode(this.root.bounds, 0)
  }

  private intersects(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }

  getStats(): { totalItems: number; totalNodes: number; maxDepth: number } {
    const stats = {
      totalItems: 0,
      totalNodes: 0,
      maxDepth: 0
    }
    this.collectStats(this.root, stats)
    return stats
  }

  private collectStats(
    node: QuadTreeNode<T>,
    stats: { totalItems: number; totalNodes: number; maxDepth: number }
  ): void {
    stats.totalItems += node.items.length
    stats.totalNodes++
    stats.maxDepth = Math.max(stats.maxDepth, node.depth)

    if (node.children !== null) {
      for (const child of node.children) {
        this.collectStats(child, stats)
      }
    }
  }
}

export class SpatialHashGrid<T extends SpatialItem> {
  private grid: Map<string, T[]> = new Map()
  private cellSize: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private getKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize)
    const cellY = Math.floor(y / this.cellSize)
    return `${cellX},${cellY}`
  }

  private getCellsForBounds(bounds: Bounds): string[] {
    const keys: string[] = []
    const startX = Math.floor(bounds.x / this.cellSize)
    const startY = Math.floor(bounds.y / this.cellSize)
    const endX = Math.floor((bounds.x + bounds.width) / this.cellSize)
    const endY = Math.floor((bounds.y + bounds.height) / this.cellSize)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        keys.push(`${x},${y}`)
      }
    }

    return keys
  }

  insert(item: T): void {
    const keys = this.getCellsForBounds(item)
    for (const key of keys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, [])
      }
      this.grid.get(key)!.push(item)
    }
  }

  query(bounds: Bounds): T[] {
    const results = new Map<string, T>()
    const keys = this.getCellsForBounds(bounds)

    for (const key of keys) {
      const items = this.grid.get(key) || []
      for (const item of items) {
        if (this.intersects(item, bounds) && !results.has(item.id)) {
          results.set(item.id, item)
        }
      }
    }

    return Array.from(results.values())
  }

  remove(item: T): void {
    const keys = this.getCellsForBounds(item)
    for (const key of keys) {
      const items = this.grid.get(key)
      if (items) {
        const index = items.findIndex(i => i.id === item.id)
        if (index !== -1) {
          items.splice(index, 1)
          if (items.length === 0) {
            this.grid.delete(key)
          }
        }
      }
    }
  }

  update(item: T): void {
    this.remove(item)
    this.insert(item)
  }

  clear(): void {
    this.grid.clear()
  }

  private intersects(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }
}