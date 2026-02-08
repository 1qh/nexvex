// eslint-disable max-statements
import { expect, test } from './fixtures'
import { login } from './helpers'

const CRUD_DYNAMIC_RE = /\/crud\/dynamic/

test.describe
  .serial('Form Navigation Guard - Dirty Form Warning', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('no warning when navigating from clean form', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Clean Form ${Date.now()}`, 'Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      await page.goBack()
      await expect(crudPage.getNavGuardDialog()).not.toBeVisible()
      await expect(page).toHaveURL(CRUD_DYNAMIC_RE)
    })

    test('form can be edited', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Edit Form ${Date.now()}`, 'Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      const titleInput = page.getByRole('textbox', { name: 'Title' })
      await titleInput.waitFor({ state: 'visible' })
      await titleInput.fill('Changed Title')

      await expect(titleInput).toHaveValue('Changed Title')
    })

    test('can edit form title', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Continue Edit ${Date.now()}`, 'Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      const changedTitle = 'Changed For Continue'
      const titleInput = page.getByRole('textbox', { name: 'Title' })
      await titleInput.waitFor({ state: 'visible' })
      await titleInput.fill(changedTitle)

      await expect(titleInput).toHaveValue(changedTitle)
    })

    test('edit page loads with existing title', async ({ crudPage, page }) => {
      const originalTitle = `Discard Changes ${Date.now()}`
      await crudPage.createBlog(originalTitle, 'Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      const titleInput = page.getByRole('textbox', { name: 'Title' })
      await titleInput.waitFor({ state: 'visible' })
      await expect(titleInput).toHaveValue(originalTitle, { timeout: 5000 })
    })

    test('save button works', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Saved Form ${Date.now()}`, 'Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()

      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })
      const titleInput = page.getByRole('textbox', { name: 'Title' })
      await titleInput.waitFor({ state: 'visible' })
      const newTitle = `Saved Title ${Date.now()}`
      await titleInput.fill(newTitle)
      const saveBtn = crudPage.getEditSave()
      await saveBtn.waitFor({ state: 'visible' })
      await saveBtn.click()
      await page.waitForTimeout(2000)

      await expect(titleInput).toHaveValue(newTitle)
    })

    test('content textarea can be edited', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Content Change ${Date.now()}`, 'Original Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      const contentTextarea = page.getByRole('textbox', { name: 'Content' })
      await contentTextarea.waitFor({ state: 'visible' })
      await contentTextarea.fill('Modified Content')

      await expect(contentTextarea).toHaveValue('Modified Content')
    })
  })

test.describe
  .serial('Form State Persistence', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('edit form preserves original values', async ({ crudPage, page }) => {
      const title = `Original Title ${Date.now()}`
      const content = 'Original content text'
      await crudPage.createBlog(title, content)
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(title, { timeout: 10_000 })
      await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue(content, { timeout: 5000 })
    })

    test('form resets after successful save', async ({ crudPage, page }) => {
      const originalTitle = `Reset Test ${Date.now()}`
      await crudPage.createBlog(originalTitle, 'Content')
      const editLink = page.locator('[href*="/edit"]').first()
      await editLink.waitFor({ state: 'visible' })
      await editLink.click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 10_000 })

      const newTitle = `Updated Title ${Date.now()}`
      const titleInput = page.getByRole('textbox', { name: 'Title' })
      await titleInput.waitFor({ state: 'visible' })
      await titleInput.fill(newTitle)
      const saveBtn = crudPage.getEditSave()
      await saveBtn.waitFor({ state: 'visible' })
      await saveBtn.click()
      await expect(page.locator('[aria-label="Notifications alt+T"]').getByText('Saved')).toBeVisible({ timeout: 10_000 })

      await expect(titleInput).toHaveValue(newTitle)
    })
  })
