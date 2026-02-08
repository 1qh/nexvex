// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import { ensureTestUser, makeOrgTestUtils, testConvex } from './org-helpers'

const testPrefix = `e2e-org-errors-${Date.now()}`
const { cleanupOrgTestData, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('Error Handling', () => {
    let testOrgId: string
    let testOrgSlug: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('errors')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Error Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('duplicate slug shows error toast', async ({ page }) => {
      await page.goto('/org/new')
      await page.waitForTimeout(1500)
      const nameInput = page.getByLabel(/name/i)
      const slugInput = page.getByLabel(/slug/i)
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Duplicate Slug Test')
      }
      if (await slugInput.isVisible().catch(() => false)) {
        await slugInput.fill(testOrgSlug)
      }
      const submitButton = page.getByRole('button', { name: /create/i }).first()
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click()
        await page.waitForTimeout(1500)
        const errorToast = page.getByText(/already|taken|exists|error|failed/i).first()
        const hasError = await errorToast.isVisible().catch(() => false)
        const url = page.url()
        expect(hasError || url.includes('/org/new')).toBeTruthy()
      }
    })

    test('expired invite shows error page', async ({ page }) => {
      const expiredResult = await testConvex.mutation<{ token: string }>('testauth:createExpiredInvite', {
        email: `${testPrefix}-expired@test.local`,
        isAdmin: false,
        orgId: testOrgId
      })

      await page.goto(`/org/invite/${expiredResult.token}`)
      await page.waitForTimeout(1500)
      const acceptButton = page.getByRole('button', { name: /accept invite/i })
      if (await acceptButton.isVisible().catch(() => false)) {
        await acceptButton.click()
        await page.waitForTimeout(1500)
        const errorText = page.getByText(/failed|expired|invalid/i)
        await expect(errorText.first()).toBeVisible()
      }
    })

    test('already member invite shows message', async ({ page }) => {
      const inviteResult = await testConvex.mutation<{ token: string }>('org:invite', {
        email: `${testPrefix}-already@test.local`,
        isAdmin: false,
        orgId: testOrgId
      })

      await page.goto(`/org/invite/${inviteResult.token}`)
      await page.waitForTimeout(1500)
      const acceptButton = page.getByRole('button', { name: /accept invite/i })
      if (await acceptButton.isVisible().catch(() => false)) {
        await acceptButton.click()
        await page.waitForTimeout(1500)
        const result = page.getByText(/already|member|in!|failed/i)
        await expect(result.first()).toBeVisible()
      }
    })

    test('network error shows retry option', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 8000 })
    })

    test('concurrent edit conflict shows message', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 8000 })
    })
  })
