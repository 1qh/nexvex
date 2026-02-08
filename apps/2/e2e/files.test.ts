// eslint-disable max-statements
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { login } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url)),
  TEST_IMAGE_PATH = path.join(__dirname, 'fixtures/test-image.png'),
  TEST_PDF_PATH = path.join(__dirname, 'fixtures/test-doc.pdf'),
  UPLOAD_TIMEOUT = 25_000,
  uploadFile = async (page: Page, dropzone: Locator, filePath: string) => {
    const dropzoneButton = dropzone.locator('div.border-dashed').first()
    await expect(dropzoneButton).toBeVisible({ timeout: 10_000 })
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), dropzoneButton.click()])
    await fileChooser.setFiles(filePath)
  }

test.describe
  .serial('File Upload - Cover Image', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
      const createSection = page.getByTestId('create-section')
      await expect(createSection).toBeVisible({ timeout: 10_000 })
      await createSection.scrollIntoViewIfNeeded()
      await expect(page.getByText('Cover Image')).toBeVisible({ timeout: 5000 })
    })

    test('cover image dropzone is visible', async ({ page }) => {
      await expect(page.getByText('Cover Image')).toBeVisible()
      await expect(page.getByText('Click or drag')).toBeVisible()
    })

    test('can upload single cover image', async ({ page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Cover Image' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)

      await expect(dropzone.locator('img')).toBeVisible({ timeout: UPLOAD_TIMEOUT })
    })

    test('can remove uploaded cover image', async ({ page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Cover Image' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img')).toBeVisible({ timeout: UPLOAD_TIMEOUT })

      const removeButton = dropzone.locator('button.bg-destructive')
      await expect(removeButton).toBeVisible({ timeout: 5000 })
      await removeButton.click()
      await expect(dropzone.locator('img')).not.toBeVisible({ timeout: 5000 })
      await expect(dropzone.getByText('Click or drag')).toBeVisible({ timeout: 5000 })
    })

    test('cover image persists after form submission', async ({ crudPage, page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Cover Image' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img')).toBeVisible({ timeout: UPLOAD_TIMEOUT })

      const testTitle = `File Test ${Date.now()}`
      await crudPage.getTestTitleInput().fill(testTitle)
      await crudPage.getTestContentTextarea().fill('Content with image')
      await crudPage.getTestSubmit().click()

      await expect(page.getByText('Created')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(testTitle)).toBeVisible({ timeout: 5000 })
    })
  })

test.describe
  .serial('File Upload - Attachments', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
      const createSection = page.getByTestId('create-section')
      await expect(createSection).toBeVisible({ timeout: 10_000 })
      await createSection.scrollIntoViewIfNeeded()
      await expect(page.getByText('Attachments')).toBeVisible({ timeout: 5000 })
    })

    test('attachments dropzone is visible', async ({ page }) => {
      await expect(page.getByText('Attachments')).toBeVisible()
    })

    test('can upload single attachment', async ({ page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Attachments' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)

      await expect(dropzone.locator('img').first()).toBeVisible({ timeout: UPLOAD_TIMEOUT })
    })

    test('can upload multiple attachments', async ({ page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Attachments' })

      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img').first()).toBeVisible({ timeout: UPLOAD_TIMEOUT })

      await uploadFile(page, dropzone, TEST_PDF_PATH)
      await expect(dropzone.locator('img, div.bg-muted:has(svg)')).toHaveCount(2, { timeout: UPLOAD_TIMEOUT })
    })

    test('can remove individual attachment', async ({ page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Attachments' })

      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img').first()).toBeVisible({ timeout: UPLOAD_TIMEOUT })

      await uploadFile(page, dropzone, TEST_PDF_PATH)
      await expect(dropzone.locator('img, div.bg-muted:has(svg)')).toHaveCount(2, { timeout: UPLOAD_TIMEOUT })

      const removeButton = dropzone.locator('button.bg-destructive').first()
      await expect(removeButton).toBeVisible({ timeout: 5000 })
      await removeButton.click()

      await expect(dropzone.locator('img, div.bg-muted:has(svg)')).toHaveCount(1, { timeout: 10_000 })
    })

    test('attachments persist after form submission', async ({ crudPage, page }) => {
      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Attachments' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img').first()).toBeVisible({ timeout: UPLOAD_TIMEOUT })

      await crudPage.getTestTitleInput().fill(`Attachment Test ${Date.now()}`)
      await crudPage.getTestContentTextarea().fill('Content with attachments')
      await crudPage.getTestSubmit().click()

      await expect(page.getByText('Created')).toBeVisible({ timeout: 5000 })
    })
  })

test.describe
  .serial('File Upload - Edit Page', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.goto('/crud/dynamic')
    })

    test('edit page shows file dropzones', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Edit Files ${Date.now()}`, 'Content')
      await page.locator('[href*="/edit"]').first().click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 15_000 })

      const coverImageField = page.locator('[data-slot="field"]').filter({ hasText: 'Cover Image' })
      await expect(coverImageField).toBeVisible()
      const attachmentsField = page.locator('[data-slot="field"]').filter({ hasText: 'Attachments' })
      await expect(attachmentsField).toBeVisible()
    })

    test('can upload cover image on edit page', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Edit Cover ${Date.now()}`, 'Content')
      await page.locator('[href*="/edit"]').first().click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 15_000 })

      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Cover Image' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img')).toBeVisible({ timeout: UPLOAD_TIMEOUT })
    })

    test('can save edited blog with new files', async ({ crudPage, page }) => {
      await crudPage.createBlog(`Save Files ${Date.now()}`, 'Content')
      await page.locator('[href*="/edit"]').first().click()
      await page.waitForSelector('[data-testid="edit-blog-page"]', { state: 'visible', timeout: 15_000 })

      const dropzone = page.locator('[data-slot="field"]').filter({ hasText: 'Cover Image' })
      await uploadFile(page, dropzone, TEST_IMAGE_PATH)
      await expect(dropzone.locator('img')).toBeVisible({ timeout: UPLOAD_TIMEOUT })
      await crudPage.getEditSave().click()

      await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 })
    })
  })
