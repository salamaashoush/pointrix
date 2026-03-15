// Sortable list — drag items to reorder with smooth animations
// Supports cross-container drag via the `group` option

import { Draggable, DragEvent, DragOptions } from './drag'

export interface SortableOptions {
  /** CSS selector for draggable items within the container (default: direct children) */
  items?: string
  /** Axis of sorting: 'y' for vertical lists, 'x' for horizontal (default: 'y') */
  axis?: 'x' | 'y'
  /** CSS selector for drag handle within each item (optional) */
  handle?: string
  /** Animation duration in ms for items shifting out of the way (default: 200) */
  animationDuration?: number
  /** CSS class added to the item being dragged */
  dragClass?: string
  /** CSS class added to a container when a grouped item hovers over it */
  hoverClass?: string
  /**
   * Group name — sortables with the same group can exchange items.
   * Items can be dragged between any sortables sharing the same group name.
   */
  group?: string
  /** Called when order changes during drag (within same container) */
  onSort?: (event: SortEvent) => void
  /** Called when drag ends and order is finalized */
  onSortEnd?: (event: SortEvent) => void
  /** Called when an item is added from another sortable */
  onAdd?: (event: SortTransferEvent) => void
  /** Called when an item is removed to another sortable */
  onRemove?: (event: SortTransferEvent) => void
}

export interface SortEvent {
  item: HTMLElement
  oldIndex: number
  newIndex: number
  items: HTMLElement[]
}

export interface SortTransferEvent {
  item: HTMLElement
  from: Sortable
  to: Sortable
  oldIndex: number
  newIndex: number
}

interface ItemState {
  el: HTMLElement
  rect: DOMRect
  originalIndex: number
}

// Static group registry
const groupRegistry = new Map<string, Set<Sortable>>()

function registerGroup(group: string, instance: Sortable) {
  if (!groupRegistry.has(group)) groupRegistry.set(group, new Set())
  groupRegistry.get(group)!.add(instance)
}

function unregisterGroup(group: string, instance: Sortable) {
  const set = groupRegistry.get(group)
  if (set) {
    set.delete(instance)
    if (set.size === 0) groupRegistry.delete(group)
  }
}

function getGroupMembers(group: string): Sortable[] {
  const set = groupRegistry.get(group)
  return set ? Array.from(set) : []
}

export class Sortable {
  readonly container: HTMLElement
  private options: Required<Omit<SortableOptions, 'group'>> & { group: string }
  private draggables: Draggable[] = []
  private itemStates: ItemState[] = []
  private dragItem: HTMLElement | null = null
  private dragIndex = -1
  private currentIndex = -1
  // Cross-container state
  private targetSortable: Sortable | null = null
  private targetIndex = -1
  private placeholder: HTMLElement | null = null
  private _enabled = true
  private listeners = new Map<string, Set<Function>>()

  on(event: string, handler: Function): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  }

  off(event: string, handler: Function): this {
    this.listeners.get(event)?.delete(handler)
    return this
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) handler(data)
    }
  }

  get enabled(): boolean { return this._enabled }
  set enabled(value: boolean) { this._enabled = value }

  constructor(container: HTMLElement, options: SortableOptions = {}) {
    this.container = container
    this.options = {
      items: options.items ?? '',
      axis: options.axis ?? 'y',
      handle: options.handle ?? '',
      animationDuration: options.animationDuration ?? 200,
      dragClass: options.dragClass ?? 'sortable-dragging',
      hoverClass: options.hoverClass ?? 'sortable-hover',
      group: options.group ?? '',
      onSort: options.onSort ?? (() => {}),
      onSortEnd: options.onSortEnd ?? (() => {}),
      onAdd: options.onAdd ?? (() => {}),
      onRemove: options.onRemove ?? (() => {}),
    }

    if (this.options.group) {
      registerGroup(this.options.group, this)
    }

    this.setup()
  }

  getItems(): HTMLElement[] {
    if (this.options.items) {
      return Array.from(this.container.querySelectorAll<HTMLElement>(
        this.options.items + ':not(.sortable-placeholder)'
      ))
    }
    return Array.from(this.container.children).filter(
      el => !el.classList.contains('sortable-placeholder')
    ) as HTMLElement[]
  }

  private setup() {
    this.teardown()

    const items = this.getItems()
    for (const item of items) {
      // No axis constraint when group is set — items need to move freely
      // between containers. For single-container, axis is applied.
      const dragOpts: DragOptions = {
        axis: this.options.group ? undefined : this.options.axis,
        handle: this.options.handle || undefined,
        onDragStart: (e) => this.handleDragStart(item, e),
        onDragMove: (e) => this.handleDragMove(item, e),
        onDragEnd: (e) => this.handleDragEnd(item, e),
      }
      this.draggables.push(new Draggable(item, dragOpts))
    }
  }

  private handleDragStart(item: HTMLElement, _e: DragEvent) {
    if (!this._enabled) return
    this.dragItem = item
    const items = this.getItems()
    this.dragIndex = items.indexOf(item)
    this.currentIndex = this.dragIndex
    this.targetSortable = null
    this.targetIndex = -1

    this.snapshotItems()

    item.classList.add(this.options.dragClass)
    item.style.zIndex = '9999'
    item.style.position = 'relative'
  }

  private handleDragMove(item: HTMLElement, e: DragEvent) {
    if (!this.dragItem) return

    // Get drag center from live rect
    const dragRect = item.getBoundingClientRect()
    const cx = dragRect.left + dragRect.width / 2
    const cy = dragRect.top + dragRect.height / 2

    // Check cross-container targets
    if (this.options.group) {
      const target = this.findTargetContainer(cx, cy)

      if (target && target !== this) {
        // Hovering over a sibling container
        this.setTargetSortable(target, cx, cy)
        // Still update within-container displacement
        this.updateWithinIndex(item, e)
        return
      } else if (this.targetSortable) {
        // Left the sibling — remove placeholder
        this.clearTargetSortable()
      }
    }

    // Normal within-container sorting
    this.updateWithinIndex(item, e)
  }

  private updateWithinIndex(item: HTMLElement, e: DragEvent) {
    const isVertical = this.options.axis === 'y'

    // Compute center from original rect + delta (works in jsdom)
    const origState = this.itemStates[this.dragIndex]
    if (!origState) return
    const dragDelta = isVertical ? e.totalY : e.totalX
    const dragCenter = isVertical
      ? origState.rect.top + origState.rect.height / 2 + dragDelta
      : origState.rect.left + origState.rect.width / 2 + dragDelta

    let newIndex = 0
    for (let i = 0; i < this.itemStates.length; i++) {
      if (i === this.dragIndex) continue
      const state = this.itemStates[i]
      const mid = isVertical
        ? state.rect.top + state.rect.height / 2
        : state.rect.left + state.rect.width / 2
      if (dragCenter > mid) {
        newIndex++
      }
    }

    newIndex = Math.max(0, Math.min(newIndex, this.itemStates.length - 1))

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex
      this.animateItems(item)
      const sortEvent = {
        item,
        oldIndex: this.dragIndex,
        newIndex,
        items: this.getItems(),
      }
      this.options.onSort(sortEvent)
      this.emit('sort', sortEvent)
    }
  }

  private findTargetContainer(cx: number, cy: number): Sortable | null {
    for (const member of getGroupMembers(this.options.group)) {
      if (member === this) continue
      const rect = member.container.getBoundingClientRect()
      if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
        return member
      }
    }
    return null
  }

  private setTargetSortable(target: Sortable, cx: number, cy: number) {
    const changed = this.targetSortable !== target
    this.targetSortable = target

    // Add hover class to target container
    if (changed) {
      // Remove from old target
      for (const member of getGroupMembers(this.options.group)) {
        if (member !== this) member.container.classList.remove(this.options.hoverClass)
      }
      target.container.classList.add(this.options.hoverClass)
    }

    // Compute insertion index in target
    const isVertical = this.options.axis === 'y'
    const targetItems = target.getItems()
    let insertIndex = targetItems.length

    for (let i = 0; i < targetItems.length; i++) {
      const rect = targetItems[i].getBoundingClientRect()
      const mid = isVertical
        ? rect.top + rect.height / 2
        : rect.left + rect.width / 2
      const center = isVertical ? cy : cx
      if (center < mid) {
        insertIndex = i
        break
      }
    }

    if (insertIndex !== this.targetIndex || changed) {
      this.targetIndex = insertIndex
      this.updatePlaceholder(target, insertIndex)
    }
  }

  private clearTargetSortable() {
    if (this.targetSortable) {
      this.targetSortable.container.classList.remove(this.options.hoverClass)
    }
    this.targetSortable = null
    this.targetIndex = -1
    this.removePlaceholder()
  }

  private updatePlaceholder(target: Sortable, index: number) {
    this.removePlaceholder()

    if (!this.dragItem) return

    // Create a placeholder showing where the item will land
    const ph = document.createElement('div')
    ph.className = 'sortable-placeholder'
    const dragRect = this.dragItem.getBoundingClientRect()
    ph.style.height = `${dragRect.height}px`
    ph.style.width = `${dragRect.width}px`
    ph.style.border = '2px dashed currentColor'
    ph.style.borderRadius = '6px'
    ph.style.opacity = '0.3'
    ph.style.transition = 'all 150ms ease'
    ph.style.boxSizing = 'border-box'

    const targetItems = target.getItems()
    if (index >= targetItems.length) {
      target.container.appendChild(ph)
    } else {
      targetItems[index].before(ph)
    }

    this.placeholder = ph
  }

  private removePlaceholder() {
    if (this.placeholder) {
      this.placeholder.remove()
      this.placeholder = null
    }
  }

  private handleDragEnd(item: HTMLElement, _e: DragEvent) {
    if (!this.dragItem) return

    const oldIndex = this.dragIndex
    const isCrossContainer = this.targetSortable !== null

    item.classList.remove(this.options.dragClass)
    item.style.zIndex = ''

    if (isCrossContainer && this.targetSortable) {
      // Cross-container drop
      const target = this.targetSortable
      const insertIndex = this.targetIndex

      this.removePlaceholder()
      target.container.classList.remove(this.options.hoverClass)

      // Reset transform and move to target container
      item.style.transform = ''
      item.style.transition = ''

      const targetItems = target.getItems()
      if (insertIndex >= targetItems.length) {
        target.container.appendChild(item)
      } else {
        targetItems[insertIndex].before(item)
      }

      const newIndex = target.getItems().indexOf(item)

      // Fire events
      const removeEvent = {
        item,
        from: this,
        to: target,
        oldIndex,
        newIndex,
      }
      this.options.onRemove(removeEvent)
      this.emit('remove', removeEvent)

      const addEvent = {
        item,
        from: this,
        to: target,
        oldIndex,
        newIndex,
      }
      target.options.onAdd(addEvent)
      target.emit('add', addEvent)

      const sortEndEvent = {
        item,
        oldIndex: -1,
        newIndex,
        items: target.getItems(),
      }
      target.options.onSortEnd(sortEndEvent)
      target.emit('sortend', sortEndEvent)
    } else {
      // Within-container reorder
      const newIndex = this.currentIndex

      if (oldIndex !== newIndex) {
        const items = this.getItems()
        this.reorderDOM(items, oldIndex, newIndex)
      }

      const sortEndEvent = {
        item,
        oldIndex,
        newIndex,
        items: this.getItems(),
      }
      this.options.onSortEnd(sortEndEvent)
      this.emit('sortend', sortEndEvent)
    }

    // Reset all transforms in this container
    for (const el of this.getItems()) {
      el.style.transform = ''
      el.style.transition = ''
    }

    // Clean up state
    this.dragItem = null
    this.dragIndex = -1
    this.currentIndex = -1
    this.targetSortable = null
    this.targetIndex = -1

    // Re-setup all affected sortables in the group
    this.setup()
    if (this.options.group) {
      for (const member of getGroupMembers(this.options.group)) {
        if (member !== this) member.setup()
      }
    }
  }

  snapshotItems() {
    const items = this.getItems()
    this.itemStates = items.map((el, i) => ({
      el,
      rect: el.getBoundingClientRect(),
      originalIndex: i,
    }))
  }

  private animateItems(dragEl: HTMLElement) {
    const isVertical = this.options.axis === 'y'
    const duration = this.options.animationDuration
    const from = this.dragIndex
    const to = this.currentIndex

    for (let i = 0; i < this.itemStates.length; i++) {
      if (this.itemStates[i].el === dragEl) continue

      const el = this.itemStates[i].el
      let offset = 0

      if (from < to && i > from && i <= to) {
        const target = this.itemStates[i - 1].rect
        const current = this.itemStates[i].rect
        offset = isVertical
          ? target.top - current.top
          : target.left - current.left
      } else if (from > to && i >= to && i < from) {
        const target = this.itemStates[i + 1].rect
        const current = this.itemStates[i].rect
        offset = isVertical
          ? target.top - current.top
          : target.left - current.left
      }

      el.style.transition = `transform ${duration}ms ease`
      el.style.transform = isVertical
        ? `translateY(${offset}px)`
        : `translateX(${offset}px)`
    }
  }

  private reorderDOM(items: HTMLElement[], fromIndex: number, toIndex: number) {
    const item = items[fromIndex]
    if (fromIndex < toIndex) {
      items[toIndex].after(item)
    } else {
      items[toIndex].before(item)
    }
  }

  /** Refresh the sortable (e.g., after dynamically adding/removing items) */
  refresh() {
    this.setup()
  }

  /** Get the current order of items */
  getOrder(): HTMLElement[] {
    return this.getItems()
  }

  /** Programmatically move an item */
  move(fromIndex: number, toIndex: number) {
    const items = this.getItems()
    if (fromIndex < 0 || fromIndex >= items.length) return
    if (toIndex < 0 || toIndex >= items.length) return
    if (fromIndex === toIndex) return

    this.reorderDOM(items, fromIndex, toIndex)

    const sortEndEvent = {
      item: items[fromIndex],
      oldIndex: fromIndex,
      newIndex: toIndex,
      items: this.getItems(),
    }
    this.options.onSortEnd(sortEndEvent)
    this.emit('sortend', sortEndEvent)

    this.setup()
  }

  private teardown() {
    for (const d of this.draggables) {
      d.destroy()
    }
    this.draggables = []
  }

  destroy() {
    this.teardown()
    this.removePlaceholder()
    const items = this.getItems()
    for (const el of items) {
      el.style.transform = ''
      el.style.transition = ''
    }
    if (this.options.group) {
      unregisterGroup(this.options.group, this)
    }
  }
}

export function sortable(container: HTMLElement | string, options?: SortableOptions): Sortable {
  const el = typeof container === 'string'
    ? document.querySelector<HTMLElement>(container)
    : container

  if (!el) throw new Error(`Container not found: ${container}`)

  return new Sortable(el, options)
}

export default sortable
