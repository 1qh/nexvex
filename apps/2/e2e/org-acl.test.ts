// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import { addTestOrgMember, createTestUser, ensureTestUser, makeOrgTestUtils, testConvex } from './org-helpers'
import type { ProjectDoc } from './org-helpers'

const testPrefix = `e2e-acl-${Date.now()}`
const { cleanupOrgTestData, cleanupTestUsers, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('ACL - Add/Remove Editors', () => {
    let testOrgId: string
    let projectId: string
    let memberUserId: string
    let member2UserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-editors')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Editors Test Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'ACL Test Project',
        orgId: testOrgId
      })

      const memberEmail = `${testPrefix}-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'ACL Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)

      const member2Email = `${testPrefix}-member2@test.local`
      member2UserId = (await createTestUser(member2Email, 'ACL Member 2')) ?? ''
      await addTestOrgMember(testOrgId, member2UserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin can add editor to project', async () => {
      const result = await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        projectId
      })
      expect(result.editors).toBeDefined()
      expect(result.editors).toContain(memberUserId)
    })

    test('adding same editor twice is idempotent', async () => {
      const result = await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        projectId
      })
      const editorCount = result.editors?.filter(e => e === memberUserId).length ?? 0
      expect(editorCount).toBe(1)
    })

    test('admin can add multiple editors', async () => {
      const result = await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: member2UserId,
        orgId: testOrgId,
        projectId
      })
      expect(result.editors).toContain(memberUserId)
      expect(result.editors).toContain(member2UserId)
    })

    test('admin can remove editor from project', async () => {
      const result = await testConvex.mutation<ProjectDoc>('project:removeEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        projectId
      })
      expect(result.editors).not.toContain(memberUserId)
      expect(result.editors).toContain(member2UserId)
    })

    test('removing non-editor is safe', async () => {
      const result = await testConvex.mutation<ProjectDoc>('project:removeEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        projectId
      })
      expect(result.editors).not.toContain(memberUserId)
    })

    test('editors query returns resolved users', async () => {
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        projectId
      })
      const editors = await testConvex.query<{ email: string; name: string; userId: string }[]>('project:editors', {
        orgId: testOrgId,
        projectId
      })
      expect(editors.length).toBeGreaterThanOrEqual(1)
      const found = editors.find(e => e.userId === memberUserId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('ACL Member')
    })

    test('setEditors replaces all editors', async () => {
      const result = await testConvex.mutation<ProjectDoc>('project:setEditors', {
        editorIds: [member2UserId],
        orgId: testOrgId,
        projectId
      })
      expect(result.editors).toEqual([member2UserId])
    })

    test('addEditor rejects non-org-member', async () => {
      const outsiderEmail = `${testPrefix}-outsider@test.local`
      const outsiderId = (await createTestUser(outsiderEmail, 'Outsider')) ?? ''
      const result = await testConvex.mutation<{ code?: string }>('project:addEditor', {
        editorId: outsiderId,
        orgId: testOrgId,
        projectId
      })
      expect(result.code).toBe('NOT_ORG_MEMBER')
    })
  })

test.describe
  .serial('ACL - Non-admin Cannot Manage Editors', () => {
    let testOrgId: string
    let projectId: string
    let memberUserId: string
    let member2UserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-nonadmin')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL NonAdmin Test Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'NonAdmin ACL Project',
        orgId: testOrgId
      })

      const memberEmail = `${testPrefix}-na-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'NA Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)

      const member2Email = `${testPrefix}-na-member2@test.local`
      member2UserId = (await createTestUser(member2Email, 'NA Member 2')) ?? ''
      await addTestOrgMember(testOrgId, member2UserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('member cannot add editor', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:addEditorAsUser', {
        editorId: member2UserId,
        orgId: testOrgId,
        projectId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member cannot remove editor', async () => {
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: member2UserId,
        orgId: testOrgId,
        projectId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:removeEditorAsUser', {
        editorId: member2UserId,
        orgId: testOrgId,
        projectId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })
  })

test.describe
  .serial('ACL - Editor Can Edit Project', () => {
    let testOrgId: string
    let projectId: string
    let editorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-editor-edit')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Editor Edit Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'Editor Editable Project',
        orgId: testOrgId
      })

      const editorEmail = `${testPrefix}-editor@test.local`
      editorUserId = (await createTestUser(editorEmail, 'Editor User')) ?? ''
      await addTestOrgMember(testOrgId, editorUserId, false)
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        projectId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('editor can update project', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateProjectAsUser', {
        id: projectId,
        name: 'Editor Updated Project',
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.success).toBe(true)
    })

    test('editor can delete project', async () => {
      const tempProject = await testConvex.mutation<string>('project:create', {
        name: 'Temp Editor Delete Project',
        orgId: testOrgId
      })
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        projectId: tempProject
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:deleteProjectAsUser', {
        id: tempProject,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.success).toBe(true)
    })
  })

test.describe
  .serial('ACL - Non-Editor Cannot Edit Project', () => {
    let testOrgId: string
    let projectId: string
    let nonEditorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-noneditor')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL NonEditor Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'NonEditor Cannot Edit Project',
        orgId: testOrgId
      })

      const nonEditorEmail = `${testPrefix}-noneditor@test.local`
      nonEditorUserId = (await createTestUser(nonEditorEmail, 'NonEditor User')) ?? ''
      await addTestOrgMember(testOrgId, nonEditorUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('non-editor cannot update project', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateProjectAsUser', {
        id: projectId,
        name: 'Hacked Name',
        orgId: testOrgId,
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('non-editor cannot delete project', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:deleteProjectAsUser', {
        id: projectId,
        orgId: testOrgId,
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })
  })

test.describe
  .serial('ACL - Creator Always Has Edit Access', () => {
    let testOrgId: string
    let creatorUserId: string
    let creatorProjectId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-creator')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Creator Org', slug }
      })
      testOrgId = created.orgId

      const creatorEmail = `${testPrefix}-creator@test.local`
      creatorUserId = (await createTestUser(creatorEmail, 'Creator User')) ?? ''
      await addTestOrgMember(testOrgId, creatorUserId, false)

      creatorProjectId = await testConvex.mutation<string>('testauth:createProjectAsUser', {
        name: 'Creator Own Project',
        orgId: testOrgId,
        userId: creatorUserId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('creator can update own project without being in editors', async () => {
      const project = await testConvex.query<ProjectDoc>('project:read', {
        id: creatorProjectId,
        orgId: testOrgId
      })
      expect(project.editors).toBeUndefined()
      expect(project.userId).toBe(creatorUserId)

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateProjectAsUser', {
        id: creatorProjectId,
        name: 'Creator Updated',
        orgId: testOrgId,
        userId: creatorUserId
      })
      expect(result.success).toBe(true)
    })

    test('creator can delete own project without being in editors', async () => {
      const tempProject = await testConvex.mutation<string>('testauth:createProjectAsUser', {
        name: 'Creator Temp Delete',
        orgId: testOrgId,
        userId: creatorUserId
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:deleteProjectAsUser', {
        id: tempProject,
        orgId: testOrgId,
        userId: creatorUserId
      })
      expect(result.success).toBe(true)
    })
  })

test.describe
  .serial('ACL - Task Inherits Project Editors', () => {
    let testOrgId: string
    let projectId: string
    let taskId: string
    let editorUserId: string
    let nonEditorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-task-inherit')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Task Inherit Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'Task Inherit Project',
        orgId: testOrgId
      })

      taskId = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId,
        title: 'Inherited ACL Task'
      })

      const editorEmail = `${testPrefix}-task-editor@test.local`
      editorUserId = (await createTestUser(editorEmail, 'Task Editor')) ?? ''
      await addTestOrgMember(testOrgId, editorUserId, false)
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        projectId
      })

      const nonEditorEmail = `${testPrefix}-task-noneditor@test.local`
      nonEditorUserId = (await createTestUser(nonEditorEmail, 'Task NonEditor')) ?? ''
      await addTestOrgMember(testOrgId, nonEditorUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('editor of project can toggle task', async () => {
      const result = await testConvex.mutation<{ code?: string; completed?: boolean }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.completed).toBe(true)
    })

    test('editor of project can toggle task back', async () => {
      const result = await testConvex.mutation<{ code?: string; completed?: boolean }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.completed).toBe(false)
    })

    test('non-editor member cannot toggle task', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('non-editor cannot update task', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        title: 'Hacked Task Title',
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('non-editor cannot delete task', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:rmTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })
  })

test.describe
  .serial('ACL - Removing Editor Revokes Access', () => {
    let testOrgId: string
    let projectId: string
    let taskId: string
    let editorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-revoke')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Revoke Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'Revoke Test Project',
        orgId: testOrgId
      })

      taskId = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId,
        title: 'Revoke Test Task'
      })

      const editorEmail = `${testPrefix}-revoke-editor@test.local`
      editorUserId = (await createTestUser(editorEmail, 'Revoke Editor')) ?? ''
      await addTestOrgMember(testOrgId, editorUserId, false)
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        projectId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('editor can toggle task while editor', async () => {
      const result = await testConvex.mutation<{ code?: string; completed?: boolean }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.completed).toBe(true)
    })

    test('after removing editor, toggle is forbidden', async () => {
      await testConvex.mutation<ProjectDoc>('project:removeEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        projectId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('after removing editor, project update is forbidden', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateProjectAsUser', {
        id: projectId,
        name: 'Should Fail',
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('re-adding editor restores access', async () => {
      await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        projectId
      })
      const result = await testConvex.mutation<{ code?: string; completed?: boolean }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.completed).toBe(false)
    })
  })

test.describe
  .serial('ACL - Admin Always Has Full Access', () => {
    let testOrgId: string
    let projectId: string
    let taskId: string
    let adminUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('acl-admin')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Admin Test Org', slug }
      })
      testOrgId = created.orgId

      projectId = await testConvex.mutation<string>('project:create', {
        name: 'Admin Access Project',
        orgId: testOrgId
      })

      taskId = await testConvex.mutation<string>('task:create', {
        completed: false,
        orgId: testOrgId,
        projectId,
        title: 'Admin Access Task'
      })

      const adminEmail = `${testPrefix}-admin-full@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Admin Full')) ?? ''
      await addTestOrgMember(testOrgId, adminUserId, true)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin can update project without being in editors', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateProjectAsUser', {
        id: projectId,
        name: 'Admin Updated',
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('admin can toggle task without being in editors', async () => {
      const result = await testConvex.mutation<{ code?: string; completed?: boolean }>('testauth:toggleTaskAsUser', {
        id: taskId,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.completed).toBe(true)
    })

    test('admin can add/remove editors', async () => {
      const memberEmail = `${testPrefix}-admin-target@test.local`
      const memberId = (await createTestUser(memberEmail, 'Admin Target')) ?? ''
      await addTestOrgMember(testOrgId, memberId, false)

      const added = await testConvex.mutation<ProjectDoc>('project:addEditor', {
        editorId: memberId,
        orgId: testOrgId,
        projectId
      })
      expect(added.editors).toContain(memberId)

      const removed = await testConvex.mutation<ProjectDoc>('project:removeEditor', {
        editorId: memberId,
        orgId: testOrgId,
        projectId
      })
      expect(removed.editors).not.toContain(memberId)
    })
  })

test.describe
  .serial('ACL - Cross-Org Isolation', () => {
    let org1Id: string
    let org2Id: string
    let project1Id: string
    let memberUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug1 = generateSlug('acl-iso1')
      const slug2 = generateSlug('acl-iso2')
      const created1 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Iso Org 1', slug: slug1 }
      })
      const created2 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'ACL Iso Org 2', slug: slug2 }
      })
      org1Id = created1.orgId
      org2Id = created2.orgId

      project1Id = await testConvex.mutation<string>('project:create', {
        name: 'Org1 ACL Project',
        orgId: org1Id
      })

      const memberEmail = `${testPrefix}-iso-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Iso Member')) ?? ''
      await addTestOrgMember(org1Id, memberUserId, false)
      await addTestOrgMember(org2Id, memberUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('addEditor with wrong orgId fails', async () => {
      const result = await testConvex.mutation<{ code?: string }>('project:addEditor', {
        editorId: memberUserId,
        orgId: org2Id,
        projectId: project1Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('removeEditor with wrong orgId fails', async () => {
      const result = await testConvex.mutation<{ code?: string }>('project:removeEditor', {
        editorId: memberUserId,
        orgId: org2Id,
        projectId: project1Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('editors query with wrong orgId fails', async () => {
      const result = await testConvex.query<{ code?: string }>('project:editors', {
        orgId: org2Id,
        projectId: project1Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })
  })
