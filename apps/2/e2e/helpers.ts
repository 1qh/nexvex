import type { Page } from '@playwright/test'

const chatUrlPattern = /\/(chat)?$/u,
  generateTestEmail = () => `test-${Date.now()}@playwright.test`,
  login = async (page: Page) => {
    await page.goto('/login/email')
    await page.waitForLoadState('networkidle')
    await page.getByText("Don't have an account? Sign up").click({ timeout: 10_000 })
    await page.fill('[name="email"]', generateTestEmail())
    await page.fill('[name="password"]', 'TestPassword123!')
    await Promise.all([
      page.waitForResponse(r => r.url().includes('auth') && r.status() === 200),
      page.click('button:has-text("Sign up")')
    ])
    await page.waitForURL(chatUrlPattern, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
  }

export { login }
