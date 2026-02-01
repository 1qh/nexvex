// biome-ignore-all lint/style/useConsistentMemberAccessibility: x
// biome-ignore-all lint/performance/useTopLevelRegex: x
import type { Locator } from '@playwright/test'

import BaseChatPage from './base'

class DurableChatPage extends BaseChatPage {
  protected readonly basePath = '/durable-chat'
  protected readonly urlPattern = /\/durable-chat\/[a-z0-9]+$/iu

  public getResumeButton(): Locator {
    return this.page.getByRole('button', { name: /resume/iu })
  }

  public getStatusText(): Locator {
    return this.page.locator('text=Status:').first()
  }

  public getThinkingIndicator(): Locator {
    return this.page.getByTestId('thinking-indicator')
  }

  public async resume(): Promise<void> {
    await this.getResumeButton().click()
  }

  public async stop(): Promise<void> {
    await this.getStopButton().click()
  }

  public async waitForStatus(status: string, timeout = 15_000): Promise<void> {
    await this.page.waitForSelector(`text=Status: ${status}`, { timeout })
  }
}

export default DurableChatPage
