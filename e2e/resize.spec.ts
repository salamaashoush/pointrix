import { test, expect } from '@playwright/test'

const TEST_PAGE = '/e2e/test-page.html'

async function waitForReady(page: import('@playwright/test').Page) {
  await page.goto(TEST_PAGE)
  await page.waitForFunction(() => (window as any).__gripReady === true, null, { timeout: 5000 })
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

test.describe('Resize interactions', () => {
  test('resize from right edge increases width', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    // Click near the right edge (within 10px handle area)
    const rightEdgeX = before!.x + before!.width - 3
    const midY = before!.y + before!.height / 2

    await drag(page, rightEdgeX, midY, 80, 0)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Width should have increased
    expect(after!.width).toBeGreaterThan(before!.width + 40)
    // Height should stay roughly the same
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(5)
  })

  test('resize from bottom-right corner changes both dimensions', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    // Click near the bottom-right corner
    const cornerX = before!.x + before!.width - 3
    const cornerY = before!.y + before!.height - 3

    await drag(page, cornerX, cornerY, 60, 40)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Both dimensions should have increased
    expect(after!.width).toBeGreaterThan(before!.width + 30)
    expect(after!.height).toBeGreaterThan(before!.height + 20)
  })

  test('resize respects min constraints', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    // Try to shrink from the right edge below min width (100)
    const rightEdgeX = before!.x + before!.width - 3
    const midY = before!.y + before!.height / 2

    // Drag left by a large amount to try to go below min
    await drag(page, rightEdgeX, midY, -300, 0)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Width should not go below minWidth (100)
    expect(after!.width).toBeGreaterThanOrEqual(98) // small tolerance
  })

  test('resize respects max constraints', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    // Try to expand from the right edge beyond max width (400)
    const rightEdgeX = before!.x + before!.width - 3
    const midY = before!.y + before!.height / 2

    await drag(page, rightEdgeX, midY, 500, 0)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Width should not exceed maxWidth (400)
    expect(after!.width).toBeLessThanOrEqual(402) // small tolerance
  })

  test('resize with aspect ratio preservation', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-aspect')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    // The element has aspectRatio: 2 (width = 2 * height)
    // Resize from the right edge
    const rightEdgeX = before!.x + before!.width - 3
    const midY = before!.y + before!.height / 2

    await drag(page, rightEdgeX, midY, 80, 0)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // The ratio should be approximately 2:1
    const ratio = after!.width / after!.height
    expect(ratio).toBeGreaterThan(1.7)
    expect(ratio).toBeLessThan(2.3)
  })

  test('cursor changes on edge hover', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-basic')
    const box = await el.boundingBox()
    expect(box).not.toBeNull()

    // Move to the right edge
    const rightEdgeX = box!.x + box!.width - 3
    const midY = box!.y + box!.height / 2
    await page.mouse.move(rightEdgeX, midY)

    // Wait a moment for the cursor update handler to fire
    await page.waitForTimeout(100)

    const cursor = await el.evaluate((el) => el.style.cursor)
    expect(cursor).toBe('ew-resize')
  })

  test('cursor changes to nwse-resize on bottom-right corner hover', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#resize-basic')
    const box = await el.boundingBox()
    expect(box).not.toBeNull()

    // Move to the bottom-right corner
    const cornerX = box!.x + box!.width - 3
    const cornerY = box!.y + box!.height - 3
    await page.mouse.move(cornerX, cornerY)

    await page.waitForTimeout(100)

    const cursor = await el.evaluate((el) => el.style.cursor)
    expect(cursor).toBe('nwse-resize')
  })
})
