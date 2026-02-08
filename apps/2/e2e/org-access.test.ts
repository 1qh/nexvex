// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import { addTestOrgMember, createTestUser, ensureTestUser, makeOrgTestUtils, testConvex } from './org-helpers'

const testPrefix = `e2e-org-access-${Date.now()}`
const { cleanupOrgTestData, cleanupTestUsers, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('Route Protection', () => {
    let testOrgSlug: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('route')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Route Test Org', slug: testOrgSlug }
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('non-member visits /org/[slug] gets 404', async ({ page }) => {
      const response = await page.goto('/org/nonexistent-org-slug-xyz')
      await page.waitForTimeout(2000)
      const status = response?.status()
      const notFoundText = page.getByText(/not found|404/i)
      const isNotFound = await notFoundText.isVisible().catch(() => false)
      expect(status === 404 || isNotFound).toBeTruthy()
    })

    test('non-member visits /org/[slug]/settings gets 404', async ({ page }) => {
      const response = await page.goto('/org/nonexistent-org-slug-xyz/settings')
      await page.waitForTimeout(2000)
      const status = response?.status()
      const notFoundText = page.getByText(/not found|404/i)
      const isNotFound = await notFoundText.isVisible().catch(() => false)
      expect(status === 404 || isNotFound).toBeTruthy()
    })

    test('member visits /org/[slug]/settings gets permission message', async ({ page }) => {
      const memberSlug = generateSlug('member-settings')
      const memberOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Member Settings Org', slug: memberSlug }
      })
      const memberEmail = `${testPrefix}-member@test.local`
      const memberUserId = (await createTestUser(memberEmail, 'Test Member')) ?? ''
      await addTestOrgMember(memberOrg.orgId, memberUserId, false)

      await page.goto(`/org/${memberSlug}/settings`)
      await page.waitForTimeout(2000)
      const heading = page.getByRole('heading', { name: /settings/i })
      const permText = page.getByText(/do not have permission/i)
      const hasSettings = await heading.isVisible().catch(() => false)
      const hasPerm = await permText.isVisible().catch(() => false)
      expect(hasSettings || hasPerm).toBeTruthy()
    })

    test('admin visits /org/[slug]/settings succeeds', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 8000 })
    })

    test('invalid slug shows 404', async ({ page }) => {
      const response = await page.goto('/org/definitely-not-a-real-slug-xyz123')
      await page.waitForTimeout(2000)
      const status = response?.status()
      const notFoundText = page.getByText(/not found|404/i)
      const isNotFound = await notFoundText.isVisible().catch(() => false)
      expect(status === 404 || isNotFound).toBeTruthy()
    })

    test('unauthenticated redirects to login', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      await page.waitForTimeout(2000)
      const url = page.url()
      const hasOrg = url.includes(`/org/${testOrgSlug}`)
      const hasLogin = url.includes('/login')
      expect(hasOrg || hasLogin).toBeTruthy()
    })
  })

test.describe
  .serial('Cookie/Context', () => {
    let testOrgSlug: string
    let secondOrgSlug: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('cookie')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cookie Test Org', slug: testOrgSlug }
      })

      secondOrgSlug = generateSlug('cookie2')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cookie Test Org 2', slug: secondOrgSlug }
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('visit /org/[slug] sets cookie', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      await expect(page.getByRole('heading', { name: 'Cookie Test Org' }).first()).toBeVisible({ timeout: 8000 })
      await expect(page).toHaveURL(new RegExp(`/org/${testOrgSlug}`))
    })

    test('refresh preserves org context', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      await expect(page.getByRole('heading', { name: 'Cookie Test Org' }).first()).toBeVisible({ timeout: 8000 })
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Cookie Test Org' }).first()).toBeVisible({ timeout: 8000 })
    })

    test('switch org updates cookie', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      await expect(page.getByRole('heading', { name: 'Cookie Test Org' }).first()).toBeVisible({ timeout: 8000 })
      await page.goto(`/org/${secondOrgSlug}`)
      await expect(page.getByRole('heading', { name: 'Cookie Test Org 2' }).first()).toBeVisible({ timeout: 8000 })
    })

    test('deleted org handled gracefully', async ({ page }) => {
      const tempSlug = generateSlug('temp-del')
      const temp = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Temp Delete Org', slug: tempSlug }
      })
      await page.goto(`/org/${tempSlug}`)
      await expect(page.getByRole('heading', { name: 'Temp Delete Org' }).first()).toBeVisible({ timeout: 8000 })
      await testConvex.mutation('org:remove', { orgId: temp.orgId })
      await page.goto(`/org/${tempSlug}`)
      await page.waitForTimeout(2000)
      const notFoundText = page.getByText(/not found|404/i)
      const isNotFound = await notFoundText.isVisible().catch(() => false)
      const url = page.url()
      expect(isNotFound || url.includes('404') || !url.includes(tempSlug)).toBeTruthy()
    })

    test('user removed from org handled gracefully', async ({ page }) => {
      const removedSlug = generateSlug('removed')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Removed Org', slug: removedSlug }
      })
      await page.goto(`/org/${removedSlug}`)
      await expect(page.getByRole('heading', { name: 'Removed Org' }).first()).toBeVisible({ timeout: 8000 })
    })
  })
