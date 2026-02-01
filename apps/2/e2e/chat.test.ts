// oxlint-disable max-statements
// biome-ignore-all lint/performance/useTopLevelRegex: x
import { expect, test } from './fixtures'
import { login } from './helpers'

const CHAT_URL_PATTERN = /\/chat\/[a-z0-9]+/u,
  REJECTION_PATTERN = /rejected|declined/iu

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

test.describe('Tool Approval', () => {
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

  test('buttons are disabled during approval processing', async ({ chatPage }) => {
    await chatPage.sendUserMessage("What's the weather in Berlin?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })

    await chatPage.approveToolCall()
    await expect(chatPage.getApproveButton()).toBeDisabled()
    await expect(chatPage.getDenyButton()).toBeDisabled()
  })
})

test.describe('Multi-turn Conversation', () => {
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
    await page.goto('/chat')
    await page.waitForSelector('[data-testid="chat-input"]', { state: 'visible', timeout: 15_000 })
    await page.goto(chatUrl)
    await page.waitForSelector('[data-testid="chat-input"]', { state: 'visible', timeout: 15_000 })

    const messages = chatPage.getMessages()
    await expect(messages.first()).toBeVisible({ timeout: 20_000 })
    await expect(messages.first()).toContainText('Remember this message')
  })

  test('chat appears in sidebar after creation', async ({ chatPage }) => {
    await chatPage.sendUserMessage('New chat message')
    await chatPage.waitForResponse()

    const threadItems = chatPage.getThreadItems()
    await expect(threadItems.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Sidebar', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('shows thread list with existing chats', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Create a thread')
    await chatPage.waitForResponse()

    const threadList = chatPage.getThreadList()
    await expect(threadList).toBeVisible()

    const threadItems = chatPage.getThreadItems()
    await expect(threadItems).toHaveCount(1, { timeout: 10_000 })
  })

  test('new chat button navigates to /chat', async ({ chatPage, page }) => {
    await chatPage.sendUserMessage('First chat')
    await chatPage.waitForResponse()

    await expect(page).toHaveURL(CHAT_URL_PATTERN)

    const newChatButton = chatPage.getNewChatButton()
    await newChatButton.click()

    await expect(page).toHaveURL('/chat')
  })

  test('can delete a thread', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Thread to delete')
    await chatPage.waitForResponse()

    const threadItems = chatPage.getThreadItems()
    await expect(threadItems).toHaveCount(1, { timeout: 10_000 })

    const deleteButton = chatPage.getDeleteButtons().first()
    await deleteButton.click()

    await expect(threadItems).toHaveCount(0, { timeout: 10_000 })
  })
})

test.describe('Error Handling', () => {
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

  test('handles rapid message submission', async ({ chatPage }) => {
    await chatPage.typeMessage('Rapid test message')

    const sendButton = chatPage.getSendButton()
    await sendButton.click()
    await sendButton.click()
    await sendButton.click()

    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages.first()).toBeVisible({ timeout: 15_000 })
    await expect(chatPage.getInput()).toBeVisible()
  })
})

test.describe('Abort Streaming', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('stop button and abort mutation exist', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Tell me a joke')
    await chatPage.waitForResponse()

    const stopButton = chatPage.getStopButton()
    await expect(stopButton).toHaveCount(0)

    const sendButton = chatPage.getSendButton()
    await expect(sendButton).toBeVisible()
  })

  test('can send multiple messages in sequence', async ({ chatPage }) => {
    await chatPage.sendUserMessage('First message')
    await chatPage.waitForResponse()

    await chatPage.typeMessage('Second message')
    await chatPage.sendMessage()
    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages).toHaveCount(4, { timeout: 15_000 })
  })

  test('messages persist after response completes', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Test persistence')
    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages).toHaveCount(2, { timeout: 15_000 })
    await expect(messages.first()).toContainText('Test persistence')
  })
})

test.describe('Optimistic Updates', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
    await chatPage.sendUserMessage('First message to create thread')
    await chatPage.waitForResponse()
  })

  test('user message appears immediately after sending', async ({ chatPage }) => {
    await chatPage.typeMessage('Hello optimistic test')
    await chatPage.sendMessage()

    const messages = chatPage.getMessages()
    await expect(messages.nth(2)).toBeVisible({ timeout: 500 })
    await expect(messages.nth(2)).toContainText('Hello optimistic test')
  })

  test('message shows pending status initially', async ({ chatPage }) => {
    await chatPage.typeMessage('Pending status test')
    await chatPage.sendMessage()

    const pendingMessage = chatPage.getMessageByStatus('pending')
    await expect(pendingMessage.first()).toBeVisible({ timeout: 1000 })
  })
})

test.describe('Status Styling', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('messages have data-status attribute', async ({ chatPage, page }) => {
    await chatPage.sendUserMessage('Test status attribute')
    await chatPage.waitForResponse()

    const messages = page.locator('[data-testid="message"][data-status]')
    await expect(messages.first()).toBeVisible({ timeout: 15_000 })
  })

  test('completed messages have success status', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Say hello')
    await chatPage.waitForResponse()

    const successMessage = chatPage.getMessageByStatus('success')
    await expect(successMessage.first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Regenerate Response', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  test('regenerate button appears on completed assistant messages', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Tell me a joke')
    await chatPage.waitForResponse()

    await expect(chatPage.getRegenerateButton()).toBeVisible({ timeout: 15_000 })
  })

  test('clicking regenerate triggers new response', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Say hello')
    await chatPage.waitForResponse()

    await expect(chatPage.getMessages()).toHaveCount(2, { timeout: 15_000 })
    await chatPage.regenerateResponse()
    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages).toHaveCount(2, { timeout: 15_000 })
  })

  test('regenerate button only on assistant messages', async ({ chatPage }) => {
    await chatPage.sendUserMessage('Hello there')
    await chatPage.waitForResponse()

    const regenerateButtons = chatPage.getRegenerateButton()
    await expect(regenerateButtons).toHaveCount(1, { timeout: 15_000 })
  })
})

test.describe('Auto-scroll Indicator', () => {
  test.beforeEach(async ({ chatPage, page }) => {
    await login(page)
    await chatPage.goto()
  })

  /** biome-ignore lint/suspicious/noSkippedTests: use-stick-to-bottom library doesn't respond to programmatic scroll in E2E tests */
  test.skip('shows new message indicator when scrolled up', async ({ chatPage, page }) => {
    test.setTimeout(60_000)
    await chatPage.sendUserMessage(
      'Write a very long detailed essay about the history of computing from the 1800s to today. Include many paragraphs with details about Charles Babbage, Ada Lovelace, Alan Turing, ENIAC, IBM, Apple, Microsoft, Google, and modern AI. Make it at least 500 words.'
    )
    await chatPage.waitForResponse()

    const firstMessage = chatPage.getMessages().first()
    await firstMessage.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    await chatPage.typeMessage('Thanks')
    await chatPage.sendMessage()

    const indicator = page.getByTestId('new-message-indicator')
    await expect(indicator).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('ThinkingMessage', () => {
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
