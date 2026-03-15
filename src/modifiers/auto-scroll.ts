import type { Modifier, ModifierContext, ModifierResult } from '../types'

export interface AutoScrollOptions {
  container?: HTMLElement | Window
  speed?: number
  margin?: number
  acceleration?: number
}

export class AutoScrollModifier implements Modifier {
  public name = 'auto-scroll'
  private options: Required<AutoScrollOptions>
  private animationFrame: number | null = null

  constructor(options?: AutoScrollOptions) {
    this.options = {
      container: options?.container ?? window,
      speed: options?.speed ?? 10,
      margin: options?.margin ?? 50,
      acceleration: options?.acceleration ?? 5,
    }
  }

  onStart(): void {
    this.animationFrame = null
  }

  modify(context: ModifierContext): ModifierResult {
    const container = this.resolveContainer(context.element)
    const containerRect = this.getContainerRect(container)
    const { margin, speed, acceleration } = this.options

    const pointerX = context.position.x + context.delta.x
    const pointerY = context.position.y + context.delta.y

    let scrollX = 0
    let scrollY = 0

    // Check distance from right edge
    const distRight = containerRect.right - pointerX
    if (distRight < margin && distRight > 0) {
      const intensity = 1 - distRight / margin
      scrollX = Math.min(speed, intensity * acceleration * speed)
    }

    // Check distance from left edge
    const distLeft = pointerX - containerRect.left
    if (distLeft < margin && distLeft > 0) {
      const intensity = 1 - distLeft / margin
      scrollX = -Math.min(speed, intensity * acceleration * speed)
    }

    // Check distance from bottom edge
    const distBottom = containerRect.bottom - pointerY
    if (distBottom < margin && distBottom > 0) {
      const intensity = 1 - distBottom / margin
      scrollY = Math.min(speed, intensity * acceleration * speed)
    }

    // Check distance from top edge
    const distTop = pointerY - containerRect.top
    if (distTop < margin && distTop > 0) {
      const intensity = 1 - distTop / margin
      scrollY = -Math.min(speed, intensity * acceleration * speed)
    }

    if (scrollX !== 0 || scrollY !== 0) {
      this.performScroll(container, scrollX, scrollY)
    }

    return {
      position: { ...context.position },
      velocity: { ...context.velocity },
      size: context.size ? { ...context.size } : undefined,
    }
  }

  onEnd(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  private resolveContainer(element: HTMLElement): HTMLElement | Window {
    if (this.options.container !== window) {
      return this.options.container
    }

    let parent = element.parentElement
    while (parent) {
      const style = getComputedStyle(parent)
      const overflow = style.overflow + style.overflowX + style.overflowY
      if (/auto|scroll/.test(overflow)) {
        return parent
      }
      parent = parent.parentElement
    }

    return window
  }

  private getContainerRect(container: HTMLElement | Window): {
    left: number
    top: number
    right: number
    bottom: number
  } {
    if (container === window || container instanceof Window) {
      return {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      }
    }

    const rect = (container as HTMLElement).getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    }
  }

  private performScroll(container: HTMLElement | Window, dx: number, dy: number): void {
    if (container === window || container instanceof Window) {
      window.scrollBy(dx, dy)
    } else {
      ;(container as HTMLElement).scrollLeft += dx
      ;(container as HTMLElement).scrollTop += dy
    }
  }
}

export function autoScroll(options?: AutoScrollOptions): AutoScrollModifier {
  return new AutoScrollModifier(options)
}
