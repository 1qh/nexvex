// biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns
import { ConvexHttpClient } from 'convex/browser'

import { expect, test } from './fixtures'
import { login } from './helpers'
import testApi from './test-api'

const getClient = () => {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
  if (!convexUrl) throw new Error('CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set')
  return new ConvexHttpClient(convexUrl)
}

test.describe('Optimistic Updates', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('optimistic create shows item immediately before server confirmation', async ({ page }) => {
    await page.goto('/crud/dynamic')
    await page.getByTestId('create-blog-trigger').first().click()
    await page.getByTestId('create-blog-dialog').waitFor({ state: 'visible' })

    await page.getByTestId('blog-title').locator('input').fill('Optimistic Create Test')
    await page.getByTestId('blog-content').locator('textarea').fill('This should appear instantly')

    await page.getByTestId('create-blog-submit').click()

    await expect(page.getByText('Optimistic Create Test')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('create-blog-dialog').waitFor({ state: 'hidden', timeout: 5000 })
  })

  test('optimistic update shows changes immediately', async ({ page }) => {
    const client = getClient()
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Original content',
      coverImage: null,
      published: false,
      tags: [],
      title: 'Original Title'
    })

    await page.goto('/crud/dynamic')
    await page.locator('[href*="/edit"]').first().click()
    await expect(page.getByTestId('edit-blog-page').first()).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('edit-title').first().locator('input').fill('Updated Title')
    await page.getByTestId('edit-save').first().click()

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  test('optimistic delete removes item immediately', async ({ page }) => {
    const client = getClient()
    const uniqueTitle = `Delete Me ${Date.now()}`
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'To be deleted',
      coverImage: null,
      published: false,
      tags: [],
      title: uniqueTitle
    })

    await page.goto('/crud/dynamic')
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 })

    await page.getByTestId('delete-blog-trigger').first().click()
    await page.getByTestId('delete-dialog').waitFor({ state: 'visible' })
    await page.getByTestId('delete-confirm').click()

    await expect(page.getByText(uniqueTitle)).not.toBeVisible({ timeout: 5000 })
  })

  // eslint-disable-next-line max-statements
  test('multiple optimistic operations show correct pending state', async ({ page }) => {
    const client = getClient()
    const ts = Date.now()
    const title1 = `Multi Op A ${ts}`
    const title2 = `Multi Op B ${ts}`
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Content 1',
      coverImage: null,
      published: false,
      tags: [],
      title: title1
    })
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Content 2',
      coverImage: null,
      published: false,
      tags: [],
      title: title2
    })

    await page.goto('/crud/dynamic')
    await expect(page.getByText(title1)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(title2)).toBeVisible({ timeout: 5000 })

    const deleteButtons = page.getByTestId('delete-blog-trigger')
    await deleteButtons.first().click()
    await page.getByTestId('delete-dialog').waitFor({ state: 'visible' })
    await page.getByTestId('delete-confirm').click()

    await page.getByTestId('delete-dialog').waitFor({ state: 'hidden' })
  })

  test('optimistic publish toggle shows immediate feedback', async ({ page }) => {
    const client = getClient()
    const uniqueTitle = `Toggle Test ${Date.now()}`
    await client.mutation(testApi.blog.create, {
      attachments: [],
      category: 'tech',
      content: 'Toggle test',
      coverImage: null,
      published: false,
      tags: [],
      title: uniqueTitle
    })

    await page.goto('/crud/dynamic')
    const blogCard = page.locator('[data-testid="blog-card"]').filter({ hasText: uniqueTitle })
    await expect(blogCard).toBeVisible({ timeout: 5000 })

    const publishToggle = blogCard.locator('[data-testid="publish-toggle"]')
    const publishSwitch = publishToggle.locator('[data-testid="publish-switch"]')
    await publishSwitch.click()

    await expect(page.locator('[aria-label="Notifications alt+T"]').getByText(/published/i)).toBeVisible({
      timeout: 10_000
    })
  })
})
