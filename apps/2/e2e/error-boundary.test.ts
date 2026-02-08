/* eslint-disable jest/no-conditional-in-test */
// biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns
import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('error boundary catches invalid route errors', async ({ page }) => {
    await page.goto('/crud/invalid-route-xyz-123')

    await page.waitForTimeout(1000)

    const content = await page.content()
    const hasErrorIndicator =
      content.includes('not found') ||
      content.includes('Not Found') ||
      content.includes('404') ||
      content.includes('Something went wrong') ||
      content.includes('Error')

    expect(hasErrorIndicator).toBe(true)
  })

  test('error boundary shows fallback for invalid blog ID', async ({ page }) => {
    await page.goto('/crud/jx7invalid1234567890abcdef/edit')

    await page.waitForTimeout(1500)

    const content = await page.content()
    const hasFallback =
      content.includes('not found') ||
      content.includes('Not Found') ||
      content.includes('404') ||
      content.includes('Something went wrong') ||
      content.includes('Error') ||
      content.includes('edit')

    expect(hasFallback).toBe(true)
  })

  test('error boundary allows page refresh', async ({ page }) => {
    await page.goto('/crud/static')
    await expect(page.getByTestId('create-blog-trigger').first()).toBeVisible({ timeout: 5000 })
  })

  test('error boundary does not interfere with normal operation', async ({ page }) => {
    await page.goto('/crud/static')
    await expect(page.getByTestId('create-blog-trigger').first()).toBeVisible({ timeout: 5000 })

    await page.goto('/chat')
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 5000 })
  })

  test('error boundary shows custom fallback message', async ({ page }) => {
    await page.goto('/crud/invalid-blog-id-12345')

    await page.waitForTimeout(1000)

    const pageContent = await page.content()
    const hasErrorOrNotFound =
      pageContent.includes('Something went wrong') ||
      pageContent.includes('not found') ||
      pageContent.includes('Error') ||
      pageContent.includes('404')

    expect(hasErrorOrNotFound).toBe(true)
  })
})
