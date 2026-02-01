// oxlint-disable max-statements
// biome-ignore-all lint/performance/useTopLevelRegex: x
import { expect, test } from './fixtures'
import { login } from './helpers'

const CHAT_URL_PATTERN = /\/db-chat\/[a-z0-9]+/u,
  REJECTION_PATTERN = /rejected|declined/iu

test.describe('DB Chat Page', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
  })

  test('shows empty state for new chat', async ({ dbChatPage }) => {
    await expect(dbChatPage.getEmptyState()).toBeVisible()
    await expect(dbChatPage.getInput()).toBeVisible()
    await expect(dbChatPage.getSendButton()).toBeVisible()
  })

  test('can type in the input field', async ({ dbChatPage }) => {
    const input = dbChatPage.getInput()
    await input.fill('Hello world')
    await expect(input).toHaveValue('Hello world')
  })

  test('sends message and receives response', async ({ dbChatPage, page }) => {
    await dbChatPage.sendUserMessage('Tell me a joke')

    await expect(page).toHaveURL(CHAT_URL_PATTERN)
    await dbChatPage.waitForResponse()

    const messages = dbChatPage.getMessages()
    await expect(messages).toHaveCount(2, { timeout: 15_000 })
    await expect(messages.last()).toHaveAttribute('class', /is-assistant/u)
  })

  test('input clears after sending', async ({ dbChatPage }) => {
    const input = dbChatPage.getInput()
    await input.fill('Test message')
    await dbChatPage.sendMessage()
    await expect(input).toHaveValue('')
  })

  test('input is re-enabled after response completes', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage('Hello!')
    await dbChatPage.waitForResponse()
    await expect(dbChatPage.getInput()).not.toBeDisabled()
    await expect(dbChatPage.getSendButton()).toBeVisible()
  })
})

test.describe('DB Chat Tool Approval', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
  })

  test('shows approval card when weather tool is called', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage("What's the weather in London?")
    await expect(dbChatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })
    await expect(dbChatPage.getApproveButton()).toBeVisible()
    await expect(dbChatPage.getDenyButton()).toBeVisible()
  })

  test('approving tool call shows weather result', async ({ dbChatPage, page }) => {
    await dbChatPage.sendUserMessage("What's the weather in Paris?")
    await expect(dbChatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })

    await dbChatPage.approveToolCall()
    await expect(page.getByText(/temperature|weather|celsius|°/iu).first()).toBeVisible({ timeout: 30_000 })
    await dbChatPage.waitForResponse()
  })

  test('denying tool call shows rejection message', async ({ dbChatPage, page }) => {
    await dbChatPage.sendUserMessage("What's the weather in Tokyo?")
    await expect(dbChatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })

    await dbChatPage.denyToolCall()
    await expect(page.getByText(REJECTION_PATTERN).first()).toBeVisible({ timeout: 30_000 })
  })

  test('buttons are disabled during approval processing', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage("What's the weather in Berlin?")
    await expect(dbChatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })

    await dbChatPage.approveToolCall()
    await expect(dbChatPage.getApproveButton()).toBeDisabled()
    await expect(dbChatPage.getDenyButton()).toBeDisabled()
  })
})

test.describe('DB Chat Multi-turn Conversation', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
  })

  test('can send multiple messages in a conversation', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage('Tell me a joke')
    await dbChatPage.waitForResponse()

    const messagesAfterFirst = dbChatPage.getMessages()
    await expect(messagesAfterFirst).toHaveCount(2, { timeout: 15_000 })

    await dbChatPage.typeMessage('Tell me another joke')
    await dbChatPage.sendMessage()
    await dbChatPage.waitForResponse()

    const messagesAfterSecond = dbChatPage.getMessages()
    await expect(messagesAfterSecond).toHaveCount(4, { timeout: 15_000 })
  })

  test('messages persist in order', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage('First message')
    await dbChatPage.waitForResponse()

    await dbChatPage.typeMessage('Second message')
    await dbChatPage.sendMessage()
    await dbChatPage.waitForResponse()

    const messages = dbChatPage.getMessages()
    await expect(messages).toHaveCount(4, { timeout: 15_000 })
    await expect(messages.nth(0)).toContainText('First message')
    await expect(messages.nth(2)).toContainText('Second message')
  })
})

test.describe('DB Chat Persistence', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
  })

  test('can return to existing chat via URL', async ({ dbChatPage, page }) => {
    test.setTimeout(60_000)
    await dbChatPage.sendUserMessage('Remember this message')
    await dbChatPage.waitForResponse()

    const chatUrl = dbChatPage.getCurrentUrl()
    await page.goto('/db-chat')
    await page.waitForSelector('[data-testid="chat-input"]', { state: 'visible', timeout: 15_000 })
    await page.goto(chatUrl)
    await page.waitForSelector('[data-testid="chat-input"]', { state: 'visible', timeout: 15_000 })

    const messages = dbChatPage.getMessages()
    await expect(messages.first()).toBeVisible({ timeout: 20_000 })
    await expect(messages.first()).toContainText('Remember this message')
  })

  test('chat appears in sidebar after creation', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage('New chat message')
    await dbChatPage.waitForResponse()

    const threadItems = dbChatPage.getThreadItems()
    await expect(threadItems.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('DB Chat Sidebar', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
  })

  test('shows thread list with existing chats', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage('Create a thread')
    await dbChatPage.waitForResponse()

    const threadList = dbChatPage.getThreadList()
    await expect(threadList).toBeVisible()

    const threadItems = dbChatPage.getThreadItems()
    await expect(threadItems).toHaveCount(1, { timeout: 10_000 })
  })

  test('new chat button navigates to /db-chat', async ({ dbChatPage, page }) => {
    await dbChatPage.sendUserMessage('First chat')
    await dbChatPage.waitForResponse()

    await expect(page).toHaveURL(CHAT_URL_PATTERN)

    const newChatButton = dbChatPage.getNewChatButton()
    await newChatButton.click()

    await expect(page).toHaveURL('/db-chat')
  })

  test('can delete a thread', async ({ dbChatPage }) => {
    await dbChatPage.sendUserMessage('Thread to delete')
    await dbChatPage.waitForResponse()

    const threadItems = dbChatPage.getThreadItems()
    await expect(threadItems).toHaveCount(1, { timeout: 10_000 })

    const deleteButton = dbChatPage.getDeleteButtons().first()
    await deleteButton.click()

    await expect(threadItems).toHaveCount(0, { timeout: 10_000 })
  })
})

test.describe('DB Chat Error Handling', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
  })

  test('handles empty message submission gracefully', async ({ dbChatPage, page }) => {
    await dbChatPage.getSendButton().click()

    await expect(page).toHaveURL('/db-chat')
    await expect(dbChatPage.getInput()).toBeVisible()
  })

  test('handles rapid message submission', async ({ dbChatPage }) => {
    await dbChatPage.typeMessage('Rapid test message')

    const sendButton = dbChatPage.getSendButton()
    await sendButton.click()
    await sendButton.click()
    await sendButton.click()

    await dbChatPage.waitForResponse()

    const messages = dbChatPage.getMessages()
    await expect(messages.first()).toBeVisible({ timeout: 15_000 })
    await expect(dbChatPage.getInput()).toBeVisible()
  })
})

test.describe('DB Chat ThinkingMessage', () => {
  test.beforeEach(async ({ dbChatPage, page }) => {
    await login(page)
    await dbChatPage.goto()
    await dbChatPage.sendUserMessage('Hello')
    await dbChatPage.waitForResponse()
  })

  test('shows thinking indicator during streaming', async ({ dbChatPage, page }) => {
    await dbChatPage.typeMessage('Tell me a story')
    await dbChatPage.sendMessage()
    const thinkingIndicator = page.getByTestId('thinking-indicator')
    await expect(thinkingIndicator).toBeAttached({ timeout: 2000 })
  })
})
