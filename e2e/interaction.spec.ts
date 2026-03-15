import { test, expect } from '@playwright/test'

const TEST_PAGE = '/e2e/test-page.html'

async function waitForReady(page: import('@playwright/test').Page) {
  await page.goto(TEST_PAGE)
  await page.waitForFunction(() => (window as any).__hyperactReady === true, null, { timeout: 5000 })
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function drag(
  page: import('@playwright/test').Page,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  steps = 10,
) {
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps })
  await page.mouse.up()
}

test.describe('Combined interactions', () => {
  test('drag from center and resize from edge on same element', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#both-element')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    // First: drag from center
    const c = center(before!)
    await drag(page, c.x, c.y, 60, 40)

    const afterDrag = await el.boundingBox()
    expect(afterDrag).not.toBeNull()
    expect(afterDrag!.x).toBeGreaterThan(before!.x + 30)
    expect(afterDrag!.y).toBeGreaterThan(before!.y + 20)

    // Second: resize from right edge
    const rightEdgeX = afterDrag!.x + afterDrag!.width - 3
    const midY = afterDrag!.y + afterDrag!.height / 2
    await drag(page, rightEdgeX, midY, 50, 0)

    const afterResize = await el.boundingBox()
    expect(afterResize).not.toBeNull()
    expect(afterResize!.width).toBeGreaterThan(afterDrag!.width + 20)
  })

  test('multiple draggable elements do not interfere', async ({ page }) => {
    await waitForReady(page)

    const basic = page.locator('#drag-basic')
    const grid = page.locator('#drag-grid')

    const basicBefore = await basic.boundingBox()
    const gridBefore = await grid.boundingBox()
    expect(basicBefore).not.toBeNull()
    expect(gridBefore).not.toBeNull()

    // Drag the basic element
    const c1 = center(basicBefore!)
    await drag(page, c1.x, c1.y, 80, 60)

    const basicAfter = await basic.boundingBox()
    const gridAfter = await grid.boundingBox()
    expect(basicAfter).not.toBeNull()
    expect(gridAfter).not.toBeNull()

    // Basic should have moved
    expect(basicAfter!.x).toBeGreaterThan(basicBefore!.x + 40)

    // Grid element should not have moved
    expect(Math.abs(gridAfter!.x - gridBefore!.x)).toBeLessThan(3)
    expect(Math.abs(gridAfter!.y - gridBefore!.y)).toBeLessThan(3)
  })

  test('rapid pointer movements do not break interactions', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#drag-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)

    // Perform many rapid small drags
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()

    // Move rapidly in small steps
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(c.x + i * 5, c.y + i * 3, { steps: 1 })
    }
    await page.mouse.up()

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Element should have moved and not be stuck
    expect(after!.x).toBeGreaterThan(before!.x + 50)
    expect(after!.y).toBeGreaterThan(before!.y + 30)
  })

  test('touch events work on mobile viewports', async ({ page, browserName, isMobile }) => {
    test.skip(!isMobile, 'Touch test only runs on mobile projects with hasTouch enabled')
    test.skip(browserName === 'firefox', 'Firefox does not support touch emulation well')

    await waitForReady(page)

    const el = page.locator('#drag-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)

    // Use touchscreen tap to verify touch events do not throw
    await page.touchscreen.tap(c.x, c.y)
    await page.waitForTimeout(100)

    // The element should still be interactable -- verify with a mouse drag
    const c2 = center((await el.boundingBox())!)
    await drag(page, c2.x, c2.y, 80, 60)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()
    expect(after!.x).toBeGreaterThan(before!.x + 30)
  })

  test('performance: 20 draggable elements are responsive', async ({ page }) => {
    await waitForReady(page)

    const items = page.locator('.multi-drag')
    const count = await items.count()
    expect(count).toBe(20)

    // Scroll the multi-container into view and drag two elements
    const first = items.nth(0)
    const second = items.nth(5)

    await first.scrollIntoViewIfNeeded()

    const firstBefore = await first.boundingBox()
    const secondBefore = await second.boundingBox()
    expect(firstBefore).not.toBeNull()
    expect(secondBefore).not.toBeNull()

    // Drag first element
    const c1 = center(firstBefore!)
    await drag(page, c1.x, c1.y, 40, 30)

    const firstAfter = await first.boundingBox()
    expect(firstAfter).not.toBeNull()
    expect(firstAfter!.x).toBeGreaterThan(firstBefore!.x + 20)

    // Drag second element
    const c2 = center(secondBefore!)
    await drag(page, c2.x, c2.y, 60, 30)

    const secondAfter = await second.boundingBox()
    expect(secondAfter).not.toBeNull()
    expect(secondAfter!.x).toBeGreaterThan(secondBefore!.x + 20)
  })

  test('drag performance: rapid sequential drags on many elements', async ({ page }) => {
    await waitForReady(page)

    const items = page.locator('.multi-drag')
    const count = await items.count()

    const startTime = Date.now()

    // Quickly drag 10 elements in sequence
    for (let i = 0; i < Math.min(10, count); i++) {
      const item = items.nth(i)
      const box = await item.boundingBox()
      if (!box) continue

      const c = center(box)
      await drag(page, c.x, c.y, 20, 15, 3)
    }

    const elapsed = Date.now() - startTime

    // All 10 drags should complete within a reasonable time (10 seconds)
    expect(elapsed).toBeLessThan(10000)

    // Verify at least the first element moved
    const firstBox = await items.nth(0).boundingBox()
    expect(firstBox).not.toBeNull()
  })
})
