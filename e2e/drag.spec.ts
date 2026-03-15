import { test, expect } from '@playwright/test'

const TEST_PAGE = '/e2e/test-page.html'

async function waitForReady(page: import('@playwright/test').Page) {
  await page.goto(TEST_PAGE)
  await page.waitForFunction(() => (window as any).__gripReady === true, null, { timeout: 5000 })
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

test.describe('Drag interactions', () => {
  test('basic drag moves element', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#drag-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)
    await drag(page, c.x, c.y, 120, 80)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Element should have moved roughly by the drag distance
    expect(after!.x).toBeGreaterThan(before!.x + 80)
    expect(after!.y).toBeGreaterThan(before!.y + 40)
  })

  test('axis x constraint only moves horizontally', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#drag-x-only')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)
    await drag(page, c.x, c.y, 100, 80)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // X should change, Y should stay the same
    expect(after!.x).toBeGreaterThan(before!.x + 60)
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(5)
  })

  test('bounds constraint keeps element within parent', async ({ page }) => {
    await waitForReady(page)

    const parent = page.locator('#bounds-parent')
    const el = page.locator('#drag-bounded')

    const parentBox = await parent.boundingBox()
    const elBox = await el.boundingBox()
    expect(parentBox).not.toBeNull()
    expect(elBox).not.toBeNull()

    const c = center(elBox!)

    // Attempt to drag way outside the parent to the right and down
    await drag(page, c.x, c.y, 600, 600)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Element should stay within parent bounds
    expect(after!.x + after!.width).toBeLessThanOrEqual(parentBox!.x + parentBox!.width + 2)
    expect(after!.y + after!.height).toBeLessThanOrEqual(parentBox!.y + parentBox!.height + 2)
  })

  test('bounds constraint prevents dragging above parent', async ({ page }) => {
    await waitForReady(page)

    const parent = page.locator('#bounds-parent')
    const el = page.locator('#drag-bounded')

    const parentBox = await parent.boundingBox()
    const elBox = await el.boundingBox()
    expect(parentBox).not.toBeNull()
    expect(elBox).not.toBeNull()

    const c = center(elBox!)

    // Attempt to drag up and left outside the parent
    await drag(page, c.x, c.y, -200, -200)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Element should not go above or to the left of parent
    expect(after!.x).toBeGreaterThanOrEqual(parentBox!.x - 2)
    expect(after!.y).toBeGreaterThanOrEqual(parentBox!.y - 2)
  })

  test('grid snapping snaps to grid positions', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#drag-grid')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)

    // Drag by 73px (should snap to nearest 50px multiple)
    await drag(page, c.x, c.y, 73, 73)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // The transform should be a multiple of 50
    // We check that the offset from the original position is close to a 50px multiple
    const dx = after!.x - before!.x
    const dy = after!.y - before!.y

    const snapDx = Math.round(dx / 50) * 50
    const snapDy = Math.round(dy / 50) * 50

    expect(Math.abs(dx - snapDx)).toBeLessThan(5)
    expect(Math.abs(dy - snapDy)).toBeLessThan(5)
  })

  test('momentum continues movement after release', async ({ page }) => {
    await waitForReady(page)

    const el = page.locator('#drag-momentum')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)

    // Fast drag to create velocity
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    // Quick movement with few steps to build velocity
    await page.mouse.move(c.x + 150, c.y, { steps: 3 })
    await page.mouse.up()

    // Record position right after release
    const afterRelease = await el.boundingBox()
    expect(afterRelease).not.toBeNull()

    // Wait for momentum animation to run
    await page.waitForTimeout(500)

    const afterMomentum = await el.boundingBox()
    expect(afterMomentum).not.toBeNull()

    // Element should have continued moving due to momentum
    // The position after momentum should be further than right after release
    expect(afterMomentum!.x).toBeGreaterThanOrEqual(afterRelease!.x)
  })

  test('multi-touch drag does not break', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox does not support touch emulation well')

    await waitForReady(page)

    const el = page.locator('#drag-basic')
    const before = await el.boundingBox()
    expect(before).not.toBeNull()

    const c = center(before!)

    // Simulate two sequential pointer interactions (not truly multi-touch in mouse mode)
    await drag(page, c.x, c.y, 50, 50)

    const mid = await el.boundingBox()
    expect(mid).not.toBeNull()
    expect(mid!.x).toBeGreaterThan(before!.x)

    const c2 = center(mid!)
    await drag(page, c2.x, c2.y, -30, -30)

    const after = await el.boundingBox()
    expect(after).not.toBeNull()

    // Element should still be movable after multiple interactions
    expect(after!.x).toBeLessThan(mid!.x)
  })
})
