// biome-ignore-all lint/style/useConsistentMemberAccessibility: x
// biome-ignore-all lint/performance/useTopLevelRegex: x
import type { Locator, Page } from '@playwright/test'

abstract class BaseChatPage {
  protected readonly page: Page
  protected abstract readonly basePath: string
  protected abstract readonly urlPattern: RegExp

  public constructor(page: Page) {
    this.page = page
  }

  public getCurrentUrl(): string {
    return this.page.url()
  }

  public getDeleteButtons(): Locator {
    return this.page.locator('[data-testid="delete-thread-button"]')
  }

  public getEmptyState(): Locator {
    return this.page.getByTestId('empty-state')
  }

  public getInput(): Locator {
    return this.page.getByTestId('chat-input').first()
  }

  public getMessages(): Locator {
    return this.page.locator('[data-testid="message"]')
  }

  public getMessageByStatus(status: string): Locator {
    return this.page.locator(`[data-testid="message"][data-status="${status}"]`)
  }

  public getNewChatButton(): Locator {
    return this.page.getByTestId('new-chat-button')
  }

  public getSendButton(): Locator {
    return this.page.getByTestId('send-button').first()
  }

  public getStopButton(): Locator {
    return this.page.getByTestId('stop-button')
  }

  public getThreadItems(): Locator {
    return this.page.locator('[data-testid="thread-item"]')
  }

  public getThreadList(): Locator {
    return this.page.locator('[data-testid="thread-list"]')
  }

  public async goto(): Promise<void> {
    await this.page.goto(this.basePath)
    await this.waitForInputReady()
  }

  public async sendMessage(): Promise<void> {
    await this.getSendButton().click()
  }

  public async sendUserMessage(message: string): Promise<void> {
    await this.typeMessage(message)
    await this.sendMessage()
    await this.page.waitForURL(this.urlPattern, { timeout: 60_000 })
    await this.waitForInputReady()
  }

  public async typeMessage(message: string): Promise<void> {
    const input = this.getInput()
    await input.waitFor({ state: 'attached' })
    await input.fill(message)
  }

  protected async waitForInputReady(): Promise<void> {
    const input = this.getInput()
    await input.waitFor({ state: 'visible', timeout: 10_000 })
  }

  public async waitForResponse(timeout = 30_000): Promise<void> {
    await this.page.waitForSelector('[data-testid="send-button"]', { timeout })
    await this.page.waitForSelector('[data-testid="message"].is-assistant', { timeout })
  }

  public async waitForStreamingToStart(timeout = 5000): Promise<void> {
    await this.page.waitForSelector('[data-testid="stop-button"]', { timeout })
  }
}

export default BaseChatPage
