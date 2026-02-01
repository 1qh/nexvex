// biome-ignore-all lint/performance/useTopLevelRegex: x
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('Authentication', () => {
  test('redirects unauthenticated users from chat', async ({ page }) => {
    await page.goto('/chat')
    await expect(page).toHaveURL(/\/login/u)
  })

  test('session persists across page navigation', async ({ page }) => {
    await login(page)
    await page.goto('/chat')
    await expect(page).toHaveURL('/chat')

    await page.goto('/')
    await page.goto('/chat')
    await expect(page).toHaveURL('/chat')
    await expect(page.getByTestId('chat-input')).toBeVisible()
  })

  test('session persists after page reload', async ({ page }) => {
    await login(page)
    await page.goto('/chat')

    await page.reload()
    await expect(page).toHaveURL('/chat')
    await expect(page.getByTestId('chat-input')).toBeVisible()
  })
})
