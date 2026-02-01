import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('Network Mocking', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('can mock weather API response', async ({ page, chatPage }) => {
    await page.route('**/api.open-meteo.com/**', route => {
      route.fulfill({
        body: JSON.stringify({
          current: {
            temperature_2m: 25,
            weather_code: 0
          }
        }),
        contentType: 'application/json',
        status: 200
      })
    })

    await chatPage.goto()
    await chatPage.sendUserMessage("What's the weather in TestCity?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })
    await chatPage.approveToolCall()
    await chatPage.waitForResponse()

    const messages = chatPage.getMessages()
    await expect(messages.last()).toBeVisible()
  })

  test('handles API timeout gracefully', async ({ page, chatPage }) => {
    await page.route('**/api.open-meteo.com/**', async route => {
      await new Promise<void>(resolve => {
        setTimeout(resolve, 5000)
      })
      route.abort('timedout')
    })

    await chatPage.goto()
    await chatPage.sendUserMessage("What's the weather in SlowCity?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })
    await chatPage.approveToolCall()

    await expect(chatPage.getInput()).toBeVisible({ timeout: 60_000 })
  })

  test('handles API error response', async ({ page, chatPage }) => {
    await page.route('**/api.open-meteo.com/**', route => {
      route.fulfill({
        body: JSON.stringify({ error: 'Service unavailable' }),
        contentType: 'application/json',
        status: 503
      })
    })

    await chatPage.goto()
    await chatPage.sendUserMessage("What's the weather in ErrorCity?")
    await expect(chatPage.getToolApprovalCard()).toBeVisible({ timeout: 15_000 })
    await chatPage.approveToolCall()

    await expect(chatPage.getInput()).toBeVisible({ timeout: 60_000 })
  })
})
