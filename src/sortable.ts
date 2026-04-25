// Sortable list — drag items to reorder with smooth animations
// Supports cross-container drag via the `group` option

import { Draggable, DragEvent, DragOptions } from './drag'
import { prefersReducedMotion } from './types'
import {
  setSortableItemAttrs,
  clearSortableItemAttrs,
  setSortableContainerAttrs,
  clearSortableContainerAttrs,
  setDraggingAttrs,
  announce,
  getMessages,
} from './aria'

export interface SortableOptions {
  /** Enable ARIA attributes for accessibility (default: true) */
  aria?: boolean
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
  /** z-index applied to the item being dragged (default: '9999'). Pass '' to skip. */
  dragZIndex?: string
  /**
   * Custom geometry resolver. When set, every rect measurement inside the
   * sortable — container rect, item positions during drag, placeholder
   * sizing — routes through this function instead of
   * `element.getBoundingClientRect()`.
   *
   * The same resolver is inherited by each item's Draggable, so drag bounds
   * and dropzone hit-testing stay consistent.
   */
  rectChecker?: (element: HTMLElement) => DOMRect
  /**
   * Group name — sortables with the same group can exchange items.
   * Items can be dragged between any sortables sharing the same group name.
   */
  group?: string
  /**
   * Optional mapper from item element to a stable string id.
   *
   * When set, `SortEvent.oldId` / `newId` and `SortTransferEvent.itemId` are
   * populated — useful for React/Vue apps that drive their state by id and
   * don't want to map DOM elements back to their data model.
   *
   * Defaults to reading `data-sortable-id` or the element's `id` attribute.
   */
  id?: (el: HTMLElement) => string
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
  /** id of the item at oldIndex — only present when `id` option is set. */
  oldId?: string
  /** id of the item at newIndex — only present when `id` option is set. */
  newId?: string
  /**
   * Current order expressed as ids — only present when `id` option is set.
   * Useful for calling `setState(newOrder.map(id => itemMap[id]))` in React.
   */
  order?: string[]
}

export interface SortTransferEvent {
  item: HTMLElement
  from: Sortable
  to: Sortable
  oldIndex: number
  newIndex: number
  /** id of the transferred item — only present when `id` option is set. */
  itemId?: string
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

// ─── Cross-container rect cache ─────────────────────────────────────────
// findTargetContainer runs every drag frame in group mode. Without this
// cache, each frame calls getBoundingClientRect on every sibling container
// — a forced-sync-layout per member per frame.
//
// At drag start we snapshot all group members' rects and listen for
// scroll/resize. On any such event we refresh all cached rects at once.
let _activeGroupDragCount = 0
const _groupRectRefreshers: Set<() => void> = new Set()

function _handleGroupInvalidate() {
  for (const fn of _groupRectRefreshers) fn()
}

function _addGroupScrollListener() {
  if (typeof window === 'undefined') return
  if (_activeGroupDragCount === 0) {
    window.addEventListener('scroll', _handleGroupInvalidate, { passive: true, capture: true })
    window.addEventListener('resize', _handleGroupInvalidate, { passive: true })
  }
  _activeGroupDragCount++
}

function _removeGroupScrollListener() {
  if (_activeGroupDragCount > 0) _activeGroupDragCount--
  if (_activeGroupDragCount === 0 && typeof window !== 'undefined') {
    window.removeEventListener('scroll', _handleGroupInvalidate, { capture: true } as AddEventListenerOptions)
    window.removeEventListener('resize', _handleGroupInvalidate)
  }
}

export class Sortable {
  readonly container: HTMLElement
  private options: Required<Omit<SortableOptions, 'group' | 'dragZIndex' | 'id' | 'rectChecker'>> & {
    group: string
    dragZIndex: string
    id: ((el: HTMLElement) => string) | null
    rectChecker: ((el: HTMLElement) => DOMRect) | null
  }
  /** Draggable bound to each item; indexed by the item element for O(1) lookup. */
  private draggableMap: Map<HTMLElement, Draggable> = new Map()
  private itemStates: ItemState[] = []
  private dragItem: HTMLElement | null = null
  private dragIndex = -1
  private currentIndex = -1
  // Cross-container state
  private targetSortable: Sortable | null = null
  private targetIndex = -1
  private placeholder: HTMLElement | null = null
  private _enabled = true
  /** Cached result of getItems() — invalidated when items are added/removed. */
  private _itemsCache: HTMLElement[] | null = null
  /**
   * Cached container rect for cross-container hit testing. Populated at drag
   * start, invalidated on scroll/resize. Saves one getBoundingClientRect per
   * group member per drag frame.
   */
  private _containerRect: DOMRect | null = null
  private _refreshRect = () => {
    this._containerRect = this.options.rectChecker
      ? this.options.rectChecker(this.container)
      : this.container.getBoundingClientRect()
  }

  /** Resolve a rect for any element through this sortable's rectChecker. */
  private getRect(el: HTMLElement): DOMRect {
    return this.options.rectChecker ? this.options.rectChecker(el) : el.getBoundingClientRect()
  }

  get enabled(): boolean {
    return this._enabled
  }
  set enabled(value: boolean) {
    this._enabled = value
  }

  constructor(container: HTMLElement, options: SortableOptions = {}) {
    this.container = container
    this.options = {
      items: options.items ?? '',
      axis: options.axis ?? 'y',
      handle: options.handle ?? '',
      animationDuration: options.animationDuration ?? 200,
      dragClass: options.dragClass ?? 'sortable-dragging',
      hoverClass: options.hoverClass ?? 'sortable-hover',
      dragZIndex: options.dragZIndex ?? '9999',
      group: options.group ?? '',
      id: options.id ?? null,
      rectChecker: options.rectChecker ?? null,
      onSort: options.onSort ?? (() => {}),
      onSortEnd: options.onSortEnd ?? (() => {}),
      onAdd: options.onAdd ?? (() => {}),
      onRemove: options.onRemove ?? (() => {}),
      aria: options.aria ?? true,
    }

    if (this.options.group) {
      registerGroup(this.options.group, this)
    }

    // ARIA container role
    if (this.options.aria) {
      setSortableContainerAttrs(container)
    }

    this.setup()
  }

  getItems(): HTMLElement[] {
    if (this._itemsCache) return this._itemsCache
    const items = this.options.items
      ? Array.from(this.container.querySelectorAll<HTMLElement>(this.options.items + ':not(.sortable-placeholder)'))
      : (Array.from(this.container.children).filter(
          (el) => !el.classList.contains('sortable-placeholder'),
        ) as HTMLElement[])
    this._itemsCache = items
    return items
  }

  /** Invalidate the items cache — call after DOM mutations that add/remove items. */
  private invalidateItemsCache(): void {
    this._itemsCache = null
  }

  /** Return the stable id for an item, if an `id` option was configured. */
  private idOf(el: HTMLElement | undefined | null): string | undefined {
    if (!el || !this.options.id) return undefined
    return this.options.id(el)
  }

  /** Build the `order` array of ids for the current items — only when `id` is set. */
  private orderOf(items: HTMLElement[]): string[] | undefined {
    const idFn = this.options.id
    if (!idFn) return undefined
    const out: string[] = []
    out.length = items.length
    for (let i = 0; i < items.length; i++) out[i] = idFn(items[i])
    return out
  }

  /** Create a Draggable for a single item, bound to this sortable's handlers. */
  private createDraggable(item: HTMLElement): Draggable {
    const dragOpts: DragOptions = {
      aria: false, // Sortable manages its own ARIA
      axis: this.options.group ? undefined : this.options.axis,
      handle: this.options.handle || undefined,
      // Inherit custom geometry so each item's Draggable measures through
      // the same resolver (bounds, dropzone hit tests, etc.).
      rectChecker: this.options.rectChecker ?? undefined,
      onDragStart: (e) => this.handleDragStart(item, e),
      onDragMove: (e) => this.handleDragMove(item, e),
      onDragEnd: (e) => this.handleDragEnd(item, e),
    }
    return new Draggable(item, dragOpts)
  }

  /**
   * Diff-based setup: create Draggables for new items, destroy for removed.
   * Leaves existing bindings untouched. O(added + removed) instead of O(all).
   */
  private setup() {
    this.invalidateItemsCache()
    const items = this.getItems()
    const seen = new Set(items)

    // Destroy bindings for items no longer in the container
    for (const [el, drag] of this.draggableMap) {
      if (!seen.has(el)) {
        drag.destroy()
        this.draggableMap.delete(el)
      }
    }

    // Create bindings for new items
    for (const item of items) {
      if (!this.draggableMap.has(item)) {
        this.draggableMap.set(item, this.createDraggable(item))
      }
    }

    // Refresh ARIA (positions change with reorders)
    if (this.options.aria) {
      for (let i = 0; i < items.length; i++) {
        setSortableItemAttrs(items[i], i, items.length)
      }
    }
  }

  /**
   * Lightweight refresh used after same-container reorder: ARIA + cache only.
   * No draggable bindings touched (elements haven't changed, just their order).
   */
  private refreshAfterReorder(): void {
    this.invalidateItemsCache()
    if (!this.options.aria) return
    const items = this.getItems()
    for (let i = 0; i < items.length; i++) {
      setSortableItemAttrs(items[i], i, items.length)
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
    if (this.options.dragZIndex) item.style.zIndex = this.options.dragZIndex
    item.style.position = 'relative'

    // Cache every group member's container rect once per drag, and start
    // listening for scroll/resize to keep it fresh. Skips non-grouped
    // sortables — they never call findTargetContainer.
    if (this.options.group) {
      for (const member of getGroupMembers(this.options.group)) {
        member._refreshRect()
        _groupRectRefreshers.add(member._refreshRect)
      }
      _addGroupScrollListener()
    }

    // ARIA
    if (this.options.aria) {
      setDraggingAttrs(item, true)
      const label = item.textContent?.trim() || `Item ${this.dragIndex + 1}`
      announce(getMessages().pickedUp(label, this.dragIndex + 1, items.length))
    }
  }

  private handleDragMove(item: HTMLElement, e: DragEvent) {
    if (!this.dragItem) return

    // Compute the current drag center from the snapshot + pointer delta.
    // Sortable's internal Draggable has no bounds, grid, or modifiers, so
    // transform delta === pointer delta — we don't need a live measurement.
    // Saves a forced-layout getBoundingClientRect per drag frame (cross-
    // container drags call findTargetContainer/setTargetSortable every
    // frame, and both need cx/cy).
    let cx: number, cy: number
    const origState = this.itemStates[this.dragIndex]
    if (origState) {
      cx = origState.rect.left + origState.rect.width / 2 + e.totalX
      cy = origState.rect.top + origState.rect.height / 2 + e.totalY
    } else {
      // No snapshot — fall back to a live measurement. Should only happen if
      // the caller skipped snapshotItems (e.g., manual reorder before drag).
      const r = this.getRect(item)
      cx = r.left + r.width / 2
      cy = r.top + r.height / 2
    }

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
      const mid = isVertical ? state.rect.top + state.rect.height / 2 : state.rect.left + state.rect.width / 2
      if (dragCenter > mid) {
        newIndex++
      }
    }

    newIndex = Math.max(0, Math.min(newIndex, this.itemStates.length - 1))

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex
      this.animateItems(item)
      const items = this.getItems()
      this.options.onSort({
        item,
        oldIndex: this.dragIndex,
        newIndex,
        items,
        oldId: this.idOf(items[this.dragIndex]),
        newId: this.idOf(items[newIndex]),
        order: this.orderOf(items),
      })

      // ARIA announcement
      if (this.options.aria) {
        announce(getMessages().movedTo(newIndex + 1, this.itemStates.length))
      }
    }
  }

  private findTargetContainer(cx: number, cy: number): Sortable | null {
    // Use the cached rect populated at drag start. _refreshRect keeps it in
    // sync with scroll/resize via the shared group listener. Each member
    // resolves its own rect (may have its own rectChecker).
    for (const member of getGroupMembers(this.options.group)) {
      if (member === this) continue
      const rect = member._containerRect ?? member.getRect(member.container)
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
      // Use the target's rectChecker so cross-group drops respect the
      // target's geometry world, which may differ from ours.
      const rect = target.getRect(targetItems[i])
      const mid = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2
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
    const dragRect = this.getRect(this.dragItem)
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

    // Tear down the container rect cache set up in handleDragStart.
    if (this.options.group) {
      for (const member of getGroupMembers(this.options.group)) {
        _groupRectRefreshers.delete(member._refreshRect)
        member._containerRect = null
      }
      _removeGroupScrollListener()
    }

    item.classList.remove(this.options.dragClass)
    item.style.zIndex = ''

    // ARIA
    if (this.options.aria) {
      setDraggingAttrs(item, false)
    }

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

      const targetItems2 = target.getItems()
      const newIndex = targetItems2.indexOf(item)

      // Cross-container events: one transfer event on each side, plus a
      // sortend on the target. itemId is always from the source since target
      // may not have an `id` option configured (and the source likely does
      // if anyone cares about the id).
      const itemId = this.idOf(item) ?? target.idOf(item)
      const transfer = { item, from: this, to: target, oldIndex, newIndex, itemId }
      this.options.onRemove(transfer)
      target.options.onAdd(transfer)
      target.options.onSortEnd({
        item,
        oldIndex: -1,
        newIndex,
        items: targetItems2,
        oldId: undefined,
        newId: target.idOf(item),
        order: target.orderOf(targetItems2),
      })
    } else {
      // Within-container reorder
      const newIndex = this.currentIndex

      if (oldIndex !== newIndex) {
        const items = this.getItems()
        this.reorderDOM(items, oldIndex, newIndex)
      }

      const finalItems = this.getItems()
      this.options.onSortEnd({
        item,
        oldIndex,
        newIndex,
        items: finalItems,
        oldId: this.idOf(item),
        newId: this.idOf(finalItems[newIndex]),
        order: this.orderOf(finalItems),
      })
    }

    // Reset all transforms in this container
    for (const el of this.getItems()) {
      el.style.transform = ''
      el.style.transition = ''
    }

    // ARIA: announce final position and update all item attrs
    if (this.options.aria) {
      const label = item.textContent?.trim() || 'Item'
      const finalItems = this.getItems()
      const finalIndex = finalItems.indexOf(item)
      announce(getMessages().dropped(label, finalIndex + 1, finalItems.length))
      for (let i = 0; i < finalItems.length; i++) {
        setSortableItemAttrs(finalItems[i], i, finalItems.length)
      }
    }

    // Capture the target *before* clearing state, so post-drop refresh can see it.
    const landedTarget = this.targetSortable

    // Clean up state
    this.dragItem = null
    this.dragIndex = -1
    this.currentIndex = -1
    this.targetSortable = null
    this.targetIndex = -1

    // Surgical post-drop refresh:
    //  - Same-container reorder: just invalidate cache + refresh ARIA.
    //    DOM order changed, but Draggable bindings are still bound to the
    //    correct elements (the handlers close over `item`).
    //  - Cross-container: the item moved between containers. Diff-based
    //    setup() cleans up the from-side and binds the to-side.
    if (isCrossContainer && landedTarget) {
      this.setup()
      landedTarget.setup()
      // Refresh any other group members lightly (rare edge).
      if (this.options.group) {
        for (const member of getGroupMembers(this.options.group)) {
          if (member !== this && member !== landedTarget) member.refreshAfterReorder()
        }
      }
    } else {
      this.refreshAfterReorder()
    }
  }

  snapshotItems() {
    const items = this.getItems()
    const checker = this.options.rectChecker
    this.itemStates = items.map((el, i) => ({
      el,
      rect: checker ? checker(el) : el.getBoundingClientRect(),
      originalIndex: i,
    }))
  }

  private animateItems(dragEl: HTMLElement) {
    const isVertical = this.options.axis === 'y'
    // Skip the transition for users who requested reduced motion. The final
    // position still updates — just no animated slide.
    const duration = prefersReducedMotion() ? 0 : this.options.animationDuration
    const from = this.dragIndex
    const to = this.currentIndex

    for (let i = 0; i < this.itemStates.length; i++) {
      if (this.itemStates[i].el === dragEl) continue

      const el = this.itemStates[i].el
      let offset = 0

      if (from < to && i > from && i <= to) {
        const target = this.itemStates[i - 1].rect
        const current = this.itemStates[i].rect
        offset = isVertical ? target.top - current.top : target.left - current.left
      } else if (from > to && i >= to && i < from) {
        const target = this.itemStates[i + 1].rect
        const current = this.itemStates[i].rect
        offset = isVertical ? target.top - current.top : target.left - current.left
      }

      el.style.transition = duration > 0 ? `transform ${duration}ms ease` : ''
      el.style.transform = isVertical ? `translateY(${offset}px)` : `translateX(${offset}px)`
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

  /**
   * Update sortable options in place. Options that only affect handlers
   * (onSort, onSortEnd, etc.), classes, or animation duration are cheap.
   * Options that affect how Draggables are constructed (handle, axis when
   * not in group mode, items selector) trigger a full re-setup.
   */
  updateOptions(partial: Partial<SortableOptions>): void {
    // Detect if the new options require tearing down and rebuilding the
    // per-item Draggables (because the Draggable constructor options changed).
    const needsRebind =
      ('handle' in partial && partial.handle !== this.options.handle) ||
      ('axis' in partial && partial.axis !== this.options.axis && !this.options.group) ||
      ('items' in partial && partial.items !== this.options.items) ||
      ('rectChecker' in partial && partial.rectChecker !== (this.options.rectChecker ?? undefined))

    Object.assign(this.options, partial)
    // Allow explicit clearing.
    if ('rectChecker' in partial && partial.rectChecker === undefined) {
      this.options.rectChecker = null
    }

    if (needsRebind) this.setup()
  }

  /** Get the current order of items */
  getOrder(): HTMLElement[] {
    return this.getItems().slice()
  }

  /** Programmatically move an item */
  move(fromIndex: number, toIndex: number) {
    const items = this.getItems()
    if (fromIndex < 0 || fromIndex >= items.length) return
    if (toIndex < 0 || toIndex >= items.length) return
    if (fromIndex === toIndex) return

    const movedItem = items[fromIndex]
    this.reorderDOM(items, fromIndex, toIndex)
    this.refreshAfterReorder()

    const afterItems = this.getItems()
    this.options.onSortEnd({
      item: movedItem,
      oldIndex: fromIndex,
      newIndex: toIndex,
      items: afterItems,
      oldId: this.idOf(movedItem),
      newId: this.idOf(afterItems[toIndex]),
      order: this.orderOf(afterItems),
    })
  }

  private teardown() {
    for (const d of this.draggableMap.values()) d.destroy()
    this.draggableMap.clear()
    this.invalidateItemsCache()
  }

  destroy() {
    this.teardown()
    this.removePlaceholder()
    const items = this.getItems()
    for (const el of items) {
      el.style.transform = ''
      el.style.transition = ''
      if (this.options.aria) {
        clearSortableItemAttrs(el)
      }
    }
    if (this.options.aria) {
      clearSortableContainerAttrs(this.container)
    }
    if (this.options.group) {
      unregisterGroup(this.options.group, this)
    }
  }
}

export function sortable(container: HTMLElement | string, options?: SortableOptions): Sortable {
  const el = typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container

  if (!el) throw new Error(`Container not found: ${container}`)

  return new Sortable(el, options)
}

export default sortable
