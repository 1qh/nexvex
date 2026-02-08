// eslint-disable max-statements
// biome-ignore-all lint/performance/noAwaitInLoops: sequential test operations
// biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe
  .serial('Concurrent Edits', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/crud/dynamic')
    })

    test('two tabs editing same document - last write wins', async ({ browser, page }) => {
      const title = `Concurrent Edit ${Date.now()}`
      const content = 'Original content'

      const context1Page = page
      await context1Page.getByTestId('create-blog-trigger').first().click()
      await context1Page.getByTestId('create-blog-dialog').waitFor({ state: 'visible' })
      await context1Page.getByTestId('blog-title').locator('input').fill(title)
      await context1Page.getByTestId('blog-content').locator('textarea').fill(content)
      await context1Page.getByTestId('create-blog-submit').click()
      await context1Page.getByTestId('create-blog-dialog').waitFor({ state: 'hidden' })

      await context1Page.locator('[href*="/edit"]').first().click()
      await expect(context1Page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })

      const editUrl = context1Page.url()

      const context2 = await browser.newContext()
      const context2Page = await context2.newPage()
      await login(context2Page)
      await context2Page.goto(editUrl)
      await expect(context2Page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })

      await context1Page.getByTestId('edit-title').first().locator('input').fill(`${title} - Tab 1`)
      await context1Page.getByTestId('edit-save').first().click()
      await expect(context1Page.getByText('Saved')).toBeVisible({ timeout: 5000 })

      await context2Page.getByTestId('edit-title').first().locator('input').fill(`${title} - Tab 2`)
      await context2Page.getByTestId('edit-save').first().click()
      await expect(context2Page.getByText('Saved')).toBeVisible({ timeout: 5000 })

      await context1Page.reload()
      await expect(context1Page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })
      await expect(context1Page.getByTestId('edit-title').first().locator('input')).toHaveValue(`${title} - Tab 2`)

      await context2.close()
    })

    test('document deleted while editing shows error or redirect', async ({ browser, page }) => {
      const title = `Delete While Edit ${Date.now()}`
      const content = 'Content to delete'

      const context1Page = page
      await context1Page.getByTestId('create-blog-trigger').first().click()
      await context1Page.getByTestId('create-blog-dialog').waitFor({ state: 'visible' })
      await context1Page.getByTestId('blog-title').locator('input').fill(title)
      await context1Page.getByTestId('blog-content').locator('textarea').fill(content)
      await context1Page.getByTestId('create-blog-submit').click()
      await context1Page.getByTestId('create-blog-dialog').waitFor({ state: 'hidden' })

      await context1Page.locator('[href*="/edit"]').first().click()
      await expect(context1Page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })

      const context2 = await browser.newContext()
      const context2Page = await context2.newPage()
      await login(context2Page)
      await context2Page.goto('/crud/dynamic')
      await context2Page.waitForSelector('[data-testid="blog-card"]', { timeout: 10_000 })

      const blogCard = context2Page.locator('[data-testid="blog-card"]').filter({ hasText: title })
      await blogCard.getByTestId('delete-blog-trigger').first().click()
      await context2Page.getByTestId('delete-dialog').waitFor({ state: 'visible' })
      await context2Page.getByTestId('delete-confirm').click()
      await context2Page.getByTestId('delete-dialog').waitFor({ state: 'hidden' })

      await context1Page.reload()
      await context1Page.waitForLoadState('networkidle')

      const notFoundVisible = await context1Page
        .getByText('Blog not found')
        .isVisible()
        .catch(() => false)
      const notPublishedVisible = await context1Page
        .getByText('not published')
        .isVisible()
        .catch(() => false)
      const redirected = !context1Page.url().includes('/edit')

      // eslint-disable-next-line eslint-plugin-jest/no-conditional-in-test
      expect(notFoundVisible || notPublishedVisible || redirected).toBe(true)

      await context2.close()
    })

    test('rapid successive updates do not lose data', async ({ page }) => {
      const title = `Rapid Update ${Date.now()}`
      const content = 'Initial content'

      await page.getByTestId('create-blog-trigger').first().click()
      await page.getByTestId('create-blog-dialog').waitFor({ state: 'visible' })
      await page.getByTestId('blog-title').locator('input').fill(title)
      await page.getByTestId('blog-content').locator('textarea').fill(content)
      await page.getByTestId('create-blog-submit').click()
      await page.getByTestId('create-blog-dialog').waitFor({ state: 'hidden' })

      await page.locator('[href*="/edit"]').first().click()
      await expect(page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })

      const updates = ['Update 1', 'Update 2', 'Update 3', 'Update 4', 'Update 5']

      for (const update of updates) {
        // eslint-disable-next-line no-await-in-loop
        await page.getByTestId('edit-title').first().locator('input').fill(`${title} - ${update}`)
        // eslint-disable-next-line no-await-in-loop
        await page.getByTestId('edit-save').first().click()
        // eslint-disable-next-line no-await-in-loop
        await expect(page.locator('[aria-label="Notifications alt+T"]').getByText('Saved').first()).toBeVisible({
          timeout: 10_000
        })
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(500)
      }

      await page.reload()
      await expect(page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('edit-title').first().locator('input')).toHaveValue(`${title} - Update 5`)
    })
  })
