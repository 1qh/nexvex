// biome-ignore-all lint/performance/useTopLevelRegex: x
import { expect, test } from './fixtures'
import { login } from './helpers'

const DURABLE_CHAT_URL_PATTERN = /\/durable-chat\/[a-z0-9]+/iu

test.describe.configure({ mode: 'serial' })

test.describe('Durable Chat Page', () => {
  test.beforeEach(async ({ durableChatPage, page }) => {
    await login(page)
    await durableChatPage.goto()
  })

  test('shows empty state for new chat', async ({ durableChatPage }) => {
    await expect(durableChatPage.getEmptyState()).toBeVisible()
    await expect(durableChatPage.getInput()).toBeAttached()
    await expect(durableChatPage.getSendButton()).toBeAttached()
  })

  test('can type in the input field', async ({ durableChatPage }) => {
    const input = durableChatPage.getInput()
    await input.fill('Hello world')
    await expect(input).toHaveValue('Hello world')
  })

  test('sends message and receives response', async ({ durableChatPage, page }) => {
    test.setTimeout(90_000)
    await durableChatPage.sendUserMessage('Hi')

    await expect(page).toHaveURL(DURABLE_CHAT_URL_PATTERN)
    await expect(durableChatPage.getMessages()).toHaveCount(2, { timeout: 60_000 })
  })

  test('input clears after sending', async ({ durableChatPage }) => {
    test.setTimeout(60_000)
    const input = durableChatPage.getInput()
    await input.fill('Test message')
    await durableChatPage.sendMessage()
    await expect(input).toHaveValue('')
  })
})

test.describe('Durable Chat Status', () => {
  test.beforeEach(async ({ durableChatPage, page }) => {
    await login(page)
    await durableChatPage.goto()
  })

  test('shows status indicator after sending message', async ({ durableChatPage, page }) => {
    test.setTimeout(60_000)
    await durableChatPage.sendUserMessage('Hi')
    await expect(page.locator('text=Generating...')).toBeVisible({ timeout: 10_000 })
  })

  test('status changes to completed after response', async ({ durableChatPage, page }) => {
    test.setTimeout(90_000)
    await durableChatPage.sendUserMessage('Hi')
    await expect(durableChatPage.getMessages()).toHaveCount(2, { timeout: 60_000 })
    await expect(page.locator('.text-green-500:has-text("Completed")')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Durable Chat Multi-turn', () => {
  test.beforeEach(async ({ durableChatPage, page }) => {
    await login(page)
    await durableChatPage.goto()
  })

  test('can send multiple messages in a conversation', async ({ durableChatPage }) => {
    test.setTimeout(120_000)
    await durableChatPage.sendUserMessage('Hi')
    await expect(durableChatPage.getMessages()).toHaveCount(2, { timeout: 45_000 })

    await durableChatPage.typeMessage('Thanks')
    await durableChatPage.sendMessage()
    await expect(durableChatPage.getMessages()).toHaveCount(4, { timeout: 45_000 })
  })
})

test.describe('Durable Chat Persistence', () => {
  test.beforeEach(async ({ durableChatPage, page }) => {
    await login(page)
    await durableChatPage.goto()
  })

  test('chat appears in sidebar after creation', async ({ durableChatPage }) => {
    test.setTimeout(90_000)
    await durableChatPage.sendUserMessage('Hi')
    await expect(durableChatPage.getMessages()).toHaveCount(2, { timeout: 60_000 })
    await expect(durableChatPage.getThreadItems().first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Durable Chat Sidebar', () => {
  test.beforeEach(async ({ durableChatPage, page }) => {
    await login(page)
    await durableChatPage.goto()
  })

  test('shows thread list', async ({ durableChatPage }) => {
    test.setTimeout(90_000)
    await durableChatPage.sendUserMessage('Hi')
    await expect(durableChatPage.getMessages()).toHaveCount(2, { timeout: 60_000 })

    await expect(durableChatPage.getThreadList()).toBeVisible()
    await expect(durableChatPage.getThreadItems().first()).toBeVisible({ timeout: 10_000 })
  })

  test('new chat button navigates to /durable-chat', async ({ durableChatPage, page }) => {
    test.setTimeout(90_000)
    await durableChatPage.sendUserMessage('Hi')
    await expect(durableChatPage.getMessages()).toHaveCount(2, { timeout: 60_000 })

    await expect(page).toHaveURL(DURABLE_CHAT_URL_PATTERN)
    await durableChatPage.getNewChatButton().click()
    await expect(page).toHaveURL('/durable-chat')
  })
})

test.describe('Durable Chat Error Handling', () => {
  test.beforeEach(async ({ durableChatPage, page }) => {
    await login(page)
    await durableChatPage.goto()
  })

  test('handles empty message submission gracefully', async ({ durableChatPage, page }) => {
    await durableChatPage.getSendButton().click()
    await expect(page).toHaveURL('/durable-chat')
    await expect(durableChatPage.getInput()).toBeAttached()
  })
})
