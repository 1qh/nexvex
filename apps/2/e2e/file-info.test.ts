// eslint-disable max-statements
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe
  .serial('File Info API', () => {
    test.beforeEach(async ({ crudPage, page }) => {
      await login(page)
      await crudPage.gotoTest()
    })

    test('file info section is visible', async ({ page }) => {
      await expect(page.getByTestId('file-info-section')).toBeVisible()
      await expect(page.getByTestId('file-storage-id-input')).toBeVisible()
    })

    test('shows empty state initially', async ({ page }) => {
      await expect(page.getByTestId('file-info-empty')).toBeVisible()
    })

    test('input accepts text', async ({ page }) => {
      const input = page.getByTestId('file-storage-id-input')
      await input.fill('test123')
      await expect(input).toHaveValue('test123')
    })

    test('can clear storage id input', async ({ page }) => {
      await page.getByTestId('file-storage-id-input').fill('test123')
      await page.getByTestId('file-storage-id-clear').click()
      await expect(page.getByTestId('file-storage-id-input')).toHaveValue('')
      await expect(page.getByTestId('file-info-empty')).toBeVisible()
    })
  })
