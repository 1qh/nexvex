// eslint-disable max-statements
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe
  .serial('Message Update API', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/chat/test')
      await page.waitForSelector('[data-testid="chat-test-page"]')
    })

    test('chat test page loads', async ({ page }) => {
      await expect(page.getByTestId('chat-test-page')).toBeVisible()
      await expect(page.getByTestId('create-test-chat')).toBeVisible()
    })

    test('can create test chat and message', async ({ page }) => {
      await page.getByTestId('create-test-chat').click()
      await expect(page.getByTestId('created-chat-id')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('created-message-id')).toBeVisible({ timeout: 10_000 })
    })

    test('messages list shows created message', async ({ page }) => {
      await page.getByTestId('create-test-chat').click()
      await expect(page.getByTestId('created-chat-id')).toBeVisible({ timeout: 10_000 })

      await expect(page.getByTestId('message-item')).toHaveCount(1, { timeout: 10_000 })
      await expect(page.getByTestId('message-text')).toContainText('Original message text')
      await expect(page.getByTestId('message-role')).toContainText('user')
    })

    test('can update message text', async ({ page }) => {
      await page.getByTestId('create-test-chat').click()
      await expect(page.getByTestId('created-message-id')).toBeVisible({ timeout: 10_000 })

      await expect(page.getByTestId('message-text')).toContainText('Original message text')

      await page.getByTestId('message-edit-input').fill('Updated message text')
      await page.getByTestId('message-update-submit').click()

      await expect(page.getByText('Message updated')).toBeVisible({ timeout: 5000 })
      await expect(page.getByTestId('message-text')).toContainText('Updated message text', { timeout: 5000 })
    })

    test('update button disabled without message id', async ({ page }) => {
      await expect(page.getByTestId('message-update-submit')).toBeDisabled()
    })

    test('update button disabled without edit text', async ({ page }) => {
      await page.getByTestId('create-test-chat').click()
      await expect(page.getByTestId('created-message-id')).toBeVisible({ timeout: 10_000 })

      await expect(page.getByTestId('message-update-submit')).toBeDisabled()
    })

    test('can clear message id input', async ({ page }) => {
      await page.getByTestId('create-test-chat').click()
      await expect(page.getByTestId('created-message-id')).toBeVisible({ timeout: 10_000 })

      const messageIdInput = page.getByTestId('message-id-input')
      await expect(messageIdInput).not.toHaveValue('')

      await page.getByTestId('message-id-clear').click()
      await expect(messageIdInput).toHaveValue('')
    })

    test('can click message id from list', async ({ page }) => {
      await page.getByTestId('create-test-chat').click()
      await expect(page.getByTestId('message-item')).toHaveCount(1, { timeout: 10_000 })

      const idButton = page.getByTestId('message-item-id')
      await expect(idButton).toBeVisible()
      await idButton.click()
    })

    test('shows no chat selected message initially', async ({ page }) => {
      await expect(page.getByTestId('no-chat-selected')).toBeVisible()
    })

    test('chat id input accepts text', async ({ page }) => {
      const input = page.getByTestId('chat-id-input')
      await input.fill('test123')
      await expect(input).toHaveValue('test123')
    })
  })
