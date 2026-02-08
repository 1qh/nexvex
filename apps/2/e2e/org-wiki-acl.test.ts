// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import { addTestOrgMember, createTestUser, ensureTestUser, makeOrgTestUtils, testConvex } from './org-helpers'
import type { WikiDoc } from './org-helpers'

const testPrefix = `e2e-wiki-acl-${Date.now()}`
const { cleanupOrgTestData, cleanupTestUsers, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('Wiki ACL - Add/Remove Editors', () => {
    let testOrgId: string
    let wikiId: string
    let memberUserId: string
    let member2UserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-editors')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Editors Test Org', slug }
      })
      testOrgId = created.orgId

      wikiId = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-add-editor',
        status: 'published',
        title: 'ACL Test Wiki'
      })

      const memberEmail = `${testPrefix}-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Wiki ACL Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)

      const member2Email = `${testPrefix}-member2@test.local`
      member2UserId = (await createTestUser(member2Email, 'Wiki ACL Member 2')) ?? ''
      await addTestOrgMember(testOrgId, member2UserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin can add editor to wiki', async () => {
      const result = await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        wikiId
      })
      expect(result.editors).toBeDefined()
      expect(result.editors).toContain(memberUserId)
    })

    test('adding same editor twice is idempotent', async () => {
      const result = await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        wikiId
      })
      const editorCount = result.editors?.filter(e => e === memberUserId).length ?? 0
      expect(editorCount).toBe(1)
    })

    test('admin can add multiple editors', async () => {
      const result = await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: member2UserId,
        orgId: testOrgId,
        wikiId
      })
      expect(result.editors).toContain(memberUserId)
      expect(result.editors).toContain(member2UserId)
    })

    test('admin can remove editor from wiki', async () => {
      const result = await testConvex.mutation<WikiDoc>('wiki:removeEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        wikiId
      })
      expect(result.editors).not.toContain(memberUserId)
      expect(result.editors).toContain(member2UserId)
    })

    test('removing non-editor is safe', async () => {
      const result = await testConvex.mutation<WikiDoc>('wiki:removeEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        wikiId
      })
      expect(result.editors).not.toContain(memberUserId)
    })

    test('editors query returns resolved users', async () => {
      await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: memberUserId,
        orgId: testOrgId,
        wikiId
      })
      const editors = await testConvex.query<{ email: string; name: string; userId: string }[]>('wiki:editors', {
        orgId: testOrgId,
        wikiId
      })
      expect(editors.length).toBeGreaterThanOrEqual(1)
      const found = editors.find(e => e.userId === memberUserId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('Wiki ACL Member')
    })

    test('setEditors replaces all editors', async () => {
      const result = await testConvex.mutation<WikiDoc>('wiki:setEditors', {
        editorIds: [member2UserId],
        orgId: testOrgId,
        wikiId
      })
      expect(result.editors).toEqual([member2UserId])
    })

    test('addEditor rejects non-org-member', async () => {
      const outsiderEmail = `${testPrefix}-outsider@test.local`
      const outsiderId = (await createTestUser(outsiderEmail, 'Wiki Outsider')) ?? ''
      const result = await testConvex.mutation<{ code?: string }>('wiki:addEditor', {
        editorId: outsiderId,
        orgId: testOrgId,
        wikiId
      })
      expect(result.code).toBe('NOT_ORG_MEMBER')
    })
  })

test.describe
  .serial('Wiki ACL - Non-admin Cannot Manage Editors', () => {
    let testOrgId: string
    let wikiId: string
    let memberUserId: string
    let member2UserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-nonadmin')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL NonAdmin Test Org', slug }
      })
      testOrgId = created.orgId

      wikiId = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-nonadmin-target',
        status: 'published',
        title: 'NonAdmin Wiki'
      })

      const memberEmail = `${testPrefix}-na-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Wiki NA Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)

      const member2Email = `${testPrefix}-na-member2@test.local`
      member2UserId = (await createTestUser(member2Email, 'Wiki NA Member 2')) ?? ''
      await addTestOrgMember(testOrgId, member2UserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('member cannot add editor', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:addWikiEditorAsUser', {
        editorId: member2UserId,
        orgId: testOrgId,
        userId: memberUserId,
        wikiId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member cannot remove editor', async () => {
      await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: member2UserId,
        orgId: testOrgId,
        wikiId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:removeWikiEditorAsUser', {
        editorId: member2UserId,
        orgId: testOrgId,
        userId: memberUserId,
        wikiId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })
  })

test.describe
  .serial('Wiki ACL - Editor Can Edit Wiki', () => {
    let testOrgId: string
    let wikiId: string
    let editorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-editor-edit')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Editor Edit Org', slug }
      })
      testOrgId = created.orgId

      wikiId = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-editor-editable',
        status: 'published',
        title: 'Editor Editable Wiki'
      })

      const editorEmail = `${testPrefix}-editor@test.local`
      editorUserId = (await createTestUser(editorEmail, 'Wiki Editor User')) ?? ''
      await addTestOrgMember(testOrgId, editorUserId, false)
      await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        wikiId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('editor can update wiki', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        title: 'Editor Updated Wiki',
        userId: editorUserId
      })
      expect(result.success).toBe(true)
    })

    test('editor can delete wiki', async () => {
      const tempWiki = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-editor-delete-temp',
        status: 'published',
        title: 'Temp Editor Delete Wiki'
      })
      await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        wikiId: tempWiki
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:deleteWikiAsUser', {
        id: tempWiki,
        orgId: testOrgId,
        userId: editorUserId
      })
      expect(result.success).toBe(true)
    })
  })

test.describe
  .serial('Wiki ACL - Non-Editor Cannot Edit Wiki', () => {
    let testOrgId: string
    let wikiId: string
    let nonEditorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-noneditor')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL NonEditor Org', slug }
      })
      testOrgId = created.orgId

      wikiId = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-noneditor-target',
        status: 'published',
        title: 'NonEditor Cannot Edit Wiki'
      })

      const nonEditorEmail = `${testPrefix}-noneditor@test.local`
      nonEditorUserId = (await createTestUser(nonEditorEmail, 'Wiki NonEditor User')) ?? ''
      await addTestOrgMember(testOrgId, nonEditorUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('non-editor cannot update wiki', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        title: 'Hacked Wiki Title',
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('non-editor cannot delete wiki', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:deleteWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        userId: nonEditorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })
  })

test.describe
  .serial('Wiki ACL - Creator Always Has Edit Access', () => {
    let testOrgId: string
    let creatorUserId: string
    let creatorWikiId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-creator')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Creator Org', slug }
      })
      testOrgId = created.orgId

      const creatorEmail = `${testPrefix}-creator@test.local`
      creatorUserId = (await createTestUser(creatorEmail, 'Wiki Creator User')) ?? ''
      await addTestOrgMember(testOrgId, creatorUserId, false)

      creatorWikiId = await testConvex.mutation<string>('testauth:createWikiAsUser', {
        orgId: testOrgId,
        slug: 'wiki-creator-own',
        status: 'published',
        title: 'Creator Own Wiki',
        userId: creatorUserId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('creator can update own wiki without being in editors', async () => {
      const wiki = await testConvex.query<WikiDoc>('wiki:read', {
        id: creatorWikiId,
        orgId: testOrgId
      })
      expect(wiki.editors).toBeUndefined()
      expect(wiki.userId).toBe(creatorUserId)

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateWikiAsUser', {
        id: creatorWikiId,
        orgId: testOrgId,
        title: 'Creator Updated Wiki',
        userId: creatorUserId
      })
      expect(result.success).toBe(true)
    })

    test('creator can delete own wiki without being in editors', async () => {
      const tempWiki = await testConvex.mutation<string>('testauth:createWikiAsUser', {
        orgId: testOrgId,
        slug: 'wiki-creator-temp-del',
        status: 'published',
        title: 'Creator Temp Delete Wiki',
        userId: creatorUserId
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:deleteWikiAsUser', {
        id: tempWiki,
        orgId: testOrgId,
        userId: creatorUserId
      })
      expect(result.success).toBe(true)
    })
  })

test.describe
  .serial('Wiki ACL - Admin Always Has Full Access', () => {
    let testOrgId: string
    let wikiId: string
    let adminUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-admin')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Admin Test Org', slug }
      })
      testOrgId = created.orgId

      wikiId = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-admin-access',
        status: 'published',
        title: 'Admin Access Wiki'
      })

      const adminEmail = `${testPrefix}-admin-full@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Wiki Admin Full')) ?? ''
      await addTestOrgMember(testOrgId, adminUserId, true)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin can update wiki without being in editors', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        title: 'Admin Updated Wiki',
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('admin can add/remove editors', async () => {
      const memberEmail = `${testPrefix}-admin-target@test.local`
      const memberId = (await createTestUser(memberEmail, 'Wiki Admin Target')) ?? ''
      await addTestOrgMember(testOrgId, memberId, false)

      const added = await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: memberId,
        orgId: testOrgId,
        wikiId
      })
      expect(added.editors).toContain(memberId)

      const removed = await testConvex.mutation<WikiDoc>('wiki:removeEditor', {
        editorId: memberId,
        orgId: testOrgId,
        wikiId
      })
      expect(removed.editors).not.toContain(memberId)
    })

    test('admin can delete wiki', async () => {
      const tempWiki = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-admin-delete-temp',
        status: 'published',
        title: 'Admin Temp Delete Wiki'
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:deleteWikiAsUser', {
        id: tempWiki,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })
  })

test.describe
  .serial('Wiki ACL - Removing Editor Revokes Access', () => {
    let testOrgId: string
    let wikiId: string
    let editorUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('wiki-revoke')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Revoke Org', slug }
      })
      testOrgId = created.orgId

      wikiId = await testConvex.mutation<string>('wiki:create', {
        orgId: testOrgId,
        slug: 'wiki-revoke-target',
        status: 'published',
        title: 'Revoke Test Wiki'
      })

      const editorEmail = `${testPrefix}-revoke-editor@test.local`
      editorUserId = (await createTestUser(editorEmail, 'Wiki Revoke Editor')) ?? ''
      await addTestOrgMember(testOrgId, editorUserId, false)
      await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        wikiId
      })
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('editor can update wiki while editor', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        title: 'Editor Updated Revoke Wiki',
        userId: editorUserId
      })
      expect(result.success).toBe(true)
    })

    test('after removing editor, update is forbidden', async () => {
      await testConvex.mutation<WikiDoc>('wiki:removeEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        wikiId
      })
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        title: 'Should Fail',
        userId: editorUserId
      })
      expect(result.code).toBe('FORBIDDEN')
    })

    test('re-adding editor restores access', async () => {
      await testConvex.mutation<WikiDoc>('wiki:addEditor', {
        editorId: editorUserId,
        orgId: testOrgId,
        wikiId
      })
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateWikiAsUser', {
        id: wikiId,
        orgId: testOrgId,
        title: 'Re-added Editor Update',
        userId: editorUserId
      })
      expect(result.success).toBe(true)
    })
  })

test.describe
  .serial('Wiki ACL - Cross-Org Isolation', () => {
    let org1Id: string
    let org2Id: string
    let wiki1Id: string
    let memberUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug1 = generateSlug('wiki-iso1')
      const slug2 = generateSlug('wiki-iso2')
      const created1 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Iso Org 1', slug: slug1 }
      })
      const created2 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Wiki ACL Iso Org 2', slug: slug2 }
      })
      org1Id = created1.orgId
      org2Id = created2.orgId

      wiki1Id = await testConvex.mutation<string>('wiki:create', {
        orgId: org1Id,
        slug: 'wiki-iso-target',
        status: 'published',
        title: 'Org1 Wiki'
      })

      const memberEmail = `${testPrefix}-iso-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Wiki Iso Member')) ?? ''
      await addTestOrgMember(org1Id, memberUserId, false)
      await addTestOrgMember(org2Id, memberUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('addEditor with wrong orgId fails', async () => {
      const result = await testConvex.mutation<{ code?: string }>('wiki:addEditor', {
        editorId: memberUserId,
        orgId: org2Id,
        wikiId: wiki1Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('removeEditor with wrong orgId fails', async () => {
      const result = await testConvex.mutation<{ code?: string }>('wiki:removeEditor', {
        editorId: memberUserId,
        orgId: org2Id,
        wikiId: wiki1Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })

    test('editors query with wrong orgId fails', async () => {
      const result = await testConvex.query<{ code?: string }>('wiki:editors', {
        orgId: org2Id,
        wikiId: wiki1Id
      })
      expect(result.code).toBe('NOT_FOUND')
    })
  })
