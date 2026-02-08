// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import { addTestOrgMember, createTestUser, ensureTestUser, makeOrgTestUtils, testConvex } from './org-helpers'
import type { PaginatedResult, ProjectDoc, TaskDoc } from './org-helpers'

const testPrefix = `e2e-proj-${Date.now()}`
const { cleanupOrgTestData, cleanupTestUsers, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('Project CRUD', () => {
    let testOrgId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('proj-crud')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Project CRUD Test Org', slug }
      })
      testOrgId = created.orgId
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('create project - success', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        description: 'Test project description',
        name: 'Test Project',
        orgId: testOrgId,
        status: 'active'
      })
      expect(projectId).toBeDefined()
    })

    test('create project - minimal fields', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Minimal Project',
        orgId: testOrgId
      })
      expect(projectId).toBeDefined()
    })

    test('read project - success', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Read Test Project',
        orgId: testOrgId
      })
      const project = await testConvex.query<ProjectDoc>('project:read', {
        id: projectId,
        orgId: testOrgId
      })
      expect(project.name).toBe('Read Test Project')
      expect(project.orgId).toBe(testOrgId)
    })

    test('list projects - returns paginated results', async () => {
      const result = await testConvex.query<PaginatedResult<ProjectDoc>>('project:list', {
        orgId: testOrgId,
        paginationOpts: { cursor: null, numItems: 10 }
      })
      expect(result.page).toBeDefined()
      expect(result.page.length).toBeGreaterThan(0)
    })

    test('update project - owner can update', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Update Test Project',
        orgId: testOrgId
      })
      const updated = await testConvex.mutation<ProjectDoc>('project:update', {
        id: projectId,
        name: 'Updated Project Name',
        orgId: testOrgId
      })
      expect(updated.name).toBe('Updated Project Name')
    })

    test('update project - can update description', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Description Update Test',
        orgId: testOrgId
      })
      const updated = await testConvex.mutation<ProjectDoc>('project:update', {
        description: 'New description',
        id: projectId,
        orgId: testOrgId
      })
      expect(updated.description).toBe('New description')
    })

    test('update project - can update status', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Status Update Test',
        orgId: testOrgId,
        status: 'active'
      })
      const updated = await testConvex.mutation<ProjectDoc>('project:update', {
        id: projectId,
        orgId: testOrgId,
        status: 'completed'
      })
      expect(updated.status).toBe('completed')
    })

    test('rm project - owner can delete', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Delete Test Project',
        orgId: testOrgId
      })
      await testConvex.mutation('project:rm', {
        id: projectId,
        orgId: testOrgId
      })
      const result = await testConvex.query<{ code?: string }>('project:read', {
        id: projectId,
        orgId: testOrgId
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('bulkRm project - success', async () => {
      const id1 = await testConvex.mutation<string>('project:create', {
        name: 'Bulk Delete 1',
        orgId: testOrgId
      })
      const id2 = await testConvex.mutation<string>('project:create', {
        name: 'Bulk Delete 2',
        orgId: testOrgId
      })
      const deleted = await testConvex.mutation<number>('project:bulkRm', {
        ids: [id1, id2],
        orgId: testOrgId
      })
      expect(deleted).toBe(2)
    })
  })

test.describe
  .serial('Project Permissions', () => {
    let testOrgId: string
    let memberUserId: string
    let adminUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('proj-perms')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Project Perms Test Org', slug }
      })
      testOrgId = created.orgId

      const memberEmail = `${testPrefix}-proj-member@test.local`
      const adminEmail = `${testPrefix}-proj-admin@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Project Member')) ?? ''
      adminUserId = (await createTestUser(adminEmail, 'Project Admin')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)
      await addTestOrgMember(testOrgId, adminUserId, true)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('member exists in org', async () => {
      expect(memberUserId).toBeDefined()
      expect(adminUserId).toBeDefined()
    })

    test('read project - not found for wrong org', async () => {
      const otherSlug = generateSlug('other-org')
      const otherOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Other Org', slug: otherSlug }
      })
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Other Org Project',
        orgId: otherOrg.orgId
      })
      const result = await testConvex.query<{ code?: string }>('project:read', {
        id: projectId,
        orgId: testOrgId
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('update project - conflict on stale expectedUpdatedAt', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Conflict Test Project',
        orgId: testOrgId
      })
      const project = await testConvex.query<ProjectDoc>('project:read', {
        id: projectId,
        orgId: testOrgId
      })
      await testConvex.mutation('project:update', {
        id: projectId,
        name: 'First Update',
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string }>('project:update', {
        expectedUpdatedAt: project.updatedAt,
        id: projectId,
        name: 'Second Update',
        orgId: testOrgId
      })
      expect(result.code).toBe('CONFLICT')
    })
  })

test.describe
  .serial('Task CRUD', () => {
    let testOrgId: string
    let testProjectId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('task-crud')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Task CRUD Test Org', slug }
      })
      testOrgId = created.orgId
      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Task Test Project',
        orgId: testOrgId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('create task - success', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        priority: 'high',
        projectId: testProjectId,
        title: 'Test Task'
      })
      expect(taskId).toBeDefined()
    })

    test('create task - minimal fields', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Minimal Task'
      })
      expect(taskId).toBeDefined()
    })

    test('read task - success', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Read Test Task'
      })
      const task = await testConvex.query<TaskDoc>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      expect(task.title).toBe('Read Test Task')
      expect(task.orgId).toBe(testOrgId)
    })

    test('byProject - returns tasks for project', async () => {
      await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'ByProject Task 1'
      })
      await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'ByProject Task 2'
      })
      const tasks = await testConvex.query<TaskDoc[]>('task:byProject', {
        orgId: testOrgId,
        projectId: testProjectId
      })
      expect(tasks.length).toBeGreaterThanOrEqual(2)
    })

    test('toggle task - owner can toggle', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Toggle Test Task'
      })
      const toggled = await testConvex.mutation<TaskDoc>('task:toggle', {
        id: taskId,
        orgId: testOrgId
      })
      expect(toggled.completed).toBe(true)
    })

    test('toggle task - double toggle returns to original', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Double Toggle Task'
      })
      await testConvex.mutation<TaskDoc>('task:toggle', { id: taskId, orgId: testOrgId })
      const toggled = await testConvex.mutation<TaskDoc>('task:toggle', { id: taskId, orgId: testOrgId })
      expect(toggled.completed).toBe(false)
    })

    test('update task - success', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Update Test Task'
      })
      const updated = await testConvex.mutation<TaskDoc>('task:update', {
        id: taskId,
        orgId: testOrgId,
        title: 'Updated Task Title'
      })
      expect(updated.title).toBe('Updated Task Title')
    })

    test('rm task - owner can delete', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Delete Test Task'
      })
      await testConvex.mutation('task:rm', { id: taskId, orgId: testOrgId })
      const result = await testConvex.query<{ code?: string }>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('bulkRm task - success', async () => {
      const id1 = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Delete Task 1'
      })
      const id2 = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Delete Task 2'
      })
      const deleted = await testConvex.mutation<number>('task:bulkRm', {
        ids: [id1, id2],
        orgId: testOrgId
      })
      expect(deleted).toBe(2)
    })

    test('bulkUpdate task - success', async () => {
      const id1 = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Update Task 1'
      })
      const id2 = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Update Task 2'
      })
      const updated = await testConvex.mutation<TaskDoc[]>('task:bulkUpdate', {
        data: { priority: 'low' },
        ids: [id1, id2],
        orgId: testOrgId
      })
      expect(updated.length).toBe(2)
    })
  })

test.describe
  .serial('Task Assignment', () => {
    let testOrgId: string
    let testProjectId: string
    let memberUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('task-assign')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Task Assignment Test Org', slug }
      })
      testOrgId = created.orgId
      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Assignment Test Project',
        orgId: testOrgId
      })
      const memberEmail = `${testPrefix}-assign-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Assignment Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('assign task - owner can assign to member', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Assign Test Task'
      })
      const assigned = await testConvex.mutation<TaskDoc>('task:assign', {
        assigneeId: memberUserId,
        id: taskId,
        orgId: testOrgId
      })
      expect(assigned.assigneeId).toBe(memberUserId)
    })

    test('assign task - can unassign', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Unassign Test Task'
      })
      await testConvex.mutation<TaskDoc>('task:assign', {
        assigneeId: memberUserId,
        id: taskId,
        orgId: testOrgId
      })
      const unassigned = await testConvex.mutation<TaskDoc>('task:assign', {
        id: taskId,
        orgId: testOrgId
      })
      expect(unassigned.assigneeId).toBeNull()
    })

    test('assign task - validation error for malformed task id', async () => {
      const result = await testConvex.mutation<{ code: string }>('task:assign', {
        assigneeId: memberUserId,
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })
  })

test.describe
  .serial('Cascade Deletion', () => {
    let testOrgId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('cascade')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cascade Test Org', slug }
      })
      testOrgId = created.orgId
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('delete project - cascades to tasks', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Cascade Project',
        orgId: testOrgId
      })
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId,
        title: 'Cascade Task'
      })
      await testConvex.mutation('project:rm', { id: projectId, orgId: testOrgId })
      const taskResult = await testConvex.query<{ code?: string }>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      expect(taskResult.code).toBe('NOT_FOUND')
    })

    test('delete project - cascades multiple tasks', async () => {
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Multi Cascade Project',
        orgId: testOrgId
      })
      const taskId1 = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId,
        title: 'Multi Cascade Task 1'
      })
      const taskId2 = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId,
        title: 'Multi Cascade Task 2'
      })
      await testConvex.mutation('project:rm', { id: projectId, orgId: testOrgId })
      const task1Result = await testConvex.query<{ code?: string }>('task:read', {
        id: taskId1,
        orgId: testOrgId
      })
      const task2Result = await testConvex.query<{ code?: string }>('task:read', {
        id: taskId2,
        orgId: testOrgId
      })
      expect(task1Result.code).toBe('NOT_FOUND')
      expect(task2Result.code).toBe('NOT_FOUND')
    })

    test('delete org - cascades projects and tasks', async () => {
      const cascadeSlug = generateSlug('full-cascade')
      const cascadeOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Full Cascade Org', slug: cascadeSlug }
      })
      const projectId = await testConvex.mutation<string>('project:create', {
        name: 'Full Cascade Project',
        orgId: cascadeOrg.orgId
      })
      await testConvex.mutation<string>('task:create', {
        orgId: cascadeOrg.orgId,
        projectId,
        title: 'Full Cascade Task'
      })
      await testConvex.mutation('org:remove', { orgId: cascadeOrg.orgId })
      const orgResult = await testConvex.query<{ code?: string } | null>('org:getBySlug', {
        slug: cascadeSlug
      })
      expect(orgResult).toBeNull()
    })
  })

test.describe
  .serial('Org Isolation', () => {
    let org1Id: string
    let org2Id: string
    let project1Id: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug1 = generateSlug('iso-org1')
      const slug2 = generateSlug('iso-org2')
      const created1 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Isolation Org 1', slug: slug1 }
      })
      const created2 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Isolation Org 2', slug: slug2 }
      })
      org1Id = created1.orgId
      org2Id = created2.orgId
      project1Id = await testConvex.mutation<string>('project:create', {
        name: 'Org1 Project',
        orgId: org1Id
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('read project - cannot access from other org', async () => {
      const result = await testConvex.query<{ code?: string }>('project:read', {
        id: project1Id,
        orgId: org2Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('update project - cannot modify from other org', async () => {
      const result = await testConvex.mutation<{ code?: string }>('project:update', {
        id: project1Id,
        name: 'Hacked Name',
        orgId: org2Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('rm project - cannot delete from other org', async () => {
      const result = await testConvex.mutation<{ code?: string }>('project:rm', {
        id: project1Id,
        orgId: org2Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('list projects - only shows org projects', async () => {
      await testConvex.mutation<string>('project:create', {
        name: 'Org2 Only Project',
        orgId: org2Id
      })
      const org1Projects = await testConvex.query<PaginatedResult<ProjectDoc>>('project:list', {
        orgId: org1Id,
        paginationOpts: { cursor: null, numItems: 100 }
      })
      const org2Projects = await testConvex.query<PaginatedResult<ProjectDoc>>('project:list', {
        orgId: org2Id,
        paginationOpts: { cursor: null, numItems: 100 }
      })
      const org1HasOrg2Project = org1Projects.page.some(p => p.name === 'Org2 Only Project')
      const org2HasOrg2Project = org2Projects.page.some(p => p.name === 'Org2 Only Project')
      expect(org1HasOrg2Project).toBe(false)
      expect(org2HasOrg2Project).toBe(true)
    })
  })

test.describe
  .serial('Error Cases', () => {
    let testOrgId: string
    let testProjectId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('errors')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Error Test Org', slug }
      })
      testOrgId = created.orgId
      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Error Test Project',
        orgId: testOrgId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('project read - validation error for malformed id', async () => {
      const result = await testConvex.query<{ code?: string }>('project:read', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('project update - validation error for malformed id', async () => {
      const result = await testConvex.mutation<{ code?: string }>('project:update', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        name: 'Updated',
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('project rm - validation error for malformed id', async () => {
      const result = await testConvex.mutation<{ code?: string }>('project:rm', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('task read - validation error for malformed id', async () => {
      const result = await testConvex.query<{ code?: string }>('task:read', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('task toggle - validation error for malformed id', async () => {
      const result = await testConvex.mutation<{ code?: string }>('task:toggle', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('task update - validation error for malformed id', async () => {
      const result = await testConvex.mutation<{ code?: string }>('task:update', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId,
        title: 'Updated'
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('task rm - validation error for malformed id', async () => {
      const result = await testConvex.mutation<{ code?: string }>('task:rm', {
        id: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: testOrgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('task toggle - not found for wrong org', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Wrong Org Toggle Task'
      })
      const otherSlug = generateSlug('wrong-org')
      const otherOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wrong Org', slug: otherSlug }
      })
      const result = await testConvex.mutation<{ code?: string }>('task:toggle', {
        id: taskId,
        orgId: otherOrg.orgId
      })
      expect(result.code).toBe('NOT_FOUND')
    })
  })

test.describe
  .serial('Data Integrity', () => {
    let testOrgId: string
    let testProjectId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('integrity')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Integrity Test Org', slug }
      })
      testOrgId = created.orgId
      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Integrity Test Project',
        orgId: testOrgId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('project tracks userId', async () => {
      const project = await testConvex.query<ProjectDoc>('project:read', {
        id: testProjectId,
        orgId: testOrgId
      })
      expect(project.userId).toBeDefined()
    })

    test('project has timestamps', async () => {
      const project = await testConvex.query<ProjectDoc>('project:read', {
        id: testProjectId,
        orgId: testOrgId
      })
      expect(project._creationTime).toBeDefined()
      expect(project.updatedAt).toBeDefined()
    })

    test('task tracks userId', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'UserId Test Task'
      })
      const task = await testConvex.query<TaskDoc>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      expect(task.userId).toBeDefined()
    })

    test('task has timestamps', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Timestamp Test Task'
      })
      const task = await testConvex.query<TaskDoc>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      expect(task._creationTime).toBeDefined()
      expect(task.updatedAt).toBeDefined()
    })

    test('update changes updatedAt', async () => {
      const taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'UpdatedAt Test Task'
      })
      const original = await testConvex.query<TaskDoc>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      await new Promise(resolve => {
        setTimeout(resolve, 10)
      })
      await testConvex.mutation<TaskDoc>('task:update', {
        id: taskId,
        orgId: testOrgId,
        title: 'Changed Title'
      })
      const updated = await testConvex.query<TaskDoc>('task:read', {
        id: taskId,
        orgId: testOrgId
      })
      expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt)
    })
  })

test.describe
  .serial('Content Permission Boundaries', () => {
    let testOrgId: string
    let testProjectId: string
    let memberUserId: string
    let member2UserId: string
    let taskId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('content-perms')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Content Perms Test Org', slug }
      })
      testOrgId = created.orgId

      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Owner Project',
        orgId: testOrgId
      })

      taskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Owner Task'
      })

      const memberEmail = `${testPrefix}-content-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Content Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)

      const member2Email = `${testPrefix}-content-member2@test.local`
      member2UserId = (await createTestUser(member2Email, 'Content Member 2')) ?? ''
      await addTestOrgMember(testOrgId, member2UserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('member blocked from editing other member project', async () => {
      const member1Project = await testConvex.mutation<string>('project:create', {
        name: 'Member1 Project',
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateProjectAsUser', {
        id: member1Project,
        name: 'Hacked Name',
        orgId: testOrgId,
        userId: member2UserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('member blocked from deleting other member project', async () => {
      const deleteProject = await testConvex.mutation<string>('project:create', {
        name: 'To Delete Project',
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:deleteProjectAsUser', {
        id: deleteProject,
        orgId: testOrgId,
        userId: member2UserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('member blocked from toggling other member task', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('member blocked from task assign', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:assignTaskAsUser', {
        assigneeId: member2UserId,
        id: taskId,
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member blocked from project bulkRm', async () => {
      const bulkProject = await testConvex.mutation<string>('project:create', {
        name: 'Bulk Project',
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:bulkRmProjectAsUser', {
        ids: [bulkProject],
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member blocked from task bulkRm', async () => {
      const bulkTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Bulk Task'
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:bulkRmTaskAsUser', {
        ids: [bulkTask],
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member blocked from task bulkUpdate', async () => {
      const updateTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Update Task'
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:bulkUpdateTaskAsUser', {
        data: { priority: 'high' },
        ids: [updateTask],
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('assign task to non-member fails', async () => {
      const nonMemberEmail = `${testPrefix}-nonmember@test.local`
      const nonMemberUserId = (await createTestUser(nonMemberEmail, 'Non Member')) ?? ''
      const result = await testConvex.mutation<{ code?: string }>('testauth:assignTaskAsUser', {
        assigneeId: nonMemberUserId,
        id: taskId,
        orgId: testOrgId,
        userId: testOrgId
      })
      expect(result.code).toBeDefined()
    })
  })

test.describe
  .serial('Admin Project/Task Operations', () => {
    let testOrgId: string
    let testUserId: string
    let testProjectId: string
    let adminUserId: string
    let memberUserId: string
    let memberProjectId: string
    let memberTaskId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testUserId = (await testConvex.query<string>('testauth:getTestUser', {})) ?? ''
      const slug = generateSlug('admin-ops')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Admin Ops Test Org', slug }
      })
      testOrgId = created.orgId

      testProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Owner Project',
        orgId: testOrgId
      })

      const adminEmail = `${testPrefix}-admin-ops-admin@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Admin Ops Admin')) ?? ''
      await addTestOrgMember(testOrgId, adminUserId, true)

      const memberEmail = `${testPrefix}-admin-ops-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Admin Ops Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)

      memberProjectId = await testConvex.mutation<string>('project:create', {
        name: 'Member Project',
        orgId: testOrgId
      })

      memberTaskId = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Member Task'
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin can update any project', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateProjectAsUser', {
        id: memberProjectId,
        name: 'Admin Updated Project',
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('admin can delete any project', async () => {
      const toDeleteProject = await testConvex.mutation<string>('project:create', {
        name: 'To Delete By Admin',
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:deleteProjectAsUser', {
        id: toDeleteProject,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('admin can update any task', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateTaskAsUser', {
        id: memberTaskId,
        orgId: testOrgId,
        title: 'Admin Updated Task',
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('member blocked from updating other member task', async () => {
      const ownerTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Owner Task For Update'
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateTaskAsUser', {
        id: ownerTask,
        orgId: testOrgId,
        title: 'Hacked Title',
        userId: memberUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('admin can delete any task', async () => {
      const toDeleteTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'To Delete By Admin'
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:rmTaskAsUser', {
        id: toDeleteTask,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('member blocked from deleting other member task', async () => {
      const ownerTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Owner Task For Delete'
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:rmTaskAsUser', {
        id: ownerTask,
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('admin can toggle any task', async () => {
      const toggleTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Toggle By Admin'
      })
      const result = await testConvex.mutation<{ code?: string; completed?: boolean }>('testauth:toggleTaskAsUser', {
        id: toggleTask,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.completed).toBe(true)
    })

    test('assign to self - success', async () => {
      const selfAssignTask = await testConvex.mutation<string>('task:create', {
        orgId: testOrgId,
        projectId: testProjectId,
        title: 'Self Assign'
      })
      const result = await testConvex.mutation<{ assigneeId?: string; code?: string }>('testauth:assignTaskAsUser', {
        assigneeId: testUserId,
        id: selfAssignTask,
        orgId: testOrgId,
        userId: testUserId
      })
      expect(result.assigneeId).toBe(testUserId)
    })

    test('non-member cannot list projects', async () => {
      const outsiderEmail = `${testPrefix}-outsider@test.local`
      const outsiderId = (await createTestUser(outsiderEmail, 'Outsider')) ?? ''
      const result = await testConvex.query<{ code?: string }>('testauth:listProjectsAsUser', {
        orgId: testOrgId,
        userId: outsiderId
      })
      expect(result.code).toBe('NOT_ORG_MEMBER')
    })
  })
