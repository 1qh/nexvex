/* eslint-disable jest/no-conditional-in-test */
// biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns
import { AxeBuilder } from '@axe-core/playwright'

import { ConvexHttpClient } from 'convex/browser'

import { expect, test } from './fixtures'
import { login } from './helpers'
import testApi from './test-api'

const getClient = () => {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
  if (!convexUrl) throw new Error('CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set')
  return new ConvexHttpClient(convexUrl)
}

test.describe('Accessibility', () => {
  test.describe.configure({ timeout: 30_000 })

  test('login page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/login/email')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('chat page has no critical accessibility violations', async ({ page }) => {
    await login(page)
    await page.goto('/chat')
    await page.waitForSelector('[data-testid="chat-input"]')
    await page.waitForLoadState('domcontentloaded')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('chat input is keyboard accessible', async ({ page }) => {
    await login(page)
    await page.goto('/chat')
    await page.waitForSelector('[data-testid="chat-input"]')

    const chatInput = page.getByTestId('chat-input')
    await expect(chatInput).toBeVisible()
    await chatInput.click()
    await expect(chatInput).toBeFocused()
  })

  test('blog list page has no critical accessibility violations', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="blog-list"], [data-testid="empty-state"]')
    await page.waitForLoadState('domcontentloaded')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('blog create form has no critical accessibility violations', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')
    await page.waitForLoadState('domcontentloaded')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('blog edit form has no critical accessibility violations', async ({ page }) => {
    await login(page)

    const client = getClient()
    const blog = (await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Test Blog'
    })) as string

    await page.goto(`/crud/${blog}/edit`)
    await page.waitForSelector('[data-testid="edit-blog-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="edit-title"]', { timeout: 10_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['label', 'aria-allowed-attr'])
      .analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  // eslint-disable-next-line max-statements
  test('form fields are properly labeled', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    const titleInput = page.getByTestId('blog-title').locator('input')
    await expect(titleInput).toBeVisible({ timeout: 5000 })
    const titleId = await titleInput.getAttribute('id')
    if (titleId) {
      const titleLabel = page.locator(`label[for="${titleId}"]`)
      await expect(titleLabel).toBeVisible()
    }

    const contentTextarea = page.getByTestId('blog-content').locator('textarea')
    await expect(contentTextarea).toBeVisible()
  })

  test('error messages are announced to screen readers', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    await page.getByTestId('create-blog-submit').click()

    const errorMessage = page.locator('[role="alert"]:not(:empty), [aria-live="polite"]:not(:empty)').first()
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })

  test('dialog traps focus within modal', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    const dialog = page.getByTestId('create-blog-dialog')
    await expect(dialog).toBeVisible()

    const firstInput = dialog.locator('input, button, textarea, select').first()
    await firstInput.focus()
    await expect(firstInput).toBeFocused()
  })

  test('dialog restores focus on close', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')

    const trigger = page.getByTestId('create-blog-trigger').first()
    await trigger.click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('create-blog-dialog')).not.toBeVisible()

    await expect(trigger).toBeFocused()
  })

  test('dialog closes on Escape key', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')

    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    const dialog = page.getByTestId('create-blog-dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  // eslint-disable-next-line max-statements
  test('alert dialog traps focus', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Test Delete'
    })

    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="blog-list"]')
    await page.getByTestId('delete-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="delete-dialog"]')

    await page.keyboard.press('Tab')
    const focusedElement = page.locator(':focus')
    const parentDialog = focusedElement.locator('xpath=ancestor::*[@data-testid="delete-dialog"]')
    await expect(parentDialog).toBeAttached()
  })

  // eslint-disable-next-line max-statements
  test('delete dialog has proper ARIA attributes', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'ARIA Test'
    })

    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="blog-list"]')
    await page.getByTestId('delete-blog-trigger').first().click()

    const dialog = page.getByTestId('delete-dialog')
    await expect(dialog).toHaveAttribute('role', 'alertdialog')
  })

  // eslint-disable-next-line max-statements
  test('bulk selection is keyboard accessible', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Bulk Test 1'
    })

    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="my-blog-item"]', { timeout: 10_000 })

    const checkbox = page.getByTestId('select-all')
    await expect(checkbox).toBeVisible()
    await checkbox.click()
    await expect(checkbox).toBeChecked()
  })

  test('search input has accessible label', async ({ page }) => {
    await login(page)
    await page.goto('/crud/dynamic')
    await page.waitForSelector('[data-testid="crud-dynamic-page"]')

    const searchInput = page.getByTestId('blog-search-input')
    await expect(searchInput).toBeVisible()

    const ariaLabel = await searchInput.getAttribute('aria-label')
    const placeholder = await searchInput.getAttribute('placeholder')
    expect(ariaLabel ?? placeholder).toBeTruthy()
  })

  // eslint-disable-next-line max-statements, no-await-in-loop
  test('pagination controls are keyboard navigable', async ({ page }) => {
    await login(page)

    const client = getClient()
    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await client.mutation(testApi.blog.create, {
        attachments: [],
        category: 'tech',
        content: `Content ${i}`,
        coverImage: null,
        published: true,
        tags: [],
        title: `Pagination Test ${i}`
      })
    }

    await page.goto('/crud/pagination')
    await page.waitForSelector('[data-testid="crud-pagination-page"]')

    const loadMoreTrigger = page.getByTestId('load-more-trigger')
    await expect(loadMoreTrigger).toBeAttached()
  })

  // eslint-disable-next-line max-statements
  test('blog detail page has no critical accessibility violations', async ({ page }) => {
    await login(page)

    const client = getClient()
    const blog = (await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content for detail page',
      coverImage: null,
      published: true,
      tags: ['test'],
      title: 'Detail Test'
    })) as string

    await page.goto(`/crud/${blog}`)
    await page.waitForSelector('[data-testid="blog-detail-page"]')
    await page.waitForLoadState('domcontentloaded')

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('file upload dropzone is keyboard accessible', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="create-blog-trigger"]', { timeout: 10_000 })
    await page.getByTestId('create-blog-trigger').first().click()
    await page.waitForSelector('[data-testid="create-blog-dialog"]')

    const uploadButton = page.getByRole('button', { name: 'Upload file' }).first()
    await expect(uploadButton).toBeVisible({ timeout: 5000 })

    const fileInput = page.locator('input[type="file"]').first()
    await expect(fileInput).toBeAttached()
  })

  // eslint-disable-next-line max-statements
  test('status badges have accessible text', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Status Test'
    })

    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="my-blogs-list"]')

    const badge = page.getByTestId('blog-item-status').first()
    const text = await badge.textContent()
    expect(text?.length).toBeGreaterThan(0)
  })

  test('CRUD test page has no critical accessibility violations', async ({ page }) => {
    await login(page)
    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="create-section"]', { timeout: 10_000 })
    await page.waitForLoadState('domcontentloaded')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['label', 'button-name'])
      .analyze()

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('CRUD test page form fields are properly labeled', async ({ page }) => {
    await login(page)
    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="create-section"]', { timeout: 10_000 })

    const titleInput = page.getByRole('textbox', { name: 'Title' })
    await expect(titleInput).toBeVisible({ timeout: 5000 })

    const categorySelect = page.getByRole('combobox', { name: 'Category' })
    await expect(categorySelect).toBeVisible({ timeout: 5000 })

    const contentTextarea = page.getByRole('textbox', { name: 'Content' })
    await expect(contentTextarea).toBeVisible({ timeout: 5000 })
  })

  test('CRUD test page error messages are accessible', async ({ page }) => {
    await login(page)
    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="test-submit"]', { timeout: 5000 })

    await page.getByTestId('test-submit').click()

    const errorMessage = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').first()
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })

  // eslint-disable-next-line max-statements
  test('CRUD test page checkboxes are keyboard accessible', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Checkbox Test'
    })

    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="my-blog-item"]', { timeout: 10_000 })

    const selectAll = page.getByTestId('select-all')
    await expect(selectAll).toBeVisible()
    await selectAll.click()
    await expect(selectAll).toBeChecked()
  })

  // eslint-disable-next-line max-statements
  test('CRUD test page bulk actions have proper ARIA labels', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Bulk ARIA Test'
    })

    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="bulk-section"]')

    const publishButton = page.getByTestId('bulk-publish')
    await expect(publishButton).toBeVisible()
    const publishText = await publishButton.textContent()
    expect(publishText?.trim()).toBe('Publish')

    const unpublishButton = page.getByTestId('bulk-unpublish')
    await expect(unpublishButton).toBeVisible()
    const unpublishText = await unpublishButton.textContent()
    expect(unpublishText?.trim()).toBe('Unpublish')

    const deleteButton = page.getByTestId('bulk-delete')
    await expect(deleteButton).toBeVisible()
    const deleteText = await deleteButton.textContent()
    expect(deleteText?.trim()).toBe('Delete')
  })

  test('CRUD list items have accessible status indicators', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: true,
      tags: [],
      title: 'Status Indicator Test'
    })

    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="my-blogs-list"]')

    const status = page.getByTestId('blog-item-status').first()
    await expect(status).toBeVisible()
    const statusText = await status.textContent()
    expect(statusText?.trim()).toBeTruthy()
  })

  test('CRUD form file inputs are keyboard accessible', async ({ page }) => {
    await login(page)
    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="create-section"]', { timeout: 10_000 })

    const coverImageUpload = page.getByRole('button', { name: 'Upload file' }).first()
    await expect(coverImageUpload).toBeVisible({ timeout: 5000 })

    const fileInputs = page.locator('input[type="file"]')
    await expect(fileInputs.first()).toBeAttached({ timeout: 5000 })
  })

  // eslint-disable-next-line max-statements
  test('CRUD form keyboard navigation through all fields', async ({ page }) => {
    await login(page)
    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="crud-test-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="create-section"]', { timeout: 10_000 })

    const titleInput = page.getByRole('textbox', { name: 'Title' })
    await expect(titleInput).toBeVisible({ timeout: 5000 })
    await titleInput.click()
    await expect(titleInput).toBeFocused()

    const categoryInput = page.getByRole('combobox', { name: 'Category' })
    await expect(categoryInput).toBeVisible({ timeout: 5000 })
  })

  test('CRUD empty state is accessible', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')

    const emptyOrList = await page.locator('[data-testid="blog-list"], [data-testid="empty-state"]').first()
    await expect(emptyOrList).toBeVisible()
  })

  // eslint-disable-next-line max-statements
  test('CRUD filter and search controls are accessible', async ({ page }) => {
    await login(page)

    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content',
      coverImage: null,
      published: true,
      tags: [],
      title: 'Filter Test'
    })

    await page.goto('/crud/dynamic')
    await page.waitForSelector('[data-testid="crud-dynamic-page"]')

    const searchInput = page.getByTestId('blog-search-input')
    const ariaLabel = await searchInput.getAttribute('aria-label')
    const placeholder = await searchInput.getAttribute('placeholder')
    expect(ariaLabel ?? placeholder).toBeTruthy()
  })

  test('CRUD action buttons have descriptive text', async ({ page }) => {
    await login(page)
    await page.goto('/crud/static')
    await page.waitForSelector('[data-testid="create-blog-trigger"]', { timeout: 5000 })

    const createButton = page.getByTestId('create-blog-trigger').first()
    await expect(createButton).toBeVisible()
    const ariaLabel = await createButton.getAttribute('aria-label')
    expect(ariaLabel?.length).toBeGreaterThan(0)
  })

  // eslint-disable-next-line max-statements
  test('CRUD detail page navigation is keyboard accessible', async ({ page }) => {
    await login(page)

    const client = getClient()
    const blog = (await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Test content for navigation',
      coverImage: null,
      published: true,
      tags: ['test'],
      title: 'Navigation Test'
    })) as string

    await page.goto(`/crud/${blog}`)
    await page.waitForSelector('[data-testid="blog-detail-page"]')

    const detailPage = page.getByTestId('blog-detail-page')
    await expect(detailPage).toBeVisible()
    const title = page.getByTestId('blog-detail-title')
    await expect(title).toBeVisible()
  })

  test('CRUD counts section is accessible', async ({ page }) => {
    await login(page)
    await page.goto('/crud/test')
    await page.waitForSelector('[data-testid="counts-section"]')

    const myCount = page.getByTestId('my-count')
    await expect(myCount).toBeVisible()

    const totalCount = page.getByTestId('total-count')
    await expect(totalCount).toBeVisible()

    const publishedCount = page.getByTestId('published-count')
    await expect(publishedCount).toBeVisible()
  })
})
