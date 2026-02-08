// biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns
import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { login } from './helpers'

const waitForPage = async (page: Page, path: string) => {
  await page.goto(path)
  await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"], [data-testid="chat-form"]', {
    timeout: 15_000
  })
}

test.describe('Offline Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('offline indicator appears when browser goes offline', async ({ page, context }) => {
    await waitForPage(page, '/crud/static')

    await context.setOffline(true)

    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)
  })

  test('offline indicator disappears when browser comes back online', async ({ page, context }) => {
    await waitForPage(page, '/crud/static')

    await context.setOffline(true)
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)
    await expect(page.getByText('You are offline')).not.toBeVisible({ timeout: 5000 })
  })

  test('offline indicator is not shown when online', async ({ page }) => {
    await waitForPage(page, '/crud/static')

    await expect(page.getByText('You are offline')).not.toBeVisible()
  })

  test('offline indicator persists during page interactions', async ({ page, context }) => {
    await waitForPage(page, '/crud/static')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    await context.setOffline(true)
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('create-blog-trigger').first().click()
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)
  })

  test('offline indicator appears in chat page', async ({ page, context }) => {
    await waitForPage(page, '/chat')

    await context.setOffline(true)
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    await context.setOffline(false)
  })

  test('offline indicator has correct styling and position', async ({ page, context }) => {
    await waitForPage(page, '/crud/static')

    await context.setOffline(true)
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 })

    const indicator = page.getByText('You are offline')
    await expect(indicator).toHaveClass(/fixed/)
    await expect(indicator).toHaveClass(/bottom-4/)
    await expect(indicator).toHaveClass(/left-4/)
    await expect(indicator).toHaveClass(/z-50/)

    await context.setOffline(false)
  })
})
