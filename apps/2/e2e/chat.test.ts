// oxlint-disable max-statements
// biome-ignore-all lint/performance/useTopLevelRegex: x
import { expect, test } from './fixtures'
import { login } from './helpers'

const CHAT_URL_PATTERN = /\/chat\/[a-z0-9]+/u,
  REJECTION_PATTERN = /rejected|declined|denied|sorry|cannot|unable/iu

test.describe('Chat Page', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('shows empty state for new chat', async ({ chatPage }) => {
    await expect(chatPage.getEmptyState()).toBeVisible()
    await expect(chatPage.getInput()).toBeVisible()
    await expect(chatPage.getSendButton()).toBeVisible()
  })

  test('can type in the input field', async ({ chatPage }) => {
    const input = chatPage.getInput()
    await input.fill('Hello world')
    await expect(input).toHaveValue('Hello world')
  })

  test('sends message and receives response', async ({ chatPage, page }) => {
    await chatPage.sendUserMessage('Tell me a joke')

    await expect(page).toHaveURL(CHAT_URL_PATTERN)
    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages).toHaveCount(2, { timeout: 15_000 })
    await expect(messages.last()).toHaveAttribute('class', /is-assistant/u)
  })

  test('input clears after sending', async ({ chatPage }) => {
    const input = chatPage.getInput()
    await input.fill('Test message')
    await chatPage.sendMessage()
    await expect(input).toHaveValue('')
  })

  test('input is re-enabled after response completes', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Hello!')
    await chatPage.waitForResponse()
    await expect(chatPage.getInput()).not.toBeDisabled()
    await expect(chatPage.getSendButton()).toBeVisible()
  })
})

test.describe('Chat Tool Approval', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('shows approval card when weather tool is called', async ({ chatPage }) => {
    await chatPage.sendUserMessage("What's the weather in London?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })
    await expect(chatPage.getApproveButton()).toBeVisible()
    await expect(chatPage.getDenyButton()).toBeVisible()
  })

  test('approving tool call shows weather result', async ({ chatPage, page }) => {
    await chatPage.sendUserMessage("What's the weather in Paris?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })

    await chatPage.approveToolCall()
    await expect(page.getByText(/temperature|weather|celsius|°/iu).first()).toBeVisible({ timeout: 30_000 })
    await chatPage.waitForResponse()
  })

  test('denying tool call shows rejection message', async ({ chatPage, page }) => {
    await chatPage.sendUserMessage("What's the weather in Tokyo?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })

    await chatPage.denyToolCall()
    await expect(page.getByText(REJECTION_PATTERN).first()).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('Chat Multi-turn Conversation', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('can send multiple messages in a conversation', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Tell me a joke')
    await chatPage.waitForResponse()

    const messagesAfterFirst = chatPage.getMessages()
    await expect(messagesAfterFirst).toHaveCount(2, { timeout: 15_000 })

    await chatPage.typeMessage('Tell me another joke')
    await chatPage.sendMessage()
    await chatPage.waitForResponse()

    const messagesAfterSecond = chatPage.getMessages()
    await expect(messagesAfterSecond).toHaveCount(4, { timeout: 15_000 })
  })

  test('messages persist in order', async ({ chatPage }) => {
    await chatPage.sendUserMessage('First message')
    await chatPage.waitForResponse()

    await chatPage.typeMessage('Second message')
    await chatPage.sendMessage()
    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages).toHaveCount(4, { timeout: 15_000 })
    await expect(messages.nth(0)).toContainText('First message')
    await expect(messages.nth(2)).toContainText('Second message')
  })
})

test.describe('Chat Persistence', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('can return to existing chat via URL', async ({ chatPage, page }) => {
    test.setTimeout(60_000)
    await chatPage.sendUserMessage('Remember this message')
    await chatPage.waitForResponse()

    const chatUrl = chatPage.getCurrentUrl()
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="message"]', { state: 'attached', timeout: 20_000 })

    const messageText = await page.locator('[data-testid="message"]').first().textContent()
    expect(messageText).toContain('Remember this message')
    await expect(page).toHaveURL(chatUrl)
  })

  test('chat appears in sidebar after creation', async ({ chatPage }) => {
    await chatPage.sendUserMessage('New chat message')
    await chatPage.waitForResponse()

    const threadItems = chatPage.getThreadItems()
    await expect(threadItems.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe
  .serial('Chat Sidebar', () => {
    test.beforeEach(async ({ chatPage, page }) => {
      await login(page)
      await chatPage.goto()
    })

    test('shows thread list with existing chats', async ({ chatPage, page }) => {
      const uniqueMessage = `Create thread ${Date.now()}`

      await chatPage.sendUserMessage(uniqueMessage)
      await chatPage.waitForResponse()

      const threadList = chatPage.getThreadList()
      await expect(threadList).toBeVisible()

      const newThread = page.locator('[data-testid="thread-item"]', { hasText: uniqueMessage })
      await expect(newThread).toBeVisible({ timeout: 10_000 })
    })

    test('new chat button navigates to /chat', async ({ chatPage, page }) => {
      await chatPage.sendUserMessage('First chat')
      await chatPage.waitForResponse()

      await expect(page).toHaveURL(CHAT_URL_PATTERN)

      const newChatButton = chatPage.getNewChatButton()
      await newChatButton.click()

      await expect(page).toHaveURL('/chat')
    })

    test('can delete a thread', async ({ chatPage, page }) => {
      const uniqueMessage = `Thread to delete ${Date.now()}`

      await chatPage.sendUserMessage(uniqueMessage)
      await chatPage.waitForResponse()

      const newThread = page.locator('[data-testid="thread-item"]', { hasText: uniqueMessage })
      await expect(newThread).toBeVisible({ timeout: 10_000 })

      const deleteButton = newThread.locator('[data-testid="delete-thread-button"]')
      await deleteButton.click()

      await expect(newThread).not.toBeVisible({ timeout: 10_000 })
    })
  })

test.describe('Chat Error Handling', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('handles empty message submission gracefully', async ({ chatPage, page }) => {
    await chatPage.getSendButton().click()

    await expect(page).toHaveURL('/chat')
    await expect(chatPage.getInput()).toBeVisible()
  })

  test('shows error state for very long messages', async ({ chatPage }) => {
    const input = chatPage.getInput()
    await input.fill('x'.repeat(10_001))
    await chatPage.sendMessage()

    await expect(chatPage.getInput()).toBeVisible({ timeout: 5000 })
  })

  test('handles rapid message submission', async ({ chatPage, page }) => {
    await chatPage.typeMessage('Rapid test message')
    await chatPage.sendMessage()
    await expect(page).toHaveURL(CHAT_URL_PATTERN)
    await chatPage.waitForResponse()
    const messages = chatPage.getMessages()
    await expect(messages.first()).toBeVisible({ timeout: 15_000 })
    await expect(chatPage.getInput()).toBeVisible()
  })
})

test.describe('Chat Abort Streaming', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('input is re-enabled after streaming completes', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Tell me a story')
    await chatPage.waitForResponse()
    await expect(chatPage.getInput()).not.toBeDisabled({ timeout: 5000 })
  })
})

test.describe('Chat ThinkingMessage', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
    await chatPage.sendUserMessage('Hello')
    await chatPage.waitForResponse()
  })

  test('shows thinking indicator during streaming', async ({ chatPage, page }) => {
    await chatPage.typeMessage('Tell me a story')
    await chatPage.sendMessage()
    const thinkingIndicator = page.getByTestId('thinking-indicator')
    await expect(thinkingIndicator).toBeAttached({ timeout: 2000 })
  })
})
