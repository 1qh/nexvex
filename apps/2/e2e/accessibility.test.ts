import { AxeBuilder } from '@axe-core/playwright'

import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('Accessibility', () => {
  test('login page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/login/email')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('chat page has no critical accessibility violations', async ({ page }) => {
    await login(page)
    await page.goto('/chat')
    await page.waitForSelector('[data-testid="chat-input"]')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('chat input is keyboard accessible', async ({ page }) => {
    await login(page)
    await page.goto('/chat')

    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
  })
})
