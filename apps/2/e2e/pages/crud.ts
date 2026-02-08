// biome-ignore-all lint/style/useConsistentMemberAccessibility: x
import type { Locator, Page } from '@playwright/test'

class CrudPage {
  protected readonly page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public getBlogCards(): Locator {
    return this.page.locator('[data-testid="blog-card"]')
  }

  public getBlogList(): Locator {
    return this.page.getByTestId('blog-list')
  }

  public getCreateTrigger(): Locator {
    return this.page.getByTestId('create-blog-trigger').first()
  }

  public getCreateDialog(): Locator {
    return this.page.getByTestId('create-blog-dialog')
  }

  public getCreateSubmit(): Locator {
    return this.page.getByTestId('create-blog-submit')
  }

  public getTitleInput(): Locator {
    return this.page.getByTestId('blog-title').locator('input')
  }

  public getCategorySelect(): Locator {
    return this.page.getByTestId('blog-category').locator('button')
  }

  public getContentTextarea(): Locator {
    return this.page.getByTestId('blog-content').locator('textarea')
  }

  public getTagsInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Tags' })
  }

  public getSearchInput(): Locator {
    return this.page.getByTestId('blog-search-input').first()
  }

  public getEmptyState(): Locator {
    return this.page.getByTestId('empty-state')
  }

  public getDeleteTrigger(): Locator {
    return this.page.getByTestId('delete-blog-trigger').first()
  }

  public getDeleteDialog(): Locator {
    return this.page.getByTestId('delete-dialog')
  }

  public getDeleteConfirm(): Locator {
    return this.page.getByTestId('delete-confirm')
  }

  public getDeleteCancel(): Locator {
    return this.page.getByTestId('delete-cancel')
  }

  public getPaginationExhausted(): Locator {
    return this.page.getByTestId('pagination-exhausted')
  }

  public getLoadMoreTrigger(): Locator {
    return this.page.getByTestId('load-more-trigger')
  }

  public getLoadingMore(): Locator {
    return this.page.getByTestId('loading-more')
  }

  public async goto(path: '/crud/dynamic' | '/crud/pagination' | '/crud/static' = '/crud/dynamic'): Promise<void> {
    await this.page.goto(path)
    await this.page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]')
  }

  // eslint-disable-next-line max-statements
  public async createBlog(
    title: string,
    content: string,
    options?: { category?: string; tags?: string[] }
  ): Promise<void> {
    await this.getCreateTrigger().click()
    await this.getCreateDialog().waitFor({ state: 'visible' })
    await this.getTitleInput().fill(title)
    await this.getContentTextarea().fill(content)
    if (options?.category) {
      await this.getCategorySelect().click()
      await this.page.getByRole('option', { name: options.category }).click()
    }
    if (options?.tags) await this.addTags(options.tags)
    await this.getCreateSubmit().click()
    await this.getCreateDialog().waitFor({ state: 'hidden' })
  }

  public async deleteBlog(): Promise<void> {
    await this.getDeleteTrigger().click()
    await this.getDeleteDialog().waitFor({ state: 'visible' })
    await this.getDeleteConfirm().click()
    await this.getDeleteDialog().waitFor({ state: 'hidden' })
  }

  public async addTags(tags: string[]): Promise<void> {
    const tagsInput = this.getTagsInput()
    await tagsInput.scrollIntoViewIfNeeded()
    await tagsInput.waitFor({ state: 'visible', timeout: 5000 })
    for (const tag of tags) {
      // eslint-disable-next-line no-await-in-loop
      await tagsInput.fill(tag)
      // eslint-disable-next-line no-await-in-loop
      await tagsInput.press('Enter')
    }
  }

  public async search(query: string): Promise<void> {
    await this.getSearchInput().fill(query)
  }

  public async clearSearch(): Promise<void> {
    await this.getSearchInput().clear()
  }

  public getMyCount(): Locator {
    return this.page.getByTestId('my-count')
  }

  public getTotalCount(): Locator {
    return this.page.getByTestId('total-count')
  }

  public getPublishedCount(): Locator {
    return this.page.getByTestId('published-count')
  }

  public getSelectedCount(): Locator {
    return this.page.getByTestId('selected-count')
  }

  public getSelectAll(): Locator {
    return this.page.getByTestId('select-all')
  }

  public getBulkPublish(): Locator {
    return this.page.getByTestId('bulk-publish')
  }

  public getBulkUnpublish(): Locator {
    return this.page.getByTestId('bulk-unpublish')
  }

  public getBulkDelete(): Locator {
    return this.page.getByTestId('bulk-delete')
  }

  public getMyBlogItems(): Locator {
    return this.page.locator('[data-testid="my-blog-item"]')
  }

  public getMyBlogsList(): Locator {
    return this.page.getByTestId('my-blogs-list')
  }

  public getNoBlogs(): Locator {
    return this.page.getByTestId('no-blogs')
  }

  public getTestTitleInput(): Locator {
    return this.page.getByTestId('test-title').locator('input')
  }

  public getTestContentTextarea(): Locator {
    return this.page.getByTestId('test-content').locator('textarea')
  }

  public getTestCategorySelect(): Locator {
    return this.page.getByTestId('test-category').locator('button')
  }

  public getTestCoverImageDropzone(): Locator {
    return this.page.getByTestId('test-cover-image').locator('input[type="file"]')
  }

  public getTestAttachmentsDropzone(): Locator {
    return this.page.getByTestId('test-attachments').locator('input[type="file"]')
  }

  public getTestTagsInput(): Locator {
    return this.page.getByTestId('test-tags').locator('input')
  }

  public getTestSubmit(): Locator {
    return this.page.getByTestId('test-submit')
  }

  public async gotoTest(): Promise<void> {
    await this.page.goto('/crud/test')
    await this.page.waitForSelector('[data-testid="test-submit"]', { state: 'visible' })
  }

  public async createTestBlog(title: string, content: string): Promise<void> {
    await this.getTestTitleInput().fill(title)
    await this.getTestContentTextarea().fill(content)
    await this.getTestSubmit().click()
    await this.page.waitForTimeout(500)
  }

  public async selectBlogItem(index: number): Promise<void> {
    const items = this.getMyBlogItems()
    await items.nth(index).locator('[data-testid^="select-"]').click()
  }

  public async selectAllBlogs(): Promise<void> {
    await this.getSelectAll().click()
  }

  public getCoverImageInput(): Locator {
    return this.page.getByTestId('blog-cover-image').locator('input[type="file"]')
  }

  public getAttachmentsInput(): Locator {
    return this.page.getByTestId('blog-attachments').locator('input[type="file"]')
  }

  public getEditCoverImageDropzone(): Locator {
    return this.page.getByTestId('edit-cover-image').locator('input[type="file"]')
  }

  public getEditAttachmentsDropzone(): Locator {
    return this.page.getByTestId('edit-attachments').locator('input[type="file"]')
  }

  public getEditSave(): Locator {
    return this.page.getByTestId('edit-save')
  }

  public getNavGuardDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: 'unsaved changes' })
  }

  public getNavGuardDiscard(): Locator {
    return this.page.getByRole('button', { name: 'Discard' })
  }

  public getNavGuardCancel(): Locator {
    return this.page.getByRole('button', { name: 'Cancel' })
  }

  public getBlogItemId(index: number): Locator {
    return this.getMyBlogItems().nth(index).locator('[data-testid="blog-item-id"]')
  }

  public async getFirstBlogId(): Promise<string> {
    const idText = await this.getBlogItemId(0).textContent()
    return idText ?? ''
  }

  public getTestPublishAtTrigger(): Locator {
    return this.page.getByTestId('test-publish-at-trigger')
  }

  public getTestPublishAtCalendar(): Locator {
    return this.page.getByTestId('test-publish-at-calendar')
  }

  public getTestPublishAtClear(): Locator {
    return this.page.getByTestId('test-publish-at-clear')
  }

  public getTestPublishAt(): Locator {
    return this.page.getByTestId('test-publish-at')
  }

  public getBlogPublishAtTrigger(): Locator {
    return this.page.getByTestId('blog-publish-at-trigger')
  }

  public getBlogPublishAtCalendar(): Locator {
    return this.page.getByTestId('blog-publish-at-calendar')
  }

  public getBlogPublishAtClear(): Locator {
    return this.page.getByTestId('blog-publish-at-clear')
  }

  public getEditPublishAtTrigger(): Locator {
    return this.page.getByTestId('edit-publish-at-trigger')
  }

  public getEditPublishAtCalendar(): Locator {
    return this.page.getByTestId('edit-publish-at-calendar')
  }

  public getEditPublishAtClear(): Locator {
    return this.page.getByTestId('edit-publish-at-clear')
  }

  public getScheduledBadge(): Locator {
    return this.page.getByTestId('scheduled-badge').first()
  }

  public async selectDate(triggerLocator: Locator, dayNumber: number): Promise<void> {
    await triggerLocator.click()
    await this.page.locator('[role="gridcell"]').getByText(String(dayNumber), { exact: true }).click()
  }
}

export default CrudPage
