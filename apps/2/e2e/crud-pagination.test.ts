import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe
  .serial('Blog Pagination', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/pagination')
    })

    test('shows pagination page with create button', async ({ crudPage }) => {
      await expect(crudPage.getCreateTrigger()).toBeVisible()
    })

    test('newly created blogs appear in list', async ({ crudPage }) => {
      const title = `Pagination New ${Date.now()}`
      await crudPage.createBlog(title, 'Fresh content')
      await expect(crudPage.getBlogCards().first()).toContainText(title, { timeout: 10_000 })
    })

    test('pagination UI is visible after data loads', async ({ crudPage, page }) => {
      await page.waitForSelector(
        '[data-testid="pagination-exhausted"], [data-testid="load-more-trigger"], [data-testid="loading-more"]',
        { timeout: 10_000 }
      )

      const exhausted = crudPage.getPaginationExhausted()
      const loadMore = crudPage.getLoadMoreTrigger()
      const loadingMore = crudPage.getLoadingMore()

      const exhaustedVisible = await exhausted.isVisible().catch(() => false)
      const loadMoreVisible = await loadMore.isVisible().catch(() => false)
      const loadingVisible = await loadingMore.isVisible().catch(() => false)

      // eslint-disable-next-line jest/no-conditional-in-test
      expect(exhaustedVisible || loadMoreVisible || loadingVisible).toBe(true)
    })
  })
