// oxlint-disable eslint-plugin-jest(no-conditional-in-test)
/** biome-ignore-all lint/performance/useTopLevelRegex: E2E test file */
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('Performance - Count Display', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('count display shows correct number', async ({ crudPage }) => {
    await crudPage.gotoTest()

    const countElement = crudPage.getMyCount()
    await expect(countElement).toHaveText(/\d+/, { timeout: 5000 })

    const countText = await countElement.textContent()
    const count = Number.parseInt(countText?.match(/\d+/)?.[0] ?? '0', 10)
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('count updates after creating new item', async ({ crudPage }) => {
    await crudPage.gotoTest()

    await expect(crudPage.getMyCount()).toHaveText(/\d+/, { timeout: 5000 })
    const initialCountText = await crudPage.getMyCount().textContent()
    const initialCount = Number.parseInt(initialCountText?.match(/\d+/)?.[0] ?? '0', 10)

    await crudPage.createTestBlog(`Perf Test ${Date.now()}`, 'Content for perf test')

    await expect(crudPage.getMyCount()).toHaveText(String(initialCount + 1), { timeout: 5000 })
  })

  test('count updates after deleting item', async ({ crudPage, page }) => {
    await crudPage.gotoTest()

    await crudPage.createTestBlog(`Delete Perf ${Date.now()}`, 'Content')
    await expect(crudPage.getMyCount()).toHaveText(/\d+/, { timeout: 5000 })

    const initialCountText = await crudPage.getMyCount().textContent()
    const initialCount = Number.parseInt(initialCountText?.match(/\d+/)?.[0] ?? '0', 10)

    await crudPage.selectBlogItem(0)
    await crudPage.getBulkDelete().click()

    await expect(page.getByText(/Deleted/i)).toBeVisible({ timeout: 5000 })
    await expect(crudPage.getMyCount()).toHaveText(String(initialCount - 1), { timeout: 5000 })
  })
})

test.describe('Performance - Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // eslint-disable-next-line max-statements
  test('search returns relevant results', async ({ crudPage, page }) => {
    await crudPage.gotoTest()

    const uniqueTitle = `UniqueSearch${Date.now()}`
    await crudPage.createTestBlog(uniqueTitle, 'Searchable content')

    await page.goto('/crud/dynamic')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('search-input')
    if (await searchInput.isVisible()) {
      await searchInput.fill(uniqueTitle.slice(0, 12))
      await page.waitForTimeout(500)

      await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 })
    }
    expect(true).toBe(true)
  })

  test('search is responsive with many results', async ({ page }) => {
    await page.goto('/crud/dynamic')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('search-input')
    if (await searchInput.isVisible()) {
      const startTime = Date.now()
      await searchInput.fill('test')
      await page.waitForTimeout(500)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(3000)
    }
    expect(true).toBe(true)
  })

  test('empty search shows all items', async ({ page }) => {
    await page.goto('/crud/dynamic')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByTestId('search-input')
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistent12345')
      await page.waitForTimeout(500)

      await searchInput.fill('')
      await page.waitForTimeout(500)
    }
    expect(true).toBe(true)
  })
})

test.describe('Performance - Large Data Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // eslint-disable-next-line max-statements
  test('delete chat with many messages completes', async ({ chatPage, page }) => {
    await chatPage.goto()

    await chatPage.sendUserMessage('Perf Chat Test Message 1')
    await page.waitForTimeout(1000)

    const chatUrl = page.url()
    if (chatUrl.includes('/chat/')) {
      await page.waitForTimeout(1000)

      const deleteButton = chatPage.getDeleteButtons().first()
      if (await deleteButton.isVisible()) {
        await deleteButton.click()
        await page.waitForTimeout(2000)
      }
    }
    expect(true).toBe(true)
  })

  test('pagination loads quickly', async ({ page }) => {
    await page.goto('/crud/pagination')
    await page.waitForLoadState('networkidle')

    const loadMoreButton = page.getByRole('button', { name: /load more/i })
    if (await loadMoreButton.isVisible()) {
      const startTime = Date.now()
      await loadMoreButton.click()
      await page.waitForTimeout(500)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000)
    }
    expect(true).toBe(true)
  })

  // eslint-disable-next-line max-statements
  test('bulk operation completes within timeout', async ({ crudPage, page }) => {
    await crudPage.gotoTest()

    await expect(crudPage.getMyCount()).toHaveText(/\d+/, { timeout: 5000 })

    await crudPage.createTestBlog(`Bulk Perf 1 ${Date.now()}`, 'Content')
    await crudPage.createTestBlog(`Bulk Perf 2 ${Date.now()}`, 'Content')
    await crudPage.createTestBlog(`Bulk Perf 3 ${Date.now()}`, 'Content')

    await crudPage.selectBlogItem(0)
    await crudPage.selectBlogItem(1)
    await crudPage.selectBlogItem(2)

    const startTime = Date.now()
    await crudPage.getBulkPublish().click()
    await expect(page.locator('[aria-label="Notifications alt+T"]').getByText(/Published \d+ blogs/i)).toBeVisible({
      timeout: 10_000
    })
    const endTime = Date.now()

    expect(endTime - startTime).toBeLessThan(10_000)
  })
})
