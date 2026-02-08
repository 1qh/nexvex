/* eslint-disable jest/no-conditional-in-test */
import { expect, test } from './fixtures'
import { login } from './helpers'

const DIGITS_ONLY = /^\d+$/u

test.describe
  .serial('Blog Owner Queries - my, myCount, count', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
    })

    test('count elements are visible', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toBeVisible()
      await expect(crudPage.getTotalCount()).toBeVisible()
      await expect(crudPage.getPublishedCount()).toBeVisible()
    })

    test('myCount increments when creating a blog', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialText = (await crudPage.getMyCount().textContent()) ?? '0'
      const initial = Number.parseInt(initialText, 10)

      await crudPage.createTestBlog(`Owner Test ${Date.now()}`, 'Content')

      await expect(crudPage.getMyCount()).toHaveText(String(initial + 1), { timeout: 10_000 })
    })

    test('totalCount increments when creating a blog', async ({ crudPage }) => {
      await expect(crudPage.getTotalCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialText = (await crudPage.getTotalCount().textContent()) ?? '0'
      const initial = Number.parseInt(initialText, 10)

      await crudPage.createTestBlog(`Total Test ${Date.now()}`, 'Content')

      await expect(crudPage.getTotalCount()).toHaveText(String(initial + 1), { timeout: 10_000 })
    })

    test('publishedCount does not increment for unpublished blogs', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      await expect(crudPage.getPublishedCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const myText = (await crudPage.getMyCount().textContent()) ?? '0'
      const pubText = (await crudPage.getPublishedCount().textContent()) ?? '0'
      const myCount = Number.parseInt(myText, 10)
      const pubCount = Number.parseInt(pubText, 10)

      await crudPage.createTestBlog(`Unpublished Test ${Date.now()}`, 'Content')

      await expect(crudPage.getMyCount()).toHaveText(String(myCount + 1), { timeout: 10_000 })
      await expect(crudPage.getPublishedCount()).toHaveText(String(pubCount))
    })

    test('my query shows user blogs in list', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const initialCount = await crudPage.getMyBlogItems().count()

      await crudPage.createTestBlog(`My Blog 1 ${Date.now()}`, 'Content 1')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 1, { timeout: 5000 })

      await crudPage.createTestBlog(`My Blog 2 ${Date.now()}`, 'Content 2')
      await expect(crudPage.getMyBlogItems()).toHaveCount(initialCount + 2, { timeout: 5000 })
    })

    // eslint-disable-next-line max-statements
    test('counts update correctly after multiple creates', async ({ crudPage }) => {
      await expect(crudPage.getMyCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      await expect(crudPage.getTotalCount()).toHaveText(DIGITS_ONLY, { timeout: 5000 })
      const myText = (await crudPage.getMyCount().textContent()) ?? '0'
      const totalText = (await crudPage.getTotalCount().textContent()) ?? '0'
      const initialMy = Number.parseInt(myText, 10)
      const initialTotal = Number.parseInt(totalText, 10)

      await crudPage.createTestBlog(`Multi 1 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Multi 2 ${Date.now()}`, 'Content')
      await crudPage.createTestBlog(`Multi 3 ${Date.now()}`, 'Content')

      await expect(crudPage.getMyCount()).toHaveText(String(initialMy + 3), { timeout: 10_000 })
      await expect(crudPage.getTotalCount()).toHaveText(String(initialTotal + 3), { timeout: 10_000 })
    })

    test('my list displays blog titles correctly', async ({ crudPage, page }) => {
      const title = `Display Title ${Date.now()}`
      await crudPage.createTestBlog(title, 'Content')

      await expect(page.getByTestId('blog-item-title').first()).toContainText(title)
    })

    test('my list shows draft status for unpublished blogs', async ({ crudPage, page }) => {
      await crudPage.createTestBlog(`Draft Blog ${Date.now()}`, 'Content')

      await expect(page.getByTestId('blog-item-status').first()).toContainText('Draft')
    })
  })
