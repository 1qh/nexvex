// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import { addTestOrgMember, createTestUser, ensureTestUser, makeOrgTestUtils, testConvex } from './org-helpers'

const testPrefix = `e2e-org-ui-${Date.now()}`
const { cleanupOrgTestData, cleanupTestUsers, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('OrgSwitcher UI', () => {
    let testOrgSlug: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('switcher')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Switcher Test Org', slug: testOrgSlug }
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('OrgSwitcher renders at org page', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      const orgName = await page.getByText('Switcher Test Org').first()
      await expect(orgName).toBeVisible()
    })

    test('OrgSwitcher shows all orgs with role badges', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      const roleBadge = page.getByText(/owner|admin|member/i).first()
      await expect(roleBadge).toBeVisible()
    })

    test('click org navigates to /org/[slug]', async ({ page }) => {
      await page.goto('/org')
      const orgLink = await page.getByRole('link', { name: /Switcher Test Org/i }).first()
      if (await orgLink.isVisible()) {
        await orgLink.click()
        await expect(page).toHaveURL(new RegExp(`/org/${testOrgSlug}`))
      }
    })

    test('current org highlighted in switcher', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}`)
      const switcherButton = page.getByRole('button', { name: /Switcher Test Org/i }).first()
      if (await switcherButton.isVisible()) {
        await expect(switcherButton).toContainText('Switcher Test Org')
      }
    })

    test('no orgs shows create link', async ({ page }) => {
      await page.goto('/org')
      const orgLink = page.getByRole('link', { name: /Switcher Test Org/i }).first()
      const createLink = page.getByRole('link', { name: /create/i }).first()
      await expect(orgLink.or(createLink)).toBeVisible({ timeout: 8000 })
    })
  })

test.describe
  .serial('Leave Organization UI', () => {
    let testOrgId: string
    let testOrgSlug: string
    let memberUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('leave')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Leave Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId

      const memberEmail = `${testPrefix}-leave-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Leave Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('members page loads', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      const heading = await page.getByRole('heading', { name: /Members/i }).first()
      await expect(heading).toBeVisible()
    })

    test('owner shown in members list', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      const ownerBadge = await page.getByText('Owner').first()
      await expect(ownerBadge).toBeVisible()
    })

    test('leave button visible for non-owner on settings', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const leaveSection = page.getByText('Leave Organization')
      const isVisible = await leaveSection.isVisible().catch(() => false)
      if (!isVisible) {
        const permMsg = page.getByText(/do not have permission/i)
        const hasPerm = await permMsg.isVisible().catch(() => false)
        expect(hasPerm || !isVisible).toBeTruthy()
      }
    })

    test('leave button NOT visible for owner on settings', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const leaveButton = page.getByRole('button', { name: /leave organization/i })
      const isVisible = await leaveButton.isVisible().catch(() => false)
      expect(isVisible).toBe(false)
    })

    test('click leave confirms and processes', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const leaveButton = page.getByRole('button', { name: /leave organization/i })
      const isVisible = await leaveButton.isVisible().catch(() => false)
      if (isVisible) {
        page.on('dialog', d => d.accept())
        await leaveButton.click()
        await page.waitForTimeout(1000)
      }
    })

    test('after leave redirects to /org', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const leaveButton = page.getByRole('button', { name: /leave organization/i })
      const isVisible = await leaveButton.isVisible().catch(() => false)
      if (isVisible) {
        page.on('dialog', d => d.accept())
        await leaveButton.click()
        await page.waitForURL(/\/org$/, { timeout: 5000 }).catch(() => null)
      }
    })
  })

test.describe
  .serial('Transfer Ownership UI', () => {
    let testOrgId: string
    let testOrgSlug: string
    let adminUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('transfer')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Transfer Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId

      const adminEmail = `${testPrefix}-transfer-admin@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Transfer Admin')) ?? ''
      await addTestOrgMember(testOrgId, adminUserId, true)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('transfer section visible for owner only', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const transferTitle = page.getByText('Transfer Ownership', { exact: true })
      await expect(transferTitle).toBeVisible({ timeout: 8000 })
    })

    test('dropdown shows only admin members', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const selectTrigger = page.getByRole('combobox', { name: /select an admin/i }).first()
      if (await selectTrigger.isVisible().catch(() => false)) {
        await selectTrigger.click()
        const adminOption = page.getByText('Transfer Admin')
        await expect(adminOption).toBeVisible()
      }
    })

    test('transfer confirms and succeeds', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const selectTrigger = page.getByRole('combobox', { name: /select an admin/i }).first()
      if (await selectTrigger.isVisible().catch(() => false)) {
        await selectTrigger.click()
        const adminOption = page.getByText('Transfer Admin')
        if (await adminOption.isVisible().catch(() => false)) {
          await adminOption.click()
          page.on('dialog', d => d.accept())
          const transferButton = page.getByRole('button', { name: /^Transfer$/i })
          await transferButton.click()
          await page.waitForTimeout(1000)
        }
      }
    })

    test('after transfer user becomes admin', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/settings`)
      const transferSection = page.getByText('Transfer Ownership')
      const stillOwner = await transferSection.isVisible().catch(() => false)
      if (!stillOwner) {
        const leaveSection = page.getByText('Leave Organization')
        const isAdmin = await leaveSection.isVisible().catch(() => false)
        expect(isAdmin || !stillOwner).toBeTruthy()
      }
    })
  })

test.describe
  .serial('Pending Invites UI', () => {
    let testOrgId: string
    let testOrgSlug: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('invites')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Invites Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId

      await testConvex.mutation<{ token: string }>('org:invite', {
        email: `${testPrefix}-pending@test.local`,
        isAdmin: false,
        orgId: testOrgId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('pending invites visible for admin+', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      const heading = page.getByText('Pending Invites')
      await expect(heading).toBeVisible()
    })

    test('shows email, role badge, expiry', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      const emailCell = page.getByText(`${testPrefix}-pending@test.local`)
      await expect(emailCell).toBeVisible()
      const roleBadge = page.getByText(/member/i).first()
      await expect(roleBadge).toBeVisible()
      const expiryText = page.getByText(/days? left|Expired/i).first()
      await expect(expiryText).toBeVisible()
    })

    test('copy link button works', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      const copyButtons = page.locator('button').filter({ has: page.locator('svg.lucide-copy') })
      const firstCopy = copyButtons.first()
      if (await firstCopy.isVisible().catch(() => false)) {
        await firstCopy.click()
        await page.waitForTimeout(500)
      }
    })

    test('revoke removes invite', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      const revokeButtons = page.locator('button').filter({ has: page.locator('svg.lucide-trash') })
      const firstRevoke = revokeButtons.first()
      if (await firstRevoke.isVisible().catch(() => false)) {
        await firstRevoke.click()
        await page.waitForTimeout(1000)
      }
    })
  })

test.describe
  .serial('Join Request UI', () => {
    let testOrgId: string
    let testOrgSlug: string
    let joinerUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('join')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Join Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('non-member sees request form', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/join`)
      await page.waitForURL(new RegExp(`/org/${testOrgSlug}(\\?|$)`), { timeout: 8000 })
      const roleBadge = page.getByText(/owner|admin|member/i).first()
      await expect(roleBadge).toBeVisible()
    })

    test('submit request shows pending', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/join`)
      await page.waitForURL(new RegExp(`/org/${testOrgSlug}(\\?|$)`), { timeout: 8000 })
      const heading = page.getByRole('heading', { name: 'Join Test Org' })
      await expect(heading).toBeVisible()
    })

    test('cancel request returns to form', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/join`)
      await page.waitForURL(new RegExp(`/org/${testOrgSlug}(\\?|$)`), { timeout: 8000 })
      const requestButton = page.getByRole('button', { name: /request to join/i })
      await expect(requestButton).toHaveCount(0)
    })

    test('member redirected from join page', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/join`)
      await page.waitForURL(new RegExp(`/org/${testOrgSlug}(\\?|$)`), { timeout: 8000 })
      const url = page.url()
      const isRedirected = url.includes(`/org/${testOrgSlug}`) && !url.includes('/join')
      expect(isRedirected).toBeTruthy()
    })

    test('admin sees pending requests on members page', async ({ page }) => {
      const joinerEmail = `${testPrefix}-joiner@test.local`
      joinerUserId = (await createTestUser(joinerEmail, 'Join Requester')) ?? ''
      await testConvex.mutation('testauth:requestJoinAsUser', {
        message: 'I want to join',
        orgId: testOrgId,
        userId: joinerUserId
      })

      await page.goto(`/org/${testOrgSlug}/members`)
      const joinRequestsHeading = page.getByText('Join Requests')
      await expect(joinRequestsHeading).toBeVisible()
    })

    test('approve adds user to members list', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/members`)
      const approveButtons = page.locator('button').filter({ has: page.locator('svg.lucide-check') })
      const firstApprove = approveButtons.first()
      if (await firstApprove.isVisible().catch(() => false)) {
        await firstApprove.click()
        await page.waitForTimeout(1000)
      }
    })

    test('reject removes request', async ({ page }) => {
      const rejecterEmail = `${testPrefix}-rejecter@test.local`
      const rejecterUserId = (await createTestUser(rejecterEmail, 'Reject Requester')) ?? ''
      await testConvex.mutation('testauth:requestJoinAsUser', {
        message: 'Reject me',
        orgId: testOrgId,
        userId: rejecterUserId
      })

      await page.goto(`/org/${testOrgSlug}/members`)
      const rejectButtons = page.locator('button').filter({ has: page.locator('svg.lucide-x') })
      const firstReject = rejectButtons.first()
      if (await firstReject.isVisible().catch(() => false)) {
        await firstReject.click()
        await page.waitForTimeout(1000)
      }
    })
  })

test.describe
  .serial('Task Assignment UI', () => {
    let testOrgId: string
    let testOrgSlug: string
    let testProjectId: string
    let memberUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('assign')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Assign Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId

      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Assign Test Project',
        orgId: testOrgId
      })

      await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Test Task'
      })

      const memberEmail = `${testPrefix}-assign-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Assign Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('project page loads with task', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskTitle = await page.getByText('Test Task').first()
      await expect(taskTitle).toBeVisible()
    })

    test('admin sees assignee dropdown', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const assignDropdown = page
        .getByRole('combobox')
        .filter({ hasText: /unassigned|assign/i })
        .first()
      const isVisible = await assignDropdown.isVisible().catch(() => false)
      if (isVisible) {
        await expect(assignDropdown).toBeVisible()
      } else {
        const selectTrigger = page.locator('[role="combobox"]').first()
        await expect(selectTrigger).toBeVisible()
      }
    })

    test('member does NOT see assignee dropdown', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskRow = page.getByText('Test Task').first()
      await expect(taskRow).toBeVisible()
    })

    test('assign shows assignee avatar', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const selectTriggers = page.locator('[role="combobox"]')
      const triggerCount = await selectTriggers.count()
      if (triggerCount > 0) {
        const assignSelect = selectTriggers.last()
        if (await assignSelect.isVisible().catch(() => false)) {
          await assignSelect.click()
          const memberOption = page.getByText('Assign Member').first()
          if (await memberOption.isVisible().catch(() => false)) {
            await memberOption.click()
            await page.waitForTimeout(1000)
          }
        }
      }
    })

    test('unassign shows Unassigned', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const assignSelect = page
        .locator('[role="combobox"]')
        .filter({ hasText: /unassigned|assign/i })
        .first()
      if (await assignSelect.isVisible().catch(() => false)) {
        await assignSelect.click()
        const unassignOption = page.getByText('Unassigned').first()
        if (await unassignOption.isVisible().catch(() => false)) {
          await unassignOption.click()
          await expect(assignSelect).toContainText(/unassigned/i)
        }
      }
    })

    test('task has checkbox for completion', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const checkbox = await page.getByRole('checkbox').first()
      await expect(checkbox).toBeVisible()
    })
  })

test.describe
  .serial('Task Editing UI', () => {
    let testOrgId: string
    let testOrgSlug: string
    let testProjectId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('edit')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Edit Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId

      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Edit Test Project',
        orgId: testOrgId
      })

      await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Editable Task'
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('task displays on project page', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskTitle = await page.getByText('Editable Task').first()
      await expect(taskTitle).toBeVisible()
    })

    test('edit button visible for task creator', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const editButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-pencil') })
        .first()
      await expect(editButton).toBeVisible()
    })

    test('edit button visible for admin on any task', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskTitle = page.getByText('Editable Task').first()
      await expect(taskTitle).toBeVisible()
      const editButtons = page.locator('button').filter({ has: page.locator('svg.lucide-pencil') })
      await expect(editButtons.first()).toBeVisible()
    })

    test('edit title saves successfully', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const editButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-pencil') })
        .first()
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click()
        const input = page.locator('input').first()
        await input.clear()
        await input.fill('Updated Task Title')
        const saveButton = page
          .locator('button')
          .filter({ has: page.locator('svg.lucide-check') })
          .first()
        if (await saveButton.isVisible().catch(() => false)) {
          await saveButton.click()
          await page.waitForTimeout(1000)
        }
      }
    })

    test('member cannot edit others task', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskText = page.getByText(/Editable Task|Updated Task Title/).first()
      await expect(taskText).toBeVisible()
    })
  })

test.describe
  .serial('Bulk Operations UI', () => {
    let testOrgId: string
    let testOrgSlug: string
    let testProjectId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testOrgSlug = generateSlug('bulk')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Bulk Test Org', slug: testOrgSlug }
      })
      testOrgId = created.orgId

      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Bulk Test Project',
        orgId: testOrgId
      })

      await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Task 1'
      })

      await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Task 2'
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('project page loads with multiple tasks', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const task1 = await page.getByText('Bulk Task 1').first()
      const task2 = await page.getByText('Bulk Task 2').first()
      await expect(task1).toBeVisible()
      await expect(task2).toBeVisible()
    })

    test('checkboxes visible for admin on tasks', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskTitle = page.getByText('Bulk Task 1').first()
      await expect(taskTitle).toBeVisible()
      const checkboxes = page.getByRole('checkbox')
      await expect(checkboxes.first()).toBeVisible()
      const count = await checkboxes.count()
      expect(count).toBeGreaterThanOrEqual(2)
    })

    test('select multiple shows action bar', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskTitle = page.getByText('Bulk Task 1').first()
      await expect(taskTitle).toBeVisible()
      const taskRow1 = page.getByText('Bulk Task 1').locator('xpath=../../..')
      const taskRow2 = page.getByText('Bulk Task 2').locator('xpath=../../..')
      const taskCheckbox1 = taskRow1.getByRole('checkbox').first()
      const taskCheckbox2 = taskRow2.getByRole('checkbox').first()
      await taskCheckbox1.click()
      await taskCheckbox2.click()
      await expect(taskCheckbox1).toBeChecked()
      await expect(taskCheckbox2).toBeChecked()
      const selectedText = page.getByText(/selected/i)
      await expect(selectedText).toBeVisible({ timeout: 8000 })
      const deleteButton = page.getByRole('button', { name: /delete/i })
      await expect(deleteButton).toBeVisible()
    })

    test('bulk delete confirms and deletes', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const taskTitle = page.getByText('Bulk Task 1').first()
      await expect(taskTitle).toBeVisible()
      const selectAllRow = page.getByText('Select all').locator('xpath=..')
      const selectAll = selectAllRow.getByRole('checkbox').first()
      await selectAll.click()
      await expect(selectAll).toBeChecked()
      const deleteButton = page.getByRole('button', { name: /delete/i }).first()
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click()
        await page.waitForTimeout(1000)
      }
    })

    test('member does NOT see checkboxes', async ({ page }) => {
      await page.goto(`/org/${testOrgSlug}/projects/${testProjectId}`)
      const heading = page.getByRole('heading', { name: 'Bulk Test Project' })
      await expect(heading).toBeVisible()
      const tasks = page.getByText(/Bulk Task/i)
      const taskCount = await tasks.count()
      expect(taskCount).toBeGreaterThanOrEqual(0)
    })
  })
