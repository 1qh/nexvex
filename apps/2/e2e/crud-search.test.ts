import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe
  .serial('Blog Search', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await page.waitForTimeout(500)
      await crudPage.goto('/crud/dynamic')
      await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]')
    })

    test('shows search input on dynamic page', async ({ crudPage }) => {
      await expect(crudPage.getSearchInput()).toBeVisible()
    })

    test('filters blogs by title', async ({ crudPage }) => {
      const uniqueWord = `unique${Date.now()}`
      await crudPage.createBlog(`Blog with ${uniqueWord}`, 'Some content')

      await crudPage.search(uniqueWord)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 10_000 })
      await expect(crudPage.getBlogCards().first()).toContainText(uniqueWord)
    })

    test('filters blogs by content', async ({ crudPage }) => {
      const uniqueContent = `content${Date.now()}`
      await crudPage.createBlog('First post', `This has ${uniqueContent} inside`)

      await crudPage.search(uniqueContent)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 10_000 })
    })

    test('filters blogs by tags', async ({ crudPage }) => {
      const uniqueTag = `tag${Date.now()}`
      const uniqueTitle = `Tagged post ${Date.now()}`
      await crudPage.createBlog(uniqueTitle, 'Content with tag', { tags: [uniqueTag] })

      await crudPage.search(uniqueTag)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 15_000 })
      await expect(crudPage.getBlogCards().first()).toContainText(uniqueTitle)
    })

    test('search shows matching results and clears', async ({ crudPage }) => {
      const uniquePrefix = `searchclear${Date.now()}`
      await crudPage.createBlog(`${uniquePrefix}First`, 'Content one')
      await crudPage.createBlog(`${uniquePrefix}Second`, 'Content two')

      await crudPage.search(`${uniquePrefix}First`)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 10_000 })

      await crudPage.clearSearch()
      await crudPage.search(uniquePrefix)
      await expect(crudPage.getBlogCards()).toHaveCount(2, { timeout: 10_000 })
    })

    test('shows empty state when no results match', async ({ crudPage }) => {
      await crudPage.search('nonexistentterm12345xyz')
      await expect(crudPage.getBlogCards()).toHaveCount(0, { timeout: 5000 })
    })

    test('search is case insensitive', async ({ crudPage }) => {
      const uniqueId = Date.now()
      await crudPage.createBlog(`UPPERCASE${uniqueId} Title`, `lowercase${uniqueId} content`)

      await crudPage.search(`uppercase${uniqueId}`)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 10_000 })

      await crudPage.clearSearch()
      await crudPage.search(`LOWERCASE${uniqueId}`)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 10_000 })
    })

    test('search updates in real-time', async ({ crudPage }) => {
      const uniqueId = Date.now()
      await crudPage.createBlog(`React${uniqueId} tutorial`, 'Learn React basics')
      await crudPage.createBlog(`Vue${uniqueId} tutorial`, 'Learn Vue basics')

      await crudPage.search(`React${uniqueId}`)
      await expect(crudPage.getBlogCards()).toHaveCount(1, { timeout: 10_000 })

      await crudPage.getSearchInput().fill(`${uniqueId}`)
      await expect(crudPage.getBlogCards()).toHaveCount(2, { timeout: 10_000 })
    })
  })
