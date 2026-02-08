/* eslint-disable no-await-in-loop, max-statements, @typescript-eslint/max-params */
/** biome-ignore-all lint/performance/noAwaitInLoops: sequential deletes */
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server'

import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'

import type { DataModel, Id, TableNames } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

import { mutation, query } from './_generated/server'

type AuthCtx = GenericActionCtx<DataModel> | GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>

const TEST_EMAIL = 'test@playwright.local',
  BATCH_SIZE = 50,
  // eslint-disable-next-line no-restricted-properties
  isTestMode = process.env.CONVEX_TEST_MODE === 'true',
  getAuthUserIdOrTest = async (ctx: AuthCtx): Promise<Id<'users'> | null> => {
    if (!isTestMode) return getAuthUserId(ctx)
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      const u = await (ctx as GenericQueryCtx<DataModel>).db
        .query('users')
        .filter(q => q.eq(q.field('email'), TEST_EMAIL))
        .first()
      return u?._id ?? null
    }
    return identity.subject.split('|')[0] as Id<'users'>
  },
  getOrgMembership = async (ctx: MutationCtx | QueryCtx, orgId: Id<'org'>, userId: Id<'users'>) => {
    const orgDoc = await ctx.db.get(orgId)
    if (!orgDoc) return null
    const isOwner = orgDoc.userId === userId,
      member = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
        .unique()
    if (!(isOwner || member)) return null
    return { isAdmin: isOwner || (member?.isAdmin ?? false), isOwner, member, orgDoc }
  },
  checkAclPermission = (
    doc: {
      editors?: string[]
      userId?: unknown
    },
    userId: string,
    membership: { isAdmin: boolean }
  ) => {
    const isCreator = doc.userId === userId,
      editors = doc.editors ?? [],
      isEditor = editors.includes(userId)
    return isCreator || membership.isAdmin || isEditor
  },
  checkChildAclPermission = async (
    ctx: MutationCtx | QueryCtx,
    doc: {
      projectId?: unknown
      userId?: unknown
    },
    userId: string,
    membership: { isAdmin: boolean }
  ) => {
    const isCreator = doc.userId === userId
    if (isCreator || membership.isAdmin) return true
    const parentId = doc.projectId as string,
      parent = parentId ? await ctx.db.get(parentId as Id<'project'>) : null,
      editors = parent ? ((parent as { editors?: string[] }).editors ?? []) : []
    return editors.some(eid => eid === userId)
  },
  addEditorToDoc = async <T extends TableNames>(
    ctx: MutationCtx,
    itemId: Id<T>,
    editorId: Id<'users'>,
    orgId: Id<'org'>
  ) => {
    const doc = await ctx.db.get(itemId)
    if (!doc || (doc as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }
    const editors = (doc as { editors?: string[] }).editors ?? [],
      alreadyEditor = editors.some(id => id === editorId)
    if (alreadyEditor) return doc
    await ctx.db.patch(itemId, { editors: [...editors, editorId], updatedAt: Date.now() } as never)
    return ctx.db.get(itemId)
  },
  removeEditorFromDoc = async <T extends TableNames>(
    ctx: MutationCtx,
    itemId: Id<T>,
    editorId: Id<'users'>,
    orgId: Id<'org'>
  ) => {
    const doc = await ctx.db.get(itemId)
    if (!doc || (doc as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }
    const editors = (doc as { editors?: string[] }).editors ?? [],
      filtered: string[] = []
    for (const id of editors) if (id !== editorId) filtered.push(id)
    await ctx.db.patch(itemId, { editors: filtered, updatedAt: Date.now() } as never)
    return ctx.db.get(itemId)
  },
  ensureTestUser = mutation({
    args: {},
    handler: async ctx => {
      if (!isTestMode) return null
      const u = await ctx.db
        .query('users')
        .filter(q => q.eq(q.field('email'), TEST_EMAIL))
        .first()
      if (u) return u._id
      return ctx.db.insert('users', { email: TEST_EMAIL, emailVerificationTime: Date.now(), name: 'Test User' })
    }
  }),
  getTestUser = query({
    args: {},
    handler: async ctx => {
      if (!isTestMode) return null
      const u = await ctx.db
        .query('users')
        .filter(q => q.eq(q.field('email'), TEST_EMAIL))
        .first()
      return u?._id ?? null
    }
  }),
  createTestUser = mutation({
    args: { email: v.string(), name: v.string() },
    handler: async (ctx, { email, name }) => {
      if (!isTestMode) return null
      const existing = await ctx.db
        .query('users')
        .filter(q => q.eq(q.field('email'), email))
        .first()
      if (existing) return existing._id
      return ctx.db.insert('users', { email, emailVerificationTime: Date.now(), name })
    }
  }),
  getTestUserByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, { email }) => {
      if (!isTestMode) return null
      const u = await ctx.db
        .query('users')
        .filter(q => q.eq(q.field('email'), email))
        .first()
      return u?._id ?? null
    }
  }),
  addTestOrgMember = mutation({
    args: { isAdmin: v.boolean(), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { isAdmin, orgId, userId }) => {
      if (!isTestMode) return null
      const existing = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, { isAdmin, updatedAt: Date.now() })
        return existing._id
      }
      return ctx.db.insert('orgMember', {
        isAdmin,
        orgId,
        updatedAt: Date.now(),
        userId
      })
    }
  }),
  removeTestOrgMember = mutation({
    args: { orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { orgId, userId }) => {
      if (!isTestMode) return false
      const member = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
        .unique()
      if (member) {
        await ctx.db.delete(member._id)
        return true
      }
      return false
    }
  }),
  bulkDelete = async (ctx: MutationCtx, table: TableNames) => {
    const docs = await ctx.db.query(table).take(BATCH_SIZE)
    for (const d of docs) await ctx.db.delete(d._id)
    return docs.length
  },
  bulkDeleteFiltered = async <T extends TableNames>(
    ctx: MutationCtx,
    table: T,
    filterFn: (doc: { _id: Id<T> }) => boolean
  ) => {
    const docs = await ctx.db.query(table).take(BATCH_SIZE * 2)
    let count = 0
    for (const d of docs)
      if (filterFn(d as { _id: Id<T> })) {
        await ctx.db.delete(d._id)
        count += 1
      }

    return count
  },
  cleanupTestData = mutation({
    args: {},
    handler: async ctx => {
      if (!isTestMode) return { count: 0, done: true }
      const u = await ctx.db
        .query('users')
        .filter(q => q.eq(q.field('email'), TEST_EMAIL))
        .first()
      if (!u) return { count: 0, done: true }
      const count = (await bulkDelete(ctx, 'message')) + (await bulkDelete(ctx, 'chat')) + (await bulkDelete(ctx, 'blog'))
      return { count, done: count < BATCH_SIZE }
    }
  }),
  getOrgsBySlugPrefix = async (ctx: QueryCtx, prefix: string) => {
    const orgs = await ctx.db.query('org').collect(),
      result: Id<'org'>[] = []
    for (const o of orgs) if (o.slug.startsWith(prefix)) result.push(o._id)
    return result
  },
  cleanupOrgTestData = mutation({
    args: { slugPrefix: v.string() },
    handler: async (ctx, { slugPrefix }) => {
      if (!isTestMode) return { count: 0, done: true }
      const orgIds = await getOrgsBySlugPrefix(ctx, slugPrefix)
      if (orgIds.length === 0) return { count: 0, done: true }
      let count = 0
      for (const orgId of orgIds) {
        count += await bulkDeleteFiltered(ctx, 'task', d => {
          const doc = d as unknown as { orgId?: Id<'org'> }
          return doc.orgId === orgId
        })
        count += await bulkDeleteFiltered(ctx, 'project', d => {
          const doc = d as unknown as { orgId?: Id<'org'> }
          return doc.orgId === orgId
        })
        count += await bulkDeleteFiltered(ctx, 'orgJoinRequest', d => {
          const doc = d as unknown as { orgId?: Id<'org'> }
          return doc.orgId === orgId
        })
        count += await bulkDeleteFiltered(ctx, 'orgInvite', d => {
          const doc = d as unknown as { orgId?: Id<'org'> }
          return doc.orgId === orgId
        })
        count += await bulkDeleteFiltered(ctx, 'orgMember', d => {
          const doc = d as unknown as { orgId?: Id<'org'> }
          return doc.orgId === orgId
        })
        await ctx.db.delete(orgId)
        count += 1
      }
      return { count, done: true }
    }
  }),
  cleanupTestUsers = mutation({
    args: { emailPrefix: v.string() },
    handler: async (ctx, { emailPrefix }) => {
      if (!isTestMode) return { count: 0 }
      const users = await ctx.db.query('users').collect()
      let count = 0
      for (const u of users)
        if (u.email?.startsWith(emailPrefix) && u.email !== TEST_EMAIL) {
          await ctx.db.delete(u._id)
          count += 1
        }

      return { count }
    }
  }),
  acceptInviteAsUser = mutation({
    args: { token: v.string(), userId: v.id('users') },
    handler: async (ctx, { token, userId }) => {
      if (!isTestMode) return null
      const inviteDoc = await ctx.db
        .query('orgInvite')
        .withIndex('by_token', o => o.eq('token', token))
        .unique()
      if (!inviteDoc) return { code: 'INVALID_INVITE' }
      if (inviteDoc.expiresAt < Date.now()) return { code: 'INVITE_EXPIRED' }

      const orgDoc = await ctx.db.get(inviteDoc.orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }
      if (orgDoc.userId === userId) return { code: 'ALREADY_ORG_MEMBER' }

      const existingMember = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', inviteDoc.orgId).eq('userId', userId))
        .unique()
      if (existingMember) return { code: 'ALREADY_ORG_MEMBER' }

      const pendingRequest = await ctx.db
        .query('orgJoinRequest')
        .withIndex('by_org_status', o => o.eq('orgId', inviteDoc.orgId).eq('status', 'pending'))
        .filter(o => o.eq(o.field('userId'), userId))
        .unique()
      if (pendingRequest) await ctx.db.patch(pendingRequest._id, { status: 'approved' as const })

      await ctx.db.insert('orgMember', {
        isAdmin: inviteDoc.isAdmin,
        orgId: inviteDoc.orgId,
        updatedAt: Date.now(),
        userId
      })

      await ctx.db.delete(inviteDoc._id)

      return { orgId: inviteDoc.orgId }
    }
  }),
  requestJoinAsUser = mutation({
    args: { message: v.optional(v.string()), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { message, orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }
      if (orgDoc.userId === userId) return { code: 'ALREADY_ORG_MEMBER' }

      const existingMember = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
        .unique()
      if (existingMember) return { code: 'ALREADY_ORG_MEMBER' }

      const existingRequest = await ctx.db
        .query('orgJoinRequest')
        .withIndex('by_org_status', o => o.eq('orgId', orgId).eq('status', 'pending'))
        .filter(o => o.eq(o.field('userId'), userId))
        .unique()
      if (existingRequest) return { code: 'JOIN_REQUEST_EXISTS' }

      const requestId = await ctx.db.insert('orgJoinRequest', {
        message,
        orgId,
        status: 'pending',
        userId
      })

      return { requestId }
    }
  }),
  cancelJoinRequestAsUser = mutation({
    args: { requestId: v.id('orgJoinRequest'), userId: v.id('users') },
    handler: async (ctx, { requestId, userId }) => {
      if (!isTestMode) return null
      const requestDoc = await ctx.db.get(requestId)
      if (!requestDoc) return { code: 'NOT_FOUND' }
      if (requestDoc.userId !== userId) return { code: 'FORBIDDEN' }
      if (requestDoc.status !== 'pending') return { code: 'NOT_FOUND' }

      await ctx.db.delete(requestId)
      return { success: true }
    }
  }),
  inviteAsUser = mutation({
    args: { email: v.string(), isAdmin: v.boolean(), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { email, isAdmin, orgId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let token = ''
      for (let i = 0; i < 32; i += 1) token += chars.charAt(Math.floor(Math.random() * chars.length))

      const inviteId = await ctx.db.insert('orgInvite', {
        email,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        isAdmin,
        orgId,
        token
      })

      return { inviteId, token }
    }
  }),
  setAdminAsUser = mutation({
    args: { isAdmin: v.boolean(), memberId: v.id('orgMember'), userId: v.id('users') },
    handler: async (ctx, { isAdmin, memberId, userId }) => {
      if (!isTestMode) return null
      const memberDoc = await ctx.db.get(memberId)
      if (!memberDoc) return { code: 'NOT_FOUND' }
      const orgDoc = await ctx.db.get(memberDoc.orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }
      if (orgDoc.userId !== userId) return { code: 'INSUFFICIENT_ORG_ROLE' }
      if (memberDoc.userId === orgDoc.userId) return { code: 'CANNOT_MODIFY_OWNER' }
      await ctx.db.patch(memberId, { isAdmin, updatedAt: Date.now() })
      return { success: true }
    }
  }),
  removeMemberAsUser = mutation({
    args: { memberId: v.id('orgMember'), userId: v.id('users') },
    handler: async (ctx, { memberId, userId }) => {
      if (!isTestMode) return null
      const memberDoc = await ctx.db.get(memberId)
      if (!memberDoc) return { code: 'NOT_FOUND' }
      const membership = await getOrgMembership(ctx, memberDoc.orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (memberDoc.userId === membership.orgDoc.userId) return { code: 'CANNOT_MODIFY_OWNER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
      if (!membership.isOwner && memberDoc.isAdmin) return { code: 'CANNOT_MODIFY_ADMIN' }

      await ctx.db.delete(memberId)
      return { success: true }
    }
  }),
  transferOwnershipAsUser = mutation({
    args: { newOwnerId: v.id('users'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { newOwnerId, orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }
      if (orgDoc.userId !== userId) return { code: 'INSUFFICIENT_ORG_ROLE' }

      const targetMember = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', newOwnerId))
        .unique()
      if (!targetMember) return { code: 'NOT_ORG_MEMBER' }
      if (!targetMember.isAdmin) return { code: 'TARGET_MUST_BE_ADMIN' }

      await ctx.db.patch(orgId, { updatedAt: Date.now(), userId: newOwnerId })
      await ctx.db.delete(targetMember._id)
      await ctx.db.insert('orgMember', {
        isAdmin: true,
        orgId,
        updatedAt: Date.now(),
        userId
      })
      return { success: true }
    }
  }),
  updateOrgAsUser = mutation({
    args: {
      data: v.object({ name: v.optional(v.string()), slug: v.optional(v.string()) }),
      orgId: v.id('org'),
      userId: v.id('users')
    },
    handler: async (ctx, { data, orgId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      if (data.slug !== undefined) {
        const { slug } = data,
          existing = await ctx.db
            .query('org')
            .withIndex('by_slug', q => q.eq('slug', slug))
            .unique()
        if (existing && existing._id !== orgId) return { code: 'ORG_SLUG_TAKEN' }
      }

      await ctx.db.patch(orgId, { ...data, updatedAt: Date.now() })
      return { success: true }
    }
  }),
  deleteOrgAsUser = mutation({
    args: { orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }
      if (orgDoc.userId !== userId) return { code: 'INSUFFICIENT_ORG_ROLE' }

      const tasks = await ctx.db
        .query('task')
        .filter(q => q.eq(q.field('orgId' as never), orgId))
        .collect()
      for (const t of tasks) await ctx.db.delete(t._id)

      const projects = await ctx.db
        .query('project')
        .withIndex('by_org', q => q.eq('orgId' as never, orgId as never))
        .collect()
      for (const p of projects) await ctx.db.delete(p._id)

      const requests = await ctx.db
        .query('orgJoinRequest')
        .withIndex('by_org', q => q.eq('orgId', orgId))
        .collect()
      for (const r of requests) await ctx.db.delete(r._id)

      const invites = await ctx.db
        .query('orgInvite')
        .withIndex('by_org', q => q.eq('orgId', orgId))
        .collect()
      for (const i of invites) await ctx.db.delete(i._id)

      const members = await ctx.db
        .query('orgMember')
        .withIndex('by_org', q => q.eq('orgId', orgId))
        .collect()
      for (const m of members) await ctx.db.delete(m._id)

      await ctx.db.delete(orgId)
      return { success: true }
    }
  }),
  leaveOrgAsUser = mutation({
    args: { orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }
      if (orgDoc.userId === userId) return { code: 'MUST_TRANSFER_OWNERSHIP' }

      const member = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
        .unique()
      if (!member) return { code: 'NOT_ORG_MEMBER' }

      await ctx.db.delete(member._id)
      return { success: true }
    }
  }),
  approveJoinRequestAsUser = mutation({
    args: { isAdmin: v.boolean(), requestId: v.id('orgJoinRequest'), userId: v.id('users') },
    handler: async (ctx, { isAdmin, requestId, userId }) => {
      if (!isTestMode) return null
      const request = await ctx.db.get(requestId)
      if (request?.status !== 'pending') return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, request.orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      const existingMember = await ctx.db
        .query('orgMember')
        .withIndex('by_org_user', q => q.eq('orgId', request.orgId).eq('userId', request.userId))
        .unique()
      if (existingMember) return { code: 'ALREADY_ORG_MEMBER' }

      await ctx.db.patch(requestId, { status: 'approved' })
      await ctx.db.insert('orgMember', {
        isAdmin,
        orgId: request.orgId,
        updatedAt: Date.now(),
        userId: request.userId
      })
      return { success: true }
    }
  }),
  rejectJoinRequestAsUser = mutation({
    args: { requestId: v.id('orgJoinRequest'), userId: v.id('users') },
    handler: async (ctx, { requestId, userId }) => {
      if (!isTestMode) return null
      const request = await ctx.db.get(requestId)
      if (request?.status !== 'pending') return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, request.orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      await ctx.db.patch(requestId, { status: 'rejected' })
      return { success: true }
    }
  }),
  pendingInvitesAsUser = query({
    args: { orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { orgId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      return ctx.db
        .query('orgInvite')
        .withIndex('by_org', o => o.eq('orgId', orgId))
        .collect()
    }
  }),
  pendingJoinRequestsAsUser = query({
    args: { orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { orgId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      return ctx.db
        .query('orgJoinRequest')
        .withIndex('by_org_status', o => o.eq('orgId', orgId).eq('status', 'pending'))
        .collect()
    }
  }),
  createExpiredInvite = mutation({
    args: { email: v.string(), isAdmin: v.boolean(), orgId: v.id('org') },
    handler: async (ctx, { email, isAdmin, orgId }) => {
      if (!isTestMode) return null
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let token = ''
      for (let i = 0; i < 32; i += 1) token += chars.charAt(Math.floor(Math.random() * chars.length))

      const inviteId = await ctx.db.insert('orgInvite', {
        email,
        expiresAt: Date.now() - 1000,
        isAdmin,
        orgId,
        token
      })

      return { inviteId, token }
    }
  }),
  createProjectAsUser = mutation({
    args: { name: v.string(), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { name, orgId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      return ctx.db.insert('project', { name, orgId, updatedAt: Date.now(), userId } as never)
    }
  }),
  updateProjectAsUser = mutation({
    args: { id: v.id('project'), name: v.optional(v.string()), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, name, orgId, userId }) => {
      if (!isTestMode) return null
      const project = await ctx.db.get(id)
      if (!project || (project as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      if (
        !checkAclPermission(
          project as {
            editors?: string[]
            userId?: unknown
          },
          userId,
          membership
        )
      )
        return { code: 'FORBIDDEN' }
      if (name) await ctx.db.patch(id, { name, updatedAt: Date.now() } as never)
      return { success: true }
    }
  }),
  deleteProjectAsUser = mutation({
    args: { id: v.id('project'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, orgId, userId }) => {
      if (!isTestMode) return null
      const project = await ctx.db.get(id)
      if (!project || (project as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      if (
        !checkAclPermission(
          project as {
            editors?: string[]
            userId?: unknown
          },
          userId,
          membership
        )
      )
        return { code: 'FORBIDDEN' }

      const tasks = await ctx.db
        .query('task')
        .withIndex('by_parent', q => q.eq('projectId' as never, id as never))
        .collect()
      for (const t of tasks) await ctx.db.delete(t._id)

      await ctx.db.delete(id)
      return { success: true }
    }
  }),
  toggleTaskAsUser = mutation({
    args: { id: v.id('task'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, orgId, userId }) => {
      if (!isTestMode) return null
      const task = await ctx.db.get(id)
      if (!task || (task as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      const hasPermission = await checkChildAclPermission(
        ctx,
        task as {
          projectId?: unknown
          userId?: unknown
        },
        userId,
        membership
      )
      if (!hasPermission) return { code: 'FORBIDDEN' }

      await ctx.db.patch(id, { completed: !(task as { completed?: boolean }).completed, updatedAt: Date.now() } as never)
      return ctx.db.get(id)
    }
  }),
  assignTaskAsUser = mutation({
    args: { assigneeId: v.optional(v.id('users')), id: v.id('task'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { assigneeId, id, orgId, userId }) => {
      if (!isTestMode) return null
      const task = await ctx.db.get(id)
      if (!task || (task as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      if (assigneeId) {
        const assigneeMembership = await getOrgMembership(ctx, orgId, assigneeId)
        if (!assigneeMembership) return { code: 'NOT_ORG_MEMBER' }
      }

      await ctx.db.patch(id, { assigneeId: assigneeId ?? null, updatedAt: Date.now() } as never)
      return ctx.db.get(id)
    }
  }),
  bulkRmProjectAsUser = mutation({
    args: { ids: v.array(v.id('project')), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { ids, orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }

      const isOwner = orgDoc.userId === userId,
        member = await ctx.db
          .query('orgMember')
          .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
          .unique()
      if (!(isOwner || member)) return { code: 'NOT_ORG_MEMBER' }
      if (!(isOwner || member?.isAdmin)) return { code: 'INSUFFICIENT_ORG_ROLE' }

      let count = 0
      for (const id of ids) {
        const project = await ctx.db.get(id)
        if (project && (project as { orgId?: unknown }).orgId === orgId) {
          const tasks = await ctx.db
            .query('task')
            .withIndex('by_parent', q => q.eq('projectId' as never, id as never))
            .collect()
          for (const t of tasks) await ctx.db.delete(t._id)
          await ctx.db.delete(id)
          count += 1
        }
      }
      return { count }
    }
  }),
  bulkRmTaskAsUser = mutation({
    args: { ids: v.array(v.id('task')), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { ids, orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }

      const isOwner = orgDoc.userId === userId,
        member = await ctx.db
          .query('orgMember')
          .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
          .unique()
      if (!(isOwner || member)) return { code: 'NOT_ORG_MEMBER' }
      if (!(isOwner || member?.isAdmin)) return { code: 'INSUFFICIENT_ORG_ROLE' }

      let count = 0
      for (const id of ids) {
        const task = await ctx.db.get(id)
        if (task && (task as { orgId?: unknown }).orgId === orgId) {
          await ctx.db.delete(id)
          count += 1
        }
      }
      return { count }
    }
  }),
  bulkUpdateTaskAsUser = mutation({
    args: {
      data: v.object({ priority: v.optional(v.string()) }),
      ids: v.array(v.id('task')),
      orgId: v.id('org'),
      userId: v.id('users')
    },
    handler: async (ctx, { data, ids, orgId, userId }) => {
      if (!isTestMode) return null
      const orgDoc = await ctx.db.get(orgId)
      if (!orgDoc) return { code: 'NOT_FOUND' }

      const isOwner = orgDoc.userId === userId,
        member = await ctx.db
          .query('orgMember')
          .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
          .unique()
      if (!(isOwner || member)) return { code: 'NOT_ORG_MEMBER' }
      if (!(isOwner || member?.isAdmin)) return { code: 'INSUFFICIENT_ORG_ROLE' }

      let count = 0
      for (const id of ids) {
        const task = await ctx.db.get(id)
        if (task && (task as { orgId?: unknown }).orgId === orgId) {
          await ctx.db.patch(id, { ...data, updatedAt: Date.now() } as never)
          count += 1
        }
      }
      return { count }
    }
  }),
  getJoinRequest = query({
    args: { requestId: v.id('orgJoinRequest') },
    handler: async (ctx, { requestId }) => {
      if (!isTestMode) return null
      return ctx.db.get(requestId)
    }
  }),
  updateTaskAsUser = mutation({
    args: {
      id: v.id('task'),
      orgId: v.id('org'),
      title: v.optional(v.string()),
      userId: v.id('users')
    },
    handler: async (ctx, { id, orgId, title, userId }) => {
      if (!isTestMode) return null
      const task = await ctx.db.get(id)
      if (!task || (task as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      const hasPermission = await checkChildAclPermission(
        ctx,
        task as {
          projectId?: unknown
          userId?: unknown
        },
        userId,
        membership
      )
      if (!hasPermission) return { code: 'FORBIDDEN' }

      if (title) await ctx.db.patch(id, { title, updatedAt: Date.now() } as never)
      return { success: true }
    }
  }),
  rmTaskAsUser = mutation({
    args: { id: v.id('task'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, orgId, userId }) => {
      if (!isTestMode) return null
      const task = await ctx.db.get(id)
      if (!task || (task as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      const hasPermission = await checkChildAclPermission(
        ctx,
        task as {
          projectId?: unknown
          userId?: unknown
        },
        userId,
        membership
      )
      if (!hasPermission) return { code: 'FORBIDDEN' }

      await ctx.db.delete(id)
      return { success: true }
    }
  }),
  listProjectsAsUser = query({
    args: { orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { orgId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      return ctx.db
        .query('project')
        .withIndex('by_org', q => q.eq('orgId' as never, orgId as never))
        .collect()
    }
  }),
  addEditorAsUser = mutation({
    args: { editorId: v.id('users'), orgId: v.id('org'), projectId: v.id('project'), userId: v.id('users') },
    handler: async (ctx, { editorId, orgId, projectId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      return addEditorToDoc(ctx, projectId, editorId, orgId)
    }
  }),
  removeEditorAsUser = mutation({
    args: { editorId: v.id('users'), orgId: v.id('org'), projectId: v.id('project'), userId: v.id('users') },
    handler: async (ctx, { editorId, orgId, projectId, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      return removeEditorFromDoc(ctx, projectId, editorId, orgId)
    }
  }),
  updateProjectAsEditorUser = mutation({
    args: { id: v.id('project'), name: v.optional(v.string()), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, name, orgId, userId }) => {
      if (!isTestMode) return null
      const project = await ctx.db.get(id)
      if (!project || (project as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      if (
        !checkAclPermission(
          project as {
            editors?: string[]
            userId?: unknown
          },
          userId,
          membership
        )
      )
        return { code: 'FORBIDDEN' }

      if (name) await ctx.db.patch(id, { name, updatedAt: Date.now() } as never)
      return { success: true }
    }
  }),
  toggleTaskAsEditorUser = mutation({
    args: { id: v.id('task'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, orgId, userId }) => {
      if (!isTestMode) return null
      const task = await ctx.db.get(id)
      if (!task || (task as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      const hasPermission = await checkChildAclPermission(
        ctx,
        task as {
          projectId?: unknown
          userId?: unknown
        },
        userId,
        membership
      )
      if (!hasPermission) return { code: 'FORBIDDEN' }

      await ctx.db.patch(id, { completed: !(task as { completed?: boolean }).completed, updatedAt: Date.now() } as never)
      return ctx.db.get(id)
    }
  }),
  getProjectEditors = query({
    args: { orgId: v.id('org'), projectId: v.id('project') },
    handler: async (ctx, { orgId, projectId }) => {
      if (!isTestMode) return null
      const project = await ctx.db.get(projectId)
      if (!project || (project as { orgId?: unknown }).orgId !== orgId) return []
      return (project as { editors?: string[] }).editors ?? []
    }
  }),
  createWikiAsUser = mutation({
    args: {
      content: v.optional(v.string()),
      orgId: v.id('org'),
      slug: v.string(),
      status: v.string(),
      title: v.string(),
      userId: v.id('users')
    },
    handler: async (ctx, { content, orgId, slug, status, title, userId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      return ctx.db.insert('wiki', { content, orgId, slug, status, title, updatedAt: Date.now(), userId } as never)
    }
  }),
  updateWikiAsUser = mutation({
    args: {
      id: v.id('wiki'),
      orgId: v.id('org'),
      title: v.optional(v.string()),
      userId: v.id('users')
    },
    handler: async (ctx, { id, orgId, title, userId }) => {
      if (!isTestMode) return null
      const wiki = await ctx.db.get(id)
      if (!wiki || (wiki as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      if (
        !checkAclPermission(
          wiki as {
            editors?: string[]
            userId?: unknown
          },
          userId,
          membership
        )
      )
        return { code: 'FORBIDDEN' }

      if (title) await ctx.db.patch(id, { title, updatedAt: Date.now() } as never)
      return { success: true }
    }
  }),
  deleteWikiAsUser = mutation({
    args: { id: v.id('wiki'), orgId: v.id('org'), userId: v.id('users') },
    handler: async (ctx, { id, orgId, userId }) => {
      if (!isTestMode) return null
      const wiki = await ctx.db.get(id)
      if (!wiki || (wiki as { orgId?: unknown }).orgId !== orgId) return { code: 'NOT_FOUND' }

      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }

      if (
        !checkAclPermission(
          wiki as {
            editors?: string[]
            userId?: unknown
          },
          userId,
          membership
        )
      )
        return { code: 'FORBIDDEN' }

      await ctx.db.delete(id)
      return { success: true }
    }
  }),
  addWikiEditorAsUser = mutation({
    args: { editorId: v.id('users'), orgId: v.id('org'), userId: v.id('users'), wikiId: v.id('wiki') },
    handler: async (ctx, { editorId, orgId, userId, wikiId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      return addEditorToDoc(ctx, wikiId, editorId, orgId)
    }
  }),
  removeWikiEditorAsUser = mutation({
    args: { editorId: v.id('users'), orgId: v.id('org'), userId: v.id('users'), wikiId: v.id('wiki') },
    handler: async (ctx, { editorId, orgId, userId, wikiId }) => {
      if (!isTestMode) return null
      const membership = await getOrgMembership(ctx, orgId, userId)
      if (!membership) return { code: 'NOT_ORG_MEMBER' }
      if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }

      return removeEditorFromDoc(ctx, wikiId, editorId, orgId)
    }
  })

export {
  acceptInviteAsUser,
  addEditorAsUser,
  addTestOrgMember,
  addWikiEditorAsUser,
  approveJoinRequestAsUser,
  assignTaskAsUser,
  bulkRmProjectAsUser,
  bulkRmTaskAsUser,
  bulkUpdateTaskAsUser,
  cancelJoinRequestAsUser,
  cleanupOrgTestData,
  cleanupTestData,
  cleanupTestUsers,
  createExpiredInvite,
  createProjectAsUser,
  createTestUser,
  createWikiAsUser,
  deleteOrgAsUser,
  deleteProjectAsUser,
  deleteWikiAsUser,
  ensureTestUser,
  getAuthUserIdOrTest,
  getJoinRequest,
  getProjectEditors,
  getTestUser,
  getTestUserByEmail,
  inviteAsUser,
  isTestMode,
  leaveOrgAsUser,
  listProjectsAsUser,
  pendingInvitesAsUser,
  pendingJoinRequestsAsUser,
  rejectJoinRequestAsUser,
  removeEditorAsUser,
  removeMemberAsUser,
  removeTestOrgMember,
  removeWikiEditorAsUser,
  requestJoinAsUser,
  rmTaskAsUser,
  setAdminAsUser,
  TEST_EMAIL,
  toggleTaskAsEditorUser,
  toggleTaskAsUser,
  transferOwnershipAsUser,
  updateOrgAsUser,
  updateProjectAsEditorUser,
  updateProjectAsUser,
  updateTaskAsUser,
  updateWikiAsUser
}
