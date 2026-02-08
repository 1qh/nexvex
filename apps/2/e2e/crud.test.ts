// biome-ignore-all lint/performance/useTopLevelRegex: x
import { expect, test } from './fixtures'
import { login } from './helpers'

const BLOG_DETAIL_URL = /\/crud\/[a-z0-9]+$/u,
  BLOG_EDIT_URL = /\/crud\/[a-z0-9]+\/edit$/u

test.describe
  .serial('Blog CRUD - Create', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('shows create button', async ({ crudPage }) => {
      await expect(crudPage.getCreateTrigger()).toBeVisible()
    })

    test('opens create dialog when clicking plus button', async ({ crudPage }) => {
      await crudPage.getCreateTrigger().click()
      await expect(crudPage.getCreateDialog()).toBeVisible()
    })

    test('can create a new blog post', async ({ crudPage }) => {
      const title = `Test Blog ${Date.now()}`
      await crudPage.createBlog(title, 'This is test content for the blog post.')

      await expect(crudPage.getBlogCards().first()).toContainText(title)
    })

    test('created blog appears in the list', async ({ crudPage }) => {
      const initialCount = await crudPage.getBlogCards().count()
      const title = `Listed Blog ${Date.now()}`
      await crudPage.createBlog(title, 'Content for listing test')

      await expect(crudPage.getBlogList()).toBeVisible()
      await expect(crudPage.getBlogCards()).toHaveCount(initialCount + 1, { timeout: 10_000 })
    })

    test('form validates required fields', async ({ crudPage, page }) => {
      await crudPage.getCreateTrigger().click()
      await crudPage.getCreateSubmit().click()

      await expect(crudPage.getCreateDialog()).toBeVisible()
      await expect(page.locator('[data-invalid="true"]').first()).toBeVisible()
    })
  })

test.describe
  .serial('Blog CRUD - Read', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('shows list or empty state', async ({ crudPage }) => {
      const blogList = crudPage.getBlogList()
      const emptyState = crudPage.getEmptyState()

      const listVisible = await blogList.isVisible().catch(() => false)
      const emptyVisible = await emptyState.isVisible().catch(() => false)

      // eslint-disable-next-line jest/no-conditional-in-test
      expect(listVisible || emptyVisible).toBe(true)
    })

    test('can navigate to blog detail page', async ({ crudPage, page }) => {
      const title = `Detail Blog ${Date.now()}`
      await crudPage.createBlog(title, 'Content for detail test')

      await crudPage.getBlogCards().first().locator('[data-testid="blog-card-link"]').click()
      await expect(page).toHaveURL(BLOG_DETAIL_URL)
      await expect(page.getByTestId('blog-detail-page')).toBeVisible()
      await expect(page.getByTestId('blog-detail-title')).toContainText(title)
    })
  })

test.describe
  .serial('Blog CRUD - Update', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('can navigate to edit page', async ({ crudPage, page }) => {
      const title = `Edit Blog ${Date.now()}`
      await crudPage.createBlog(title, 'Content to edit')

      await page.locator('[href*="/edit"]').first().click()
      await expect(page).toHaveURL(BLOG_EDIT_URL)
      await expect(page.getByTestId('edit-blog-page').first()).toBeVisible()
    })

    test('edit form shows current values', async ({ crudPage, page }) => {
      const title = `Pre-filled Blog ${Date.now()}`
      const content = 'Pre-filled content'
      await crudPage.createBlog(title, content)

      await page.locator('[href*="/edit"]').first().click()
      await expect(page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('edit-title').first().locator('input')).toHaveValue(title)
      await expect(page.getByTestId('edit-content').first().locator('textarea')).toHaveValue(content)
    })

    test('can update blog title', async ({ crudPage, page }) => {
      const title = `Original Title ${Date.now()}`
      await crudPage.createBlog(title, 'Content')

      await page.locator('[href*="/edit"]').first().click()
      await expect(page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })
      const newTitle = `Updated Title ${Date.now()}`
      await page.getByTestId('edit-title').first().locator('input').fill(newTitle)
      await page.getByTestId('edit-save').first().click()

      await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 })
    })

    test('can toggle publish status', async ({ crudPage, page }) => {
      const title = `Toggle Blog ${Date.now()}`
      await crudPage.createBlog(title, 'Content')

      await page.locator('[href*="/edit"]').first().click()
      await page.getByTestId('settings-trigger').first().click()
      await expect(page.getByTestId('settings-popover')).toBeVisible()

      const publishSwitch = page.locator('[data-testid="settings-popover"]').locator('button[role="switch"]')
      await publishSwitch.click()
      await page.getByTestId('settings-popover').locator('button[type="submit"]').click()

      await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 })
    })
  })

test.describe
  .serial('Blog CRUD - Delete', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('shows delete confirmation dialog', async ({ crudPage }) => {
      await crudPage.createBlog(`Delete Test ${Date.now()}`, 'To be deleted')

      await crudPage.getDeleteTrigger().click()
      await expect(crudPage.getDeleteDialog()).toBeVisible()
      await expect(crudPage.getDeleteDialog()).toContainText('Delete blog?')
    })

    test('can cancel delete', async ({ crudPage }) => {
      const title = `Cancel Delete ${Date.now()}`
      await crudPage.createBlog(title, 'Not deleted')

      await crudPage.getDeleteTrigger().click()
      await crudPage.getDeleteCancel().click()

      await expect(crudPage.getDeleteDialog()).not.toBeVisible()
      await expect(crudPage.getBlogCards().first()).toContainText(title)
    })

    test('can confirm delete', async ({ crudPage }) => {
      const initialCount = await crudPage.getBlogCards().count()
      await crudPage.createBlog(`Confirm Delete ${Date.now()}`, 'Deleted')

      await crudPage.deleteBlog()
      await expect(crudPage.getBlogCards()).toHaveCount(initialCount, { timeout: 10_000 })
    })

    test('optimistic delete removes card immediately', async ({ crudPage }) => {
      const initialCount = await crudPage.getBlogCards().count()
      await crudPage.createBlog(`Optimistic Delete ${Date.now()}`, 'Quick delete')
      await expect(crudPage.getBlogCards()).toHaveCount(initialCount + 1)

      await crudPage.getDeleteTrigger().click()
      await crudPage.getDeleteConfirm().click()

      await expect(crudPage.getBlogCards()).toHaveCount(initialCount, { timeout: 1000 })
    })
  })

test.describe
  .serial('Blog CRUD - Navigation', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('back link works from edit page to detail', async ({ crudPage, page }) => {
      const title = `Back Link ${Date.now()}`
      await crudPage.createBlog(title, 'Content')

      await page.locator('[href*="/edit"]').first().click()
      await expect(page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })
      await page.getByTestId('back-link').first().click()

      await expect(page).toHaveURL(BLOG_DETAIL_URL)
      await expect(page.getByTestId('blog-detail-page')).toBeVisible()
    })

    test('static page loads blogs', async ({ crudPage }) => {
      const title = `Static Test ${Date.now()}`
      await crudPage.createBlog(title, 'Static content')
      await crudPage.goto('/crud/static')

      await expect(crudPage.getBlogCards().first()).toContainText(title, { timeout: 10_000 })
    })
  })
