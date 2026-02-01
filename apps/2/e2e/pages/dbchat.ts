// biome-ignore-all lint/style/useConsistentMemberAccessibility: x
// biome-ignore-all lint/performance/useTopLevelRegex: x
import type { Locator } from '@playwright/test'

import BaseChatPage from './base'

class DbChatPage extends BaseChatPage {
  protected readonly basePath = '/db-chat'
  protected readonly urlPattern = /\/db-chat\/[a-z0-9]+$/i

  public async approveToolCall(): Promise<void> {
    await this.getApproveButton().click()
  }

  public async createNewChat(): Promise<void> {
    await this.page.click('[data-testid="new-chat-button"]')
    await this.page.waitForURL('/db-chat')
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

  public async abortStream(): Promise<void> {
    await this.getStopButton().click()
  }
}

export default DbChatPage
