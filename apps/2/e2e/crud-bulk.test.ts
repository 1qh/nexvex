import { expect, test } from './fixtures'
import { login } from './helpers'

const DIGITS_ONLY = /^\d+$/u,
  PUBLISHED_PATTERN = /Published \d+ blogs?/u,
  UNPUBLISHED_PATTERN = /Unpublished \d+ blogs?/u,
  DELETED_PATTERN = /Deleted \d+ blogs?/u

test.describe
  .serial('Blog Bulk Operations - Selection', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
    })

    test('shows selected count as 0 initially', async ({ crudPage }) => {
      await expect(crudPage.getSelectedCount()).toContainText('0 selected')
    })

    test('bulk buttons are disabled when nothing selected', async ({ crudPage }) => {
      await expect(crudPage.getBulkPublish()).toBeDisabled()
      await expect(crudPage.getBulkUnpublish()).toBeDisabled()
      await expect(crudPage.getBulkDelete()).toBeDisabled()
    })

    test('can select individual blog item', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Select Test ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 1, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await expect(crudPage.getSelectedCount()).toContainText('1 selected')
    })

    test('can deselect individual blog item', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Deselect Test ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 1, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await expect(crudPage.getSelectedCount()).toContainText('1 selected')

      await crudPage.selectBlogItem(0)
      await expect(crudPage.getSelectedCount()).toContainText('0 selected')
    })

    test('select all selects all blogs', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Select All 1 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Select All 2 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Select All 3 ${Date.now()}`, 'Content')
      const expectedCount = initialCount + 3
      await expect(crudPage.getMyBlogItems()).toHaveCount(expectedCount, { timeout: 5000 })

      await crudPage.selectAllBlogs()
      await expect(crudPage.getSelectedCount()).toContainText(`${expectedCount} selected`)
    })

    test('select all toggles off when all selected', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Toggle All ${Date.now()}`, 'Content')
      const expectedCount = initialCount + 1
      await expect(crudPage.getMyBlogItems()).toHaveCount(expectedCount, { timeout: 5000 })

      await crudPage.selectAllBlogs()
      await expect(crudPage.getSelectedCount()).toContainText(`${expectedCount} selected`)

      await crudPage.selectAllBlogs()
      await expect(crudPage.getSelectedCount()).toContainText('0 selected')
    })

    test('bulk publish enables buttons when items selected', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Enable Buttons ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 1, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await expect(crudPage.getBulkPublish()).toBeEnabled()
      await expect(crudPage.getBulkUnpublish()).toBeEnabled()
      await expect(crudPage.getBulkDelete()).toBeEnabled()
    })
  })

test.describe
  .serial('Blog Bulk Operations - Publish/Unpublish', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
    })

    // eslint-disable-next-line max-statements
    test('bulk publish updates multiple blogs', async ({ crudPage, page }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Bulk Pub 1 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Bulk Pub 2 ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 2, { timeout: 5000 })

      await expect(page.getByTestId('blog-item-status').first()).toContainText('Draft')

      await crudPage.selectBlogItem(0)
      await crudPage.selectBlogItem(1)
      await crudPage.getBulkPublish().click()

      await expect(page.getByText(PUBLISHED_PATTERN)).toBeVisible({ timeout: 5000 })
      await expect(page.getByTestId('blog-item-status').first()).toContainText('Published')
    })

    // eslint-disable-next-line max-statements
    test('bulk unpublish updates multiple blogs', async ({ crudPage, page }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Bulk Unpub 1 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Bulk Unpub 2 ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 2, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await crudPage.selectBlogItem(1)
      await crudPage.getBulkPublish().click()
      await expect(page.getByText(PUBLISHED_PATTERN)).toBeVisible({ timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await crudPage.selectBlogItem(1)
      await crudPage.getBulkUnpublish().click()

      await expect(page.getByText(UNPUBLISHED_PATTERN)).toBeVisible({ timeout: 5000 })
    })

    test('selection clears after bulk operation', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Clear Selection ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 1, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await expect(crudPage.getSelectedCount()).toContainText('1 selected')

      await crudPage.getBulkPublish().click()
      await expect(crudPage.getSelectedCount()).toContainText('0 selected', { timeout: 5000 })
    })
  })

test.describe
  .serial('Blog Bulk Operations - Delete', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
    })

    test('bulk delete removes multiple blogs', async ({ crudPage, page }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Bulk Del 1 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Bulk Del 2 ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 2, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await crudPage.selectBlogItem(1)
      await crudPage.getBulkDelete().click()

      await expect(page.getByText(DELETED_PATTERN)).toBeVisible({ timeout: 5000 })
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount, { timeout: 5000 })
    })

    test('bulk delete single item works', async ({ crudPage, page }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()
      await crudPage.createTestBlog(`Single Delete ${Date.now()}`, 'Content')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 1, { timeout: 5000 })

      await crudPage.selectBlogItem(0)
      await crudPage.getBulkDelete().click()

      await expect(page.getByText(DELETED_PATTERN)).toBeVisible({ timeout: 5000 })
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount, { timeout: 5000 })
    })
  })
