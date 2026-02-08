// biome-ignore-all lint/performance/useTopLevelRegex: test file
/* eslint-disable max-statements, jest/no-conditional-in-test */
import { expect, test } from '@playwright/test'

import {
  addTestOrgMember,
  createTestUser,
  ensureTestUser,
  makeOrgTestUtils,
  removeTestOrgMember,
  testConvex
} from './org-helpers'
import type { InviteDoc, JoinRequestDoc, MemberDoc, OrgDoc } from './org-helpers'

const testPrefix = `e2e-org-${Date.now()}`
const { cleanupOrgTestData, cleanupTestUsers, generateSlug } = makeOrgTestUtils(testPrefix)

test.describe
  .serial('Org CRUD', () => {
    test.beforeAll(async () => {
      await ensureTestUser()
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('create org - success', async () => {
      const slug = generateSlug('create')
      const result = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Test Org', slug }
      })
      expect(result.orgId).toBeDefined()
    })

    test('create org - creator becomes owner', async () => {
      const slug = generateSlug('owner')
      const result = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Owner Test Org', slug }
      })
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: result.orgId })
      expect(org).toBeDefined()
      expect(org.userId).toBeDefined()
    })

    test('create org - duplicate slug fails', async () => {
      const slug = generateSlug('dupe')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'First Org', slug }
      })
      const result = await testConvex.mutation<{ code: string }>('org:create', {
        data: { name: 'Second Org', slug }
      })
      expect(result.code).toBe('ORG_SLUG_TAKEN')
    })

    test('get org - success', async () => {
      const slug = generateSlug('get')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Get Test Org', slug }
      })
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: created.orgId })
      expect(org.name).toBe('Get Test Org')
      expect(org.slug).toBe(slug)
    })

    test('getBySlug - success', async () => {
      const slug = generateSlug('byslug')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'BySlug Test Org', slug }
      })
      const org = await testConvex.query<OrgDoc>('org:getBySlug', { slug })
      expect(org).toBeDefined()
      expect(org.name).toBe('BySlug Test Org')
    })

    test('getBySlug - not found returns null', async () => {
      const org = await testConvex.query<OrgDoc | null>('org:getBySlug', { slug: 'nonexistent-slug-xyz' })
      expect(org).toBeNull()
    })

    test('myOrgs - includes created org', async () => {
      const slug = generateSlug('myorgs')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'MyOrgs Test', slug }
      })
      const orgs = await testConvex.query<{ org: OrgDoc; role: string }[]>('org:myOrgs', {})
      const found = orgs.find(o => o.org._id === created.orgId)
      expect(found).toBeDefined()
      expect(found?.role).toBe('owner')
    })

    test('update org - owner can update name', async () => {
      const slug = generateSlug('update-name')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Original Name', slug }
      })
      await testConvex.mutation('org:update', {
        data: { name: 'Updated Name' },
        orgId: created.orgId
      })
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: created.orgId })
      expect(org.name).toBe('Updated Name')
    })

    test('update org - owner can update slug', async () => {
      const slug = generateSlug('update-slug')
      const newSlug = generateSlug('new-slug')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Slug Update Test', slug }
      })
      await testConvex.mutation('org:update', {
        data: { slug: newSlug },
        orgId: created.orgId
      })
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: created.orgId })
      expect(org.slug).toBe(newSlug)
    })

    test('update org - duplicate slug fails', async () => {
      const slug1 = generateSlug('update-dupe1')
      const slug2 = generateSlug('update-dupe2')
      const org1 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Org 1', slug: slug1 }
      })
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Org 2', slug: slug2 }
      })
      const result = await testConvex.mutation<{ code: string }>('org:update', {
        data: { slug: slug2 },
        orgId: org1.orgId
      })
      expect(result.code).toBe('ORG_SLUG_TAKEN')
    })

    test('isSlugAvailable - available slug returns true', async () => {
      const slug = generateSlug('available')
      const result = await testConvex.query<{ available: boolean }>('org:isSlugAvailable', { slug })
      expect(result.available).toBe(true)
    })

    test('isSlugAvailable - taken slug returns false', async () => {
      const slug = generateSlug('taken')
      await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Taken Slug Org', slug }
      })
      const result = await testConvex.query<{ available: boolean }>('org:isSlugAvailable', { slug })
      expect(result.available).toBe(false)
    })

    test('remove org - owner can delete', async () => {
      const slug = generateSlug('remove')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Remove Test', slug }
      })
      await testConvex.mutation('org:remove', { orgId: created.orgId })
      const result = await testConvex.query<OrgDoc | null>('org:getBySlug', { slug })
      expect(result).toBeNull()
    })

    test('remove org - validation error for malformed id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:remove', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })
  })

test.describe
  .serial('Org Membership', () => {
    let testOrgId: string
    let memberUserId: string
    let adminUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('membership')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Membership Test Org', slug }
      })
      testOrgId = created.orgId

      const memberEmail = `${testPrefix}-member@test.local`
      const adminEmail = `${testPrefix}-admin@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Test Member')) ?? ''
      adminUserId = (await createTestUser(adminEmail, 'Test Admin')) ?? ''
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('membership - owner has owner role', async () => {
      const result = await testConvex.query<{ memberId: string | null; role: string }>('org:membership', {
        orgId: testOrgId
      })
      expect(result.role).toBe('owner')
      expect(result.memberId).toBeNull()
    })

    test('members - shows owner', async () => {
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      expect(members.length).toBeGreaterThanOrEqual(1)
      const owner = members.find(m => m.role === 'owner')
      expect(owner).toBeDefined()
    })

    test('add member via test helper - success', async () => {
      const memberId = await addTestOrgMember(testOrgId, memberUserId, false)
      expect(memberId).toBeDefined()
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === memberUserId)
      expect(found).toBeDefined()
      expect(found?.role).toBe('member')
    })

    test('add admin via test helper - success', async () => {
      const adminMemberId = await addTestOrgMember(testOrgId, adminUserId, true)
      expect(adminMemberId).toBeDefined()
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === adminUserId)
      expect(found).toBeDefined()
      expect(found?.role).toBe('admin')
    })

    test('setAdmin - owner can set member as admin', async () => {
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const member = members.find(m => m.userId === memberUserId)
      expect(member?.memberId).toBeDefined()
      await testConvex.mutation('org:setAdmin', {
        isAdmin: true,
        memberId: member?.memberId
      })
      const updatedMembers = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const updated = updatedMembers.find(m => m.userId === memberUserId)
      expect(updated?.role).toBe('admin')
    })

    test('setAdmin - owner can demote admin to member', async () => {
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const member = members.find(m => m.userId === memberUserId)
      await testConvex.mutation('org:setAdmin', {
        isAdmin: false,
        memberId: member?.memberId
      })
      const updatedMembers = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const updated = updatedMembers.find(m => m.userId === memberUserId)
      expect(updated?.role).toBe('member')
    })

    test('removeMember - owner can remove member', async () => {
      const tempEmail = `${testPrefix}-temp@test.local`
      const tempUserId = (await createTestUser(tempEmail, 'Temp Member')) ?? ''
      const tempMemberId = await addTestOrgMember(testOrgId, tempUserId, false)
      await testConvex.mutation('org:removeMember', { memberId: tempMemberId })
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === tempUserId)
      expect(found).toBeUndefined()
    })

    test('leave - member can leave org', async () => {
      const leaveEmail = `${testPrefix}-leave@test.local`
      const leaveUserId = (await createTestUser(leaveEmail, 'Leave Member')) ?? ''
      await addTestOrgMember(testOrgId, leaveUserId, false)
      await removeTestOrgMember(testOrgId, leaveUserId)
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === leaveUserId)
      expect(found).toBeUndefined()
    })
  })

test.describe
  .serial('Org Role Hierarchy', () => {
    let testOrgId: string
    let adminUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('hierarchy')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Hierarchy Test Org', slug }
      })
      testOrgId = created.orgId

      const adminEmail = `${testPrefix}-hier-admin@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Hierarchy Admin')) ?? ''
      await addTestOrgMember(testOrgId, adminUserId, true)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('transferOwnership - requires target to be admin', async () => {
      const memberEmail = `${testPrefix}-hier-member@test.local`
      const memberUserId = (await createTestUser(memberEmail, 'Hierarchy Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)
      const result = await testConvex.mutation<{ code: string }>('org:transferOwnership', {
        newOwnerId: memberUserId,
        orgId: testOrgId
      })
      expect(result.code).toBe('TARGET_MUST_BE_ADMIN')
    })

    test('transferOwnership - success to admin', async () => {
      const newOrgSlug = generateSlug('transfer')
      const newOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Transfer Test', slug: newOrgSlug }
      })
      const transferAdminEmail = `${testPrefix}-transfer-admin@test.local`
      const transferAdminId = (await createTestUser(transferAdminEmail, 'Transfer Admin')) ?? ''
      await addTestOrgMember(newOrg.orgId, transferAdminId, true)
      await testConvex.mutation('org:transferOwnership', {
        newOwnerId: transferAdminId,
        orgId: newOrg.orgId
      })
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: newOrg.orgId })
      expect(org.userId).toBe(transferAdminId)
    })

    test('leave - owner cannot leave without transfer', async () => {
      const slug = generateSlug('leave-owner')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Leave Owner Test', slug }
      })
      const result = await testConvex.mutation<{ code: string }>('org:leave', {
        orgId: created.orgId
      })
      expect(result.code).toBe('MUST_TRANSFER_OWNERSHIP')
    })

    test('setAdmin - owner has no memberId to modify', async () => {
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const owner = members.find(m => m.role === 'owner')
      expect(owner).toBeDefined()
      expect(owner?.memberId).toBeUndefined()
    })

    test('race - target leaves mid-transfer', async () => {
      const slug = generateSlug('race-transfer')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Race Transfer Org', slug }
      })
      const raceAdminEmail = `${testPrefix}-race-admin@test.local`
      const raceAdminId = (await createTestUser(raceAdminEmail, 'Race Admin')) ?? ''
      await addTestOrgMember(created.orgId, raceAdminId, true)
      await removeTestOrgMember(created.orgId, raceAdminId)
      const result = await testConvex.mutation<{ code: string }>('org:transferOwnership', {
        newOwnerId: raceAdminId,
        orgId: created.orgId
      })
      expect(result.code).toBeDefined()
      expect(['TARGET_MUST_BE_ADMIN', 'NOT_ORG_MEMBER']).toContain(result.code)
    })
  })

test.describe
  .serial('Org Invite Flow', () => {
    let testOrgId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('invite')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Invite Test Org', slug }
      })
      testOrgId = created.orgId
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('invite - owner can create invite', async () => {
      const result = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: 'invited@example.com',
        isAdmin: false,
        orgId: testOrgId
      })
      expect(result.inviteId).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.token.length).toBe(32)
    })

    test('invite - can create admin invite', async () => {
      const result = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: 'admin-invited@example.com',
        isAdmin: true,
        orgId: testOrgId
      })
      expect(result.inviteId).toBeDefined()
    })

    test('pendingInvites - shows created invites', async () => {
      const invites = await testConvex.query<InviteDoc[]>('org:pendingInvites', { orgId: testOrgId })
      expect(invites.length).toBeGreaterThanOrEqual(2)
    })

    test('revokeInvite - owner can revoke', async () => {
      const invite = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: 'revoke-me@example.com',
        isAdmin: false,
        orgId: testOrgId
      })
      await testConvex.mutation('org:revokeInvite', { inviteId: invite.inviteId })
      const invites = await testConvex.query<InviteDoc[]>('org:pendingInvites', { orgId: testOrgId })
      const found = invites.find(i => i._id === invite.inviteId)
      expect(found).toBeUndefined()
    })

    test('acceptInvite - invalid token fails', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:acceptInvite', {
        token: 'invalid-token-12345678901234567890'
      })
      expect(result.code).toBe('INVALID_INVITE')
    })

    test('acceptInvite - already member fails', async () => {
      const invite = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: 'owner@example.com',
        isAdmin: false,
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code: string }>('org:acceptInvite', {
        token: invite.token
      })
      expect(result.code).toBe('ALREADY_ORG_MEMBER')
    })

    test('acceptInvite - new user accepts valid invite becomes member', async () => {
      const newUserEmail = `${testPrefix}-accept-invite@test.local`
      const newUserId = (await createTestUser(newUserEmail, 'Invite Acceptor')) ?? ''
      const invite = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: newUserEmail,
        isAdmin: false,
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string; orgId?: string }>('testauth:acceptInviteAsUser', {
        token: invite.token,
        userId: newUserId
      })
      expect(result.orgId).toBe(testOrgId)
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const newMember = members.find(m => m.userId === newUserId)
      expect(newMember).toBeDefined()
      expect(newMember?.role).toBe('member')
    })

    test('acceptInvite - new user accepts admin invite becomes admin', async () => {
      const adminUserEmail = `${testPrefix}-accept-admin-invite@test.local`
      const adminUserId = (await createTestUser(adminUserEmail, 'Admin Invite Acceptor')) ?? ''
      const invite = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: adminUserEmail,
        isAdmin: true,
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code?: string; orgId?: string }>('testauth:acceptInviteAsUser', {
        token: invite.token,
        userId: adminUserId
      })
      expect(result.orgId).toBe(testOrgId)
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const newAdmin = members.find(m => m.userId === adminUserId)
      expect(newAdmin).toBeDefined()
      expect(newAdmin?.role).toBe('admin')
    })

    test('acceptInvite - expired invite fails', async () => {
      const expiredEmail = `${testPrefix}-expired@test.local`
      const expiredUserId = (await createTestUser(expiredEmail, 'Expired User')) ?? ''
      const invite = await testConvex.mutation<{ inviteId: string; token: string }>('testauth:createExpiredInvite', {
        email: expiredEmail,
        isAdmin: false,
        orgId: testOrgId
      })
      const result = await testConvex.mutation<{ code: string }>('testauth:acceptInviteAsUser', {
        token: invite.token,
        userId: expiredUserId
      })
      expect(result.code).toBe('INVITE_EXPIRED')
    })

    test('self-invite - invite created but accept fails', async () => {
      const invite = await testConvex.mutation<{ inviteId: string; token: string }>('org:invite', {
        email: 'test@playwright.local',
        isAdmin: false,
        orgId: testOrgId
      })
      expect(invite.inviteId).toBeDefined()
      const acceptResult = await testConvex.mutation<{ code: string }>('org:acceptInvite', {
        token: invite.token
      })
      expect(acceptResult.code).toBe('ALREADY_ORG_MEMBER')
    })
  })

test.describe
  .serial('Org Join Request Flow', () => {
    let testOrgId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('joinreq')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Join Request Test Org', slug }
      })
      testOrgId = created.orgId
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('requestJoin - already member fails', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:requestJoin', {
        message: 'I want to join',
        orgId: testOrgId
      })
      expect(result.code).toBe('ALREADY_ORG_MEMBER')
    })

    test('requestJoin - validation error for malformed org id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:requestJoin', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('pendingJoinRequests - empty initially', async () => {
      const requests = await testConvex.query<{ request: JoinRequestDoc }[]>('org:pendingJoinRequests', {
        orgId: testOrgId
      })
      expect(requests.length).toBe(0)
    })

    test('myJoinRequest - null when no request', async () => {
      const newOrgSlug = generateSlug('no-request')
      const newOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'No Request Test', slug: newOrgSlug }
      })
      const result = await testConvex.query<JoinRequestDoc | null>('org:myJoinRequest', {
        orgId: newOrg.orgId
      })
      expect(result).toBeNull()
    })

    test('approveJoinRequest - validation error for malformed request id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:approveJoinRequest', {
        requestId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('rejectJoinRequest - validation error for malformed request id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:rejectJoinRequest', {
        requestId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('cancelJoinRequest - validation error for malformed request id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:cancelJoinRequest', {
        requestId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('requestJoin - non-member can request to join', async () => {
      const requesterEmail = `${testPrefix}-requester@test.local`
      const requesterId = (await createTestUser(requesterEmail, 'Join Requester')) ?? ''
      const result = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        message: 'Please let me join',
        orgId: testOrgId,
        userId: requesterId
      })
      expect(result.requestId).toBeDefined()
      const request = await testConvex.query<JoinRequestDoc | null>('testauth:getJoinRequest', {
        requestId: result.requestId ?? ''
      })
      expect(request?.status).toBe('pending')
      expect(request?.userId).toBe(requesterId)
    })

    test('approveJoinRequest - owner approves and user becomes member', async () => {
      const approveEmail = `${testPrefix}-approve@test.local`
      const approveUserId = (await createTestUser(approveEmail, 'Approve User')) ?? ''
      const request = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        message: 'I want in',
        orgId: testOrgId,
        userId: approveUserId
      })
      expect(request.requestId).toBeDefined()
      await testConvex.mutation('org:approveJoinRequest', {
        requestId: request.requestId
      })
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const newMember = members.find(m => m.userId === approveUserId)
      expect(newMember).toBeDefined()
      expect(newMember?.role).toBe('member')
    })

    test('rejectJoinRequest - owner rejects and user is not member', async () => {
      const rejectEmail = `${testPrefix}-reject@test.local`
      const rejectUserId = (await createTestUser(rejectEmail, 'Reject User')) ?? ''
      const request = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        message: 'Please',
        orgId: testOrgId,
        userId: rejectUserId
      })
      expect(request.requestId).toBeDefined()
      await testConvex.mutation('org:rejectJoinRequest', {
        requestId: request.requestId
      })
      const updatedRequest = await testConvex.query<JoinRequestDoc | null>('testauth:getJoinRequest', {
        requestId: request.requestId ?? ''
      })
      expect(updatedRequest?.status).toBe('rejected')
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const rejectedUser = members.find(m => m.userId === rejectUserId)
      expect(rejectedUser).toBeUndefined()
    })

    test('cancelJoinRequest - user cancels own pending request', async () => {
      const cancelEmail = `${testPrefix}-cancel@test.local`
      const cancelUserId = (await createTestUser(cancelEmail, 'Cancel User')) ?? ''
      const request = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        message: 'Changed my mind',
        orgId: testOrgId,
        userId: cancelUserId
      })
      expect(request.requestId).toBeDefined()
      const cancelResult = await testConvex.mutation<{ code?: string; success?: boolean }>(
        'testauth:cancelJoinRequestAsUser',
        {
          requestId: request.requestId ?? '',
          userId: cancelUserId
        }
      )
      expect(cancelResult.success).toBe(true)
      const deletedRequest = await testConvex.query<JoinRequestDoc | null>('testauth:getJoinRequest', {
        requestId: request.requestId ?? ''
      })
      expect(deletedRequest).toBeNull()
    })

    test('duplicate join request fails', async () => {
      const dupeEmail = `${testPrefix}-dupe@test.local`
      const dupeUserId = (await createTestUser(dupeEmail, 'Dupe User')) ?? ''
      await testConvex.mutation<{ requestId?: string }>('testauth:requestJoinAsUser', {
        message: 'First request',
        orgId: testOrgId,
        userId: dupeUserId
      })
      const dupeResult = await testConvex.mutation<{ code: string }>('testauth:requestJoinAsUser', {
        message: 'Second request',
        orgId: testOrgId,
        userId: dupeUserId
      })
      expect(dupeResult.code).toBe('JOIN_REQUEST_EXISTS')
    })
  })

test.describe
  .serial('Org Cascade & Cleanup', () => {
    test.beforeAll(async () => {
      await ensureTestUser()
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('remove org - cascades members', async () => {
      const slug = generateSlug('cascade-member')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cascade Member Test', slug }
      })
      const memberEmail = `${testPrefix}-cascade-member@test.local`
      const memberUserId = (await createTestUser(memberEmail, 'Cascade Member')) ?? ''
      await addTestOrgMember(created.orgId, memberUserId, false)
      await testConvex.mutation('org:remove', { orgId: created.orgId })
      const org = await testConvex.query<OrgDoc | null>('org:getBySlug', { slug })
      expect(org).toBeNull()
    })

    test('remove org - cascades invites', async () => {
      const slug = generateSlug('cascade-invite')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cascade Invite Test', slug }
      })
      await testConvex.mutation('org:invite', {
        email: 'cascade-invite@example.com',
        isAdmin: false,
        orgId: created.orgId
      })
      await testConvex.mutation('org:remove', { orgId: created.orgId })
      const org = await testConvex.query<OrgDoc | null>('org:getBySlug', { slug })
      expect(org).toBeNull()
    })

    test('acceptInvite - cleans up pending join request', async () => {
      const cleanupSlug = generateSlug('cleanup-request')
      const cleanupOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cleanup Test Org', slug: cleanupSlug }
      })
      const cleanupEmail = `${testPrefix}-cleanup@test.local`
      const cleanupUserId = (await createTestUser(cleanupEmail, 'Cleanup User')) ?? ''
      const request = await testConvex.mutation<{ requestId?: string }>('testauth:requestJoinAsUser', {
        message: 'Will be cleaned up',
        orgId: cleanupOrg.orgId,
        userId: cleanupUserId
      })
      expect(request.requestId).toBeDefined()
      const invite = await testConvex.mutation<{ token: string }>('org:invite', {
        email: cleanupEmail,
        isAdmin: false,
        orgId: cleanupOrg.orgId
      })
      await testConvex.mutation('testauth:acceptInviteAsUser', {
        token: invite.token,
        userId: cleanupUserId
      })
      const updatedRequest = await testConvex.query<JoinRequestDoc | null>('testauth:getJoinRequest', {
        requestId: request.requestId ?? ''
      })
      expect(updatedRequest?.status).toBe('approved')
    })

    test('multiple orgs - isolation', async () => {
      const slug1 = generateSlug('iso1')
      const slug2 = generateSlug('iso2')
      const org1 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Isolation Org 1', slug: slug1 }
      })
      const org2 = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Isolation Org 2', slug: slug2 }
      })
      expect(org1.orgId).not.toBe(org2.orgId)
      const orgs = await testConvex.query<{ org: OrgDoc }[]>('org:myOrgs', {})
      const found1 = orgs.find(o => o.org._id === org1.orgId)
      const found2 = orgs.find(o => o.org._id === org2.orgId)
      expect(found1).toBeDefined()
      expect(found2).toBeDefined()
    })
  })

test.describe
  .serial('Org Error Cases', () => {
    test.beforeAll(async () => {
      await ensureTestUser()
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
    })

    test('get - validation error for malformed org id', async () => {
      const result = await testConvex.query<{ code?: string }>('org:get', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('update - validation error for malformed org id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:update', {
        data: { name: 'New Name' },
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('membership - validation error for malformed org id', async () => {
      const result = await testConvex.query<{ code?: string }>('org:membership', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('members - validation error for malformed org id', async () => {
      const result = await testConvex.query<{ code?: string }>('org:members', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('setAdmin - validation error for malformed member id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:setAdmin', {
        isAdmin: true,
        memberId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('removeMember - validation error for malformed member id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:removeMember', {
        memberId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('leave - validation error for malformed org id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:leave', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('invite - validation error for malformed org id', async () => {
      const result = await testConvex.mutation<{ code?: string }>('org:invite', {
        email: 'test@example.com',
        isAdmin: false,
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('revokeInvite - validation error for malformed invite id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:revokeInvite', {
        inviteId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('pendingInvites - validation error for malformed org id', async () => {
      const result = await testConvex.query<{ code?: string }>('org:pendingInvites', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('pendingJoinRequests - validation error for malformed org id', async () => {
      const result = await testConvex.query<{ code?: string }>('org:pendingJoinRequests', {
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('transferOwnership - validation error for malformed org id', async () => {
      const result = await testConvex.mutation<{ code: string }>('org:transferOwnership', {
        newOwnerId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })

    test('transferOwnership - validation error for malformed user id', async () => {
      const slug = generateSlug('transfer-notfound')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Transfer Not Found Test', slug }
      })
      const result = await testConvex.mutation<{ code: string }>('org:transferOwnership', {
        newOwnerId: 'k57xxxxxxxxxxxxxxxxx' as unknown as string,
        orgId: created.orgId
      })
      expect(result.code).toBe('VALIDATION_ERROR')
    })
  })

test.describe
  .serial('Org Admin Permissions', () => {
    let testOrgId: string
    let adminUserId: string
    let adminMemberId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('admin-perms')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Admin Perms Test Org', slug }
      })
      testOrgId = created.orgId

      const adminEmail = `${testPrefix}-admin-perms@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Admin Perms')) ?? ''
      adminMemberId = (await addTestOrgMember(testOrgId, adminUserId, true)) ?? ''
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin member exists', async () => {
      expect(adminMemberId).toBeDefined()
      expect(adminUserId).toBeDefined()
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const admin = members.find(m => m.userId === adminUserId)
      expect(admin).toBeDefined()
      expect(admin?.role).toBe('admin')
    })

    test('org has both owner and admin', async () => {
      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const owner = members.find(m => m.role === 'owner')
      const admin = members.find(m => m.role === 'admin')
      expect(owner).toBeDefined()
      expect(admin).toBeDefined()
    })
  })

test.describe
  .serial('Org Permission Boundaries', () => {
    let testOrgId: string
    let memberUserId: string
    let memberMemberId: string
    let adminUserId: string
    let adminMemberId: string
    let admin2UserId: string
    let admin2MemberId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('perms')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Permission Boundaries Org', slug }
      })
      testOrgId = created.orgId

      const memberEmail = `${testPrefix}-perm-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Perm Member')) ?? ''
      memberMemberId = (await addTestOrgMember(testOrgId, memberUserId, false)) ?? ''

      const adminEmail = `${testPrefix}-perm-admin@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Perm Admin')) ?? ''
      adminMemberId = (await addTestOrgMember(testOrgId, adminUserId, true)) ?? ''

      const admin2Email = `${testPrefix}-perm-admin2@test.local`
      admin2UserId = (await createTestUser(admin2Email, 'Perm Admin 2')) ?? ''
      admin2MemberId = (await addTestOrgMember(testOrgId, admin2UserId, true)) ?? ''
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('member cannot invite', async () => {
      const result = await testConvex.mutation<{ code: string }>('testauth:inviteAsUser', {
        email: 'test-invite@example.com',
        isAdmin: false,
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member cannot setAdmin', async () => {
      const result = await testConvex.mutation<{ code: string }>('testauth:setAdminAsUser', {
        isAdmin: true,
        memberId: adminMemberId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('member cannot removeMember', async () => {
      const result = await testConvex.mutation<{ code: string }>('testauth:removeMemberAsUser', {
        memberId: adminMemberId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('admin cannot setAdmin - owner only', async () => {
      const result = await testConvex.mutation<{ code: string }>('testauth:setAdminAsUser', {
        isAdmin: false,
        memberId: memberMemberId,
        userId: adminUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('admin cannot remove another admin', async () => {
      const result = await testConvex.mutation<{ code: string }>('testauth:removeMemberAsUser', {
        memberId: admin2MemberId,
        userId: adminUserId
      })
      expect(result.code).toBe('CANNOT_MODIFY_ADMIN')
    })

    test('admin cannot transferOwnership', async () => {
      const result = await testConvex.mutation<{ code: string }>('testauth:transferOwnershipAsUser', {
        newOwnerId: admin2UserId,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })
  })

test.describe
  .serial('Cross-Org Security', () => {
    let testOrgId: string
    let otherOrgId: string
    let outsiderUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      const slug = generateSlug('cross-org')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Cross Org Test', slug }
      })
      testOrgId = created.orgId

      const otherSlug = generateSlug('other-org')
      const otherOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Other Org', slug: otherSlug }
      })
      otherOrgId = otherOrg.orgId

      const outsiderEmail = `${testPrefix}-outsider@test.local`
      outsiderUserId = (await createTestUser(outsiderEmail, 'Outsider')) ?? ''
      await addTestOrgMember(otherOrgId, outsiderUserId, true)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('non-member cannot see pending invites', async () => {
      const result = await testConvex.query<{ code?: string }>('testauth:pendingInvitesAsUser', {
        orgId: testOrgId,
        userId: outsiderUserId
      })
      expect(result.code).toBe('NOT_ORG_MEMBER')
    })

    test('non-member cannot see join requests', async () => {
      const result = await testConvex.query<{ code?: string }>('testauth:pendingJoinRequestsAsUser', {
        orgId: testOrgId,
        userId: outsiderUserId
      })
      expect(result.code).toBe('NOT_ORG_MEMBER')
    })
  })

test.describe
  .serial('Admin Operations', () => {
    let testOrgId: string
    let testUserId: string
    let adminUserId: string
    let memberUserId: string

    test.beforeAll(async () => {
      await ensureTestUser()
      testUserId = (await testConvex.query<string>('testauth:getTestUser', {})) ?? ''
      const slug = generateSlug('admin-ops')
      const created = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Admin Ops Test Org', slug }
      })
      testOrgId = created.orgId

      const adminEmail = `${testPrefix}-adminops-admin@test.local`
      adminUserId = (await createTestUser(adminEmail, 'Admin Ops Admin')) ?? ''
      await addTestOrgMember(testOrgId, adminUserId, true)

      const memberEmail = `${testPrefix}-adminops-member@test.local`
      memberUserId = (await createTestUser(memberEmail, 'Admin Ops Member')) ?? ''
      await addTestOrgMember(testOrgId, memberUserId, false)
    })

    test.afterAll(async () => {
      await cleanupOrgTestData()
      await cleanupTestUsers()
    })

    test('admin can update org name', async () => {
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateOrgAsUser', {
        data: { name: 'Admin Updated Name' },
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: testOrgId })
      expect(org.name).toBe('Admin Updated Name')
    })

    test('admin can update org slug', async () => {
      const newSlug = generateSlug('admin-updated')
      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:updateOrgAsUser', {
        data: { slug: newSlug },
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
      const org = await testConvex.query<OrgDoc>('org:get', { orgId: testOrgId })
      expect(org.slug).toBe(newSlug)
    })

    test('member cannot update org', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:updateOrgAsUser', {
        data: { name: 'Member Updated Name' },
        orgId: testOrgId,
        userId: memberUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('admin cannot delete org', async () => {
      const result = await testConvex.mutation<{ code?: string }>('testauth:deleteOrgAsUser', {
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.code).toBe('INSUFFICIENT_ORG_ROLE')
    })

    test('admin can remove member', async () => {
      const tempEmail = `${testPrefix}-adminops-temp@test.local`
      const tempUserId = (await createTestUser(tempEmail, 'Temp Member')) ?? ''
      await addTestOrgMember(testOrgId, tempUserId, false)

      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const tempMember = members.find(m => m.userId === tempUserId)
      expect(tempMember).toBeDefined()

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:removeMemberAsUser', {
        memberId: tempMember?.memberId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)
    })

    test('admin can leave org', async () => {
      const leaveAdminEmail = `${testPrefix}-adminops-leave@test.local`
      const leaveAdminId = (await createTestUser(leaveAdminEmail, 'Leave Admin')) ?? ''
      await addTestOrgMember(testOrgId, leaveAdminId, true)

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:leaveOrgAsUser', {
        orgId: testOrgId,
        userId: leaveAdminId
      })
      expect(result.success).toBe(true)

      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === leaveAdminId)
      expect(found).toBeUndefined()
    })

    test('admin creates invite', async () => {
      const result = await testConvex.mutation<{ code?: string; inviteId?: string }>('testauth:inviteAsUser', {
        email: 'admin-invite-test@example.com',
        isAdmin: false,
        orgId: testOrgId,
        userId: adminUserId
      })
      expect(result.inviteId).toBeDefined()
    })

    test('admin approves join request', async () => {
      const requesterEmail = `${testPrefix}-adminops-requester@test.local`
      const requesterId = (await createTestUser(requesterEmail, 'Join Requester')) ?? ''

      const request = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        orgId: testOrgId,
        userId: requesterId
      })
      expect(request.requestId).toBeDefined()

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:approveJoinRequestAsUser', {
        isAdmin: false,
        requestId: request.requestId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)

      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === requesterId)
      expect(found).toBeDefined()
    })

    test('admin rejects join request', async () => {
      const requesterEmail = `${testPrefix}-adminops-rejectee@test.local`
      const requesterId = (await createTestUser(requesterEmail, 'Reject Requester')) ?? ''

      const request = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        orgId: testOrgId,
        userId: requesterId
      })
      expect(request.requestId).toBeDefined()

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:rejectJoinRequestAsUser', {
        requestId: request.requestId,
        userId: adminUserId
      })
      expect(result.success).toBe(true)

      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === requesterId)
      expect(found).toBeUndefined()
    })

    test('approve already-member fails', async () => {
      const alreadyMemberEmail = `${testPrefix}-adminops-alreadymember@test.local`
      const alreadyMemberId = (await createTestUser(alreadyMemberEmail, 'Already Member')) ?? ''
      await addTestOrgMember(testOrgId, alreadyMemberId, false)

      const newOrgSlug = generateSlug('approve-test')
      const newOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Approve Test Org', slug: newOrgSlug }
      })

      const request = await testConvex.mutation<{ code?: string; requestId?: string }>('testauth:requestJoinAsUser', {
        orgId: newOrg.orgId,
        userId: alreadyMemberId
      })
      expect(request.requestId).toBeDefined()

      await addTestOrgMember(newOrg.orgId, alreadyMemberId, false)

      const result = await testConvex.mutation<{ code?: string }>('testauth:approveJoinRequestAsUser', {
        isAdmin: false,
        requestId: request.requestId,
        userId: (await testConvex.query<OrgDoc>('org:get', { orgId: newOrg.orgId })).userId
      })
      expect(result.code).toBe('ALREADY_ORG_MEMBER')
    })

    test('owner removes admin', async () => {
      const removeAdminEmail = `${testPrefix}-adminops-remove-admin@test.local`
      const removeAdminId = (await createTestUser(removeAdminEmail, 'Remove Admin')) ?? ''
      const memberId = await addTestOrgMember(testOrgId, removeAdminId, true)

      const result = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:removeMemberAsUser', {
        memberId,
        userId: testUserId
      })
      expect(result.success).toBe(true)

      const members = await testConvex.query<MemberDoc[]>('org:members', { orgId: testOrgId })
      const found = members.find(m => m.userId === removeAdminId)
      expect(found).toBeUndefined()
    })

    test('last admin leaves - org still functional', async () => {
      const lastAdminOrgSlug = generateSlug('last-admin')
      const lastAdminOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'Last Admin Org', slug: lastAdminOrgSlug }
      })

      const soloAdminEmail = `${testPrefix}-solo-admin@test.local`
      const soloAdminId = (await createTestUser(soloAdminEmail, 'Solo Admin')) ?? ''
      await addTestOrgMember(lastAdminOrg.orgId, soloAdminId, true)

      const leaveResult = await testConvex.mutation<{ code?: string; success?: boolean }>('testauth:leaveOrgAsUser', {
        orgId: lastAdminOrg.orgId,
        userId: soloAdminId
      })
      expect(leaveResult.success).toBe(true)

      const org = await testConvex.query<OrgDoc>('org:get', { orgId: lastAdminOrg.orgId })
      expect(org).toBeDefined()
      expect(org.userId).toBe(testUserId)
    })

    test('invite is single-use', async () => {
      const inviteResult = await testConvex.mutation<{ code?: string; token?: string }>('testauth:inviteAsUser', {
        email: 'single-use@test.local',
        isAdmin: false,
        orgId: testOrgId,
        userId: testUserId
      })
      expect(inviteResult.token).toBeDefined()

      const firstUserEmail = `${testPrefix}-single-use-1@test.local`
      const firstUserId = (await createTestUser(firstUserEmail, 'First User')) ?? ''
      const firstAccept = await testConvex.mutation<{ code?: string; orgId?: string }>('testauth:acceptInviteAsUser', {
        token: inviteResult.token ?? '',
        userId: firstUserId
      })
      expect(firstAccept.orgId).toBe(testOrgId)

      const secondUserEmail = `${testPrefix}-single-use-2@test.local`
      const secondUserId = (await createTestUser(secondUserEmail, 'Second User')) ?? ''
      const secondAccept = await testConvex.mutation<{ code?: string; orgId?: string }>('testauth:acceptInviteAsUser', {
        token: inviteResult.token ?? '',
        userId: secondUserId
      })
      expect(secondAccept.code).toBe('INVALID_INVITE')
    })

    test('myJoinRequest - returns pending request', async () => {
      const myJoinOrgSlug = generateSlug('myjoin')
      const myJoinOrg = await testConvex.mutation<{ orgId: string }>('org:create', {
        data: { name: 'My Join Org', slug: myJoinOrgSlug }
      })

      const requesterEmail = `${testPrefix}-myjoin-requester@test.local`
      const requesterId = (await createTestUser(requesterEmail, 'My Join Requester')) ?? ''

      const requestResult = await testConvex.mutation<{ code?: string; requestId?: string }>(
        'testauth:requestJoinAsUser',
        {
          message: 'I want to join',
          orgId: myJoinOrg.orgId,
          userId: requesterId
        }
      )
      expect(requestResult.requestId).toBeDefined()

      const request = await testConvex.query<{ message?: string; status: string } | null>('testauth:getJoinRequest', {
        requestId: requestResult.requestId
      })
      expect(request).toBeDefined()
      expect(request?.status).toBe('pending')
      expect(request?.message).toBe('I want to join')
    })
  })
