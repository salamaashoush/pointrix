// ARIA accessibility support — live regions, attributes, and i18n messages

// ─── Messages (i18n) ───────────────────────────────────────────────
// All screen reader announcement strings. Override via setMessages()
// to translate to any language.

export interface AriaMessages {
  instructions: string
  pickedUp: (label: string, position: number, total: number) => string
  movedTo: (position: number, total: number) => string
  dropped: (label: string, position: number, total: number) => string
  dragPickedUp: string
  dragDropped: string
}

const defaultMessages: AriaMessages = {
  instructions: 'Press Space or Enter to pick up. Use arrow keys to move. Press Space or Enter to drop. Press Escape to cancel.',
  pickedUp: (label, pos, total) => `Picked up ${label}, position ${pos} of ${total}`,
  movedTo: (pos, total) => `Moved to position ${pos} of ${total}`,
  dropped: (label, pos, total) => `Dropped ${label} in position ${pos} of ${total}`,
  dragPickedUp: 'Picked up',
  dragDropped: 'Dropped',
}

let messages: AriaMessages = { ...defaultMessages }

/** Override announcement messages for i18n / localization */
export function setMessages(custom: Partial<AriaMessages>): void {
  messages = { ...messages, ...custom }
}

/** Get current messages (for reading) */
export function getMessages(): Readonly<AriaMessages> {
  return messages
}

// ─── Live Region ────────────────────────────────────────────────────

let liveRegion: HTMLElement | null = null

function ensureLiveRegion(): HTMLElement {
  if (liveRegion && liveRegion.isConnected) return liveRegion

  liveRegion = document.createElement('div')
  liveRegion.setAttribute('aria-live', 'assertive')
  liveRegion.setAttribute('aria-atomic', 'true')
  liveRegion.setAttribute('role', 'status')
  liveRegion.style.cssText =
    'position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'
  document.body.appendChild(liveRegion)
  return liveRegion
}

export function announce(message: string): void {
  const region = ensureLiveRegion()
  region.textContent = ''
  requestAnimationFrame(() => {
    region.textContent = message
  })
}

// ─── Instructions ───────────────────────────────────────────────────

let instructionsEl: HTMLElement | null = null
const INSTRUCTIONS_ID = 'grip-instructions'

export function ensureInstructions(): string {
  if (instructionsEl && instructionsEl.isConnected) {
    instructionsEl.textContent = messages.instructions
    return INSTRUCTIONS_ID
  }

  instructionsEl = document.createElement('div')
  instructionsEl.id = INSTRUCTIONS_ID
  instructionsEl.style.cssText =
    'position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'
  instructionsEl.textContent = messages.instructions
  document.body.appendChild(instructionsEl)
  return INSTRUCTIONS_ID
}

// ─── Draggable Attrs ────────────────────────────────────────────────

export function setDraggableAttrs(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0')
  if (!el.hasAttribute('role')) el.setAttribute('role', 'button')
  el.setAttribute('aria-roledescription', 'draggable')
  el.setAttribute('aria-describedby', ensureInstructions())
}

export function setDraggingAttrs(el: HTMLElement, grabbed: boolean): void {
  el.setAttribute('aria-grabbed', String(grabbed))
}

export function clearDraggableAttrs(el: HTMLElement): void {
  el.removeAttribute('aria-roledescription')
  el.removeAttribute('aria-grabbed')
  el.removeAttribute('aria-describedby')
}

// ─── Sortable Attrs ─────────────────────────────────────────────────

export function setSortableItemAttrs(el: HTMLElement, index: number, total: number): void {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0')
  if (!el.hasAttribute('role')) el.setAttribute('role', 'option')
  el.setAttribute('aria-roledescription', 'sortable')
  el.setAttribute('aria-describedby', ensureInstructions())
  el.setAttribute('aria-posinset', String(index + 1))
  el.setAttribute('aria-setsize', String(total))
}

export function clearSortableItemAttrs(el: HTMLElement): void {
  el.removeAttribute('aria-roledescription')
  el.removeAttribute('aria-grabbed')
  el.removeAttribute('aria-describedby')
  el.removeAttribute('aria-posinset')
  el.removeAttribute('aria-setsize')
}

export function setSortableContainerAttrs(el: HTMLElement): void {
  if (!el.hasAttribute('role')) el.setAttribute('role', 'listbox')
}

export function clearSortableContainerAttrs(el: HTMLElement): void {
  if (el.getAttribute('role') === 'listbox') el.removeAttribute('role')
}

// ─── Dropzone Attrs ─────────────────────────────────────────────────

export function setDropzoneAttrs(el: HTMLElement): void {
  el.setAttribute('aria-dropeffect', 'move')
}

export function setDropzoneActiveAttrs(el: HTMLElement, active: boolean): void {
  el.setAttribute('aria-dropeffect', active ? 'move' : 'none')
}

export function clearDropzoneAttrs(el: HTMLElement): void {
  el.removeAttribute('aria-dropeffect')
}
