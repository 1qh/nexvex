// biome-ignore-all lint/style/useConsistentMemberAccessibility: x
// biome-ignore-all lint/performance/useTopLevelRegex: x
import type { Locator } from '@playwright/test'

import BaseChatPage from './base'

class ChatPage extends BaseChatPage {
  protected readonly basePath = '/chat'
  protected readonly urlPattern = /\/chat\/[a-z0-9]+$/i

  public async approveToolCall(): Promise<void> {
    await this.getApproveButton().click()
  }

  public async createNewChat(): Promise<void> {
    await this.page.click('[data-testid="new-chat-button"]')
    await this.page.waitForURL('/chat')
  }

  public async denyToolCall(): Promise<void> {
    await this.getDenyButton().click()
  }

  public getApproveButton(): Locator {
    return this.page.getByTestId('approve-button')
  }

  public getDenyButton(): Locator {
    return this.page.getByTestId('deny-button')
  }

  public getToolApprovalCard(): Locator {
    return this.page.getByTestId('tool-approval-card')
  }

  public getRegenerateButton(): Locator {
    return this.page.getByTestId('regenerate-button')
  }

  public async abortStream(): Promise<void> {
    await this.getStopButton().click()
  }

  public async regenerateResponse(): Promise<void> {
    await this.getRegenerateButton().first().click()
  }
}

export default ChatPage
