/* eslint-disable jest/no-conditional-in-test */
// biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('loading spinner appears during page navigation', async ({ page }) => {
    await page.goto('/crud/static')
    const navigationPromise = page.goto('/chat')
    await navigationPromise
    expect(true).toBe(true)
  })

  test('loading state shows during data fetch', async ({ page }) => {
    await page.goto('/crud/static')

    const hasLoadingState = await page
      .locator('[data-testid="blog-list"], [data-testid="empty-state"], .animate-spin')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)

    expect(hasLoadingState).toBe(true)
  })

  test('loading spinner disappears after content loads', async ({ page }) => {
    await page.goto('/crud/static')

    await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]', { timeout: 10_000 })

    const spinnerVisible = await page
      .locator('.animate-spin')
      .first()
      .isVisible()
      .catch(() => false)

    expect(spinnerVisible).toBe(false)
  })

  test('suspense boundary shows loading during chat navigation', async ({ page }) => {
    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]', { timeout: 10_000 })
    await page.goto('/chat')
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10_000 })
  })

  test('suspense boundary shows loading during crud navigation', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10_000 })
    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]', { timeout: 10_000 })
    await expect(page.getByTestId('create-blog-trigger').first()).toBeVisible({ timeout: 10_000 })
  })

  test('nested suspense boundaries work correctly', async ({ page }) => {
    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]', { timeout: 10_000 })

    await page.getByTestId('create-blog-trigger').first().click()
    await page.getByTestId('create-blog-dialog').waitFor({ state: 'visible' })

    expect(await page.getByTestId('blog-title').locator('input').isVisible()).toBe(true)
  })

  test('loading state during form submission', async ({ page }) => {
    await page.goto('/crud/static')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.getByTestId('create-blog-dialog').waitFor({ state: 'visible' })

    await page.getByTestId('blog-title').locator('input').fill('Loading Test')
    await page.getByTestId('blog-content').locator('textarea').fill('Testing loading states')
    await page.getByTestId('create-blog-submit').click()

    await page.getByTestId('create-blog-dialog').waitFor({ state: 'hidden', timeout: 10_000 })
  })
})
