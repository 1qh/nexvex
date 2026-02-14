/* eslint-disable no-await-in-loop, max-depth, max-statements, @typescript-eslint/max-params, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing */
/** biome-ignore-all lint/performance/noAwaitInLoops: sequential deletes */
import type { GenericDataModel, MutationBuilder, QueryBuilder } from 'convex/server'

import { v } from 'convex/values'

import type { DbLike, FilterLike, IndexLike, Rec } from './types'

interface TestAuthConfig<DM extends GenericDataModel = GenericDataModel> {
  getAuthUserId: (ctx: unknown) => Promise<null | string>
  mutation: MutationBuilder<DM, 'public'>
  query: QueryBuilder<DM, 'public'>
}

const TEST_EMAIL = 'test@playwright.local',
  BATCH_SIZE = 50,
  isTestMode = () => process.env.CONVEX_TEST_MODE === 'true',
  generateToken = () => {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    let token = ''
    for (const b of bytes) token += b.toString(36).padStart(2, '0').slice(0, 2)
    return token.slice(0, 32)
  },
  getOrgMembership = async (db: DbLike, orgId: string, userId: string) => {
    const orgDoc = await db.get(orgId)
    if (!orgDoc) return null
    const isOwner = orgDoc.userId === userId,
      member = await db
        .query('orgMember')
        .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', userId)) as never)
        .unique()
    if (!(isOwner || member)) return null
    return { isAdmin: isOwner || member?.isAdmin === true, isOwner, member, orgDoc }
  },
  makeTestAuth = <DM extends GenericDataModel>(config: TestAuthConfig<DM>) => {
    const { mutation: rawMut, query: rawQry } = config,
      mutation = rawMut as unknown as (opts: Rec) => Rec,
      query = rawQry as unknown as (opts: Rec) => Rec,
      getAuthUserIdOrTest = async (ctx: unknown): Promise<null | string> => {
        if (!isTestMode()) return config.getAuthUserId(ctx)
        const c = ctx as { auth: { getUserIdentity: () => Promise<unknown> }; db: DbLike },
          identity = await c.auth.getUserIdentity()
        if (identity === null) {
          const u = await c.db
            .query('users')
            .filter(((q: FilterLike) => q.eq(q.field('email'), TEST_EMAIL)) as never)
            .first()
          return u?._id as null | string
        }
        return ((identity as Rec).subject as string).split('|')[0] ?? null
      },
      ensureTestUser = mutation({
        args: {},
        handler: async (ctx: { db: DbLike }) => {
          if (!isTestMode()) return null
          const u = await ctx.db
            .query('users')
            .filter(((q: FilterLike) => q.eq(q.field('email'), TEST_EMAIL)) as never)
            .first()
          if (u) return u._id
          return ctx.db.insert('users', {
            email: TEST_EMAIL,
            emailVerificationTime: Date.now(),
            name: 'Test User'
          })
        }
      }),
      getTestUser = query({
        args: {},
        handler: async (ctx: { db: DbLike }) => {
          if (!isTestMode()) return null
          const u = await ctx.db
            .query('users')
            .filter(((q: FilterLike) => q.eq(q.field('email'), TEST_EMAIL)) as never)
            .first()
          return u?._id ?? null
        }
      }),
      createTestUser = mutation({
        args: { email: v.string(), name: v.string() },
        handler: async (ctx: { db: DbLike }, { email, name }: { email: string; name: string }) => {
          if (!isTestMode()) return null
          const existing = await ctx.db
            .query('users')
            .filter(((q: FilterLike) => q.eq(q.field('email'), email)) as never)
            .first()
          if (existing) return existing._id
          return ctx.db.insert('users', { email, emailVerificationTime: Date.now(), name })
        }
      }),
      getTestUserByEmail = query({
        args: { email: v.string() },
        handler: async (ctx: { db: DbLike }, { email }: { email: string }) => {
          if (!isTestMode()) return null
          const u = await ctx.db
            .query('users')
            .filter(((q: FilterLike) => q.eq(q.field('email'), email)) as never)
            .first()
          return u?._id ?? null
        }
      }),
      addTestOrgMember = mutation({
        args: { isAdmin: v.boolean(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { isAdmin, orgId, userId }: { isAdmin: boolean; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const existing = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', userId)) as never)
            .unique()
          if (existing) {
            await ctx.db.patch(existing._id as string, { isAdmin, updatedAt: Date.now() })
            return existing._id
          }
          return ctx.db.insert('orgMember', { isAdmin, orgId, updatedAt: Date.now(), userId })
        }
      }),
      removeTestOrgMember = mutation({
        args: { orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { orgId, userId }: { orgId: string; userId: string }) => {
          if (!isTestMode()) return false
          const member = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', userId)) as never)
            .unique()
          if (member) {
            await ctx.db.delete(member._id as string)
            return true
          }
          return false
        }
      }),
      cleanupTestUsers = mutation({
        args: { emailPrefix: v.string() },
        handler: async (ctx: { db: DbLike }, { emailPrefix }: { emailPrefix: string }) => {
          if (!isTestMode()) return { count: 0 }
          const users = await ctx.db.query('users').collect()
          let count = 0
          for (const u of users)
            if ((u.email as string)?.startsWith(emailPrefix) && u.email !== TEST_EMAIL) {
              await ctx.db.delete(u._id as string)
              count += 1
            }
          return { count }
        }
      }),
      cleanupOrgTestData = mutation({
        args: { slugPrefix: v.string(), tables: v.optional(v.array(v.string())) },
        handler: async (ctx: { db: DbLike }, { slugPrefix, tables }: { slugPrefix: string; tables?: string[] }) => {
          if (!isTestMode()) return { count: 0, done: true }
          const allOrgs = await ctx.db.query('org').collect(),
            orgIds: string[] = []
          for (const o of allOrgs) if ((o.slug as string).startsWith(slugPrefix)) orgIds.push(o._id as string)
          if (orgIds.length === 0) return { count: 0, done: true }
          let count = 0
          for (const orgId of orgIds) {
            if (tables)
              for (const table of tables) {
                const docs = await ctx.db.query(table).take(BATCH_SIZE * 2)
                for (const d of docs)
                  if (d.orgId === orgId) {
                    await ctx.db.delete(d._id as string)
                    count += 1
                  }
              }

            const requests = await ctx.db
              .query('orgJoinRequest')
              .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
              .collect()
            for (const r of requests) {
              await ctx.db.delete(r._id as string)
              count += 1
            }
            const invites = await ctx.db
              .query('orgInvite')
              .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
              .collect()
            for (const i of invites) {
              await ctx.db.delete(i._id as string)
              count += 1
            }
            const members = await ctx.db
              .query('orgMember')
              .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
              .collect()
            for (const m of members) {
              await ctx.db.delete(m._id as string)
              count += 1
            }
            await ctx.db.delete(orgId)
            count += 1
          }
          return { count, done: true }
        }
      }),
      inviteAsUser = mutation({
        args: { email: v.string(), isAdmin: v.boolean(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { email, isAdmin, orgId, userId }: { email: string; isAdmin: boolean; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          const token = generateToken(),
            inviteId = await ctx.db.insert('orgInvite', {
              email,
              expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
              isAdmin,
              orgId,
              token
            })
          return { inviteId, token }
        }
      }),
      acceptInviteAsUser = mutation({
        args: { token: v.string(), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { token, userId }: { token: string; userId: string }) => {
          if (!isTestMode()) return null
          const inviteDoc = await ctx.db
            .query('orgInvite')
            .withIndex('by_token', ((q: IndexLike) => q.eq('token', token)) as never)
            .unique()
          if (!inviteDoc) return { code: 'INVALID_INVITE' }
          if ((inviteDoc.expiresAt as number) < Date.now()) return { code: 'INVITE_EXPIRED' }
          const orgDoc = await ctx.db.get(inviteDoc.orgId as string)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          if (orgDoc.userId === userId) return { code: 'ALREADY_ORG_MEMBER' }
          const existingMember = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', inviteDoc.orgId).eq('userId', userId)) as never)
            .unique()
          if (existingMember) return { code: 'ALREADY_ORG_MEMBER' }
          const pendingRequest = await ctx.db
            .query('orgJoinRequest')
            .withIndex('by_org_status', ((q: IndexLike) =>
              q.eq('orgId', inviteDoc.orgId).eq('status', 'pending')) as never)
            .filter(((q: FilterLike) => q.eq(q.field('userId'), userId)) as never)
            .unique()
          if (pendingRequest) await ctx.db.patch(pendingRequest._id as string, { status: 'approved' as const })
          await ctx.db.insert('orgMember', {
            isAdmin: inviteDoc.isAdmin,
            orgId: inviteDoc.orgId,
            updatedAt: Date.now(),
            userId
          })
          await ctx.db.delete(inviteDoc._id as string)
          return { orgId: inviteDoc.orgId }
        }
      }),
      setAdminAsUser = mutation({
        args: { isAdmin: v.boolean(), memberId: v.id('orgMember'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { isAdmin, memberId, userId }: { isAdmin: boolean; memberId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const memberDoc = await ctx.db.get(memberId)
          if (!memberDoc) return { code: 'NOT_FOUND' }
          const orgDoc = await ctx.db.get(memberDoc.orgId as string)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          if (orgDoc.userId !== userId) return { code: 'INSUFFICIENT_ORG_ROLE' }
          if (memberDoc.userId === orgDoc.userId) return { code: 'CANNOT_MODIFY_OWNER' }
          await ctx.db.patch(memberId, { isAdmin, updatedAt: Date.now() })
          return { success: true }
        }
      }),
      removeMemberAsUser = mutation({
        args: { memberId: v.id('orgMember'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { memberId, userId }: { memberId: string; userId: string }) => {
          if (!isTestMode()) return null
          const memberDoc = await ctx.db.get(memberId)
          if (!memberDoc) return { code: 'NOT_FOUND' }
          const membership = await getOrgMembership(ctx.db, memberDoc.orgId as string, userId)
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
        handler: async (
          ctx: { db: DbLike },
          { newOwnerId, orgId, userId }: { newOwnerId: string; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const orgDoc = await ctx.db.get(orgId)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          if (orgDoc.userId !== userId) return { code: 'INSUFFICIENT_ORG_ROLE' }
          const targetMember = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', newOwnerId)) as never)
            .unique()
          if (!targetMember) return { code: 'NOT_ORG_MEMBER' }
          if (!targetMember.isAdmin) return { code: 'TARGET_MUST_BE_ADMIN' }
          await ctx.db.patch(orgId, { updatedAt: Date.now(), userId: newOwnerId })
          await ctx.db.delete(targetMember._id as string)
          await ctx.db.insert('orgMember', { isAdmin: true, orgId, updatedAt: Date.now(), userId })
          return { success: true }
        }
      }),
      updateOrgAsUser = mutation({
        args: {
          data: v.object({ name: v.optional(v.string()), slug: v.optional(v.string()) }),
          orgId: v.id('org'),
          userId: v.id('users')
        },
        handler: async (
          ctx: { db: DbLike },
          { data, orgId, userId }: { data: { name?: string; slug?: string }; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          if (data.slug !== undefined) {
            const existing = await ctx.db
              .query('org')
              .withIndex('by_slug', ((q: IndexLike) => q.eq('slug', data.slug)) as never)
              .unique()
            if (existing && existing._id !== orgId) return { code: 'ORG_SLUG_TAKEN' }
          }
          await ctx.db.patch(orgId, { ...data, updatedAt: Date.now() })
          return { success: true }
        }
      }),
      deleteOrgAsUser = mutation({
        args: { cascadeTables: v.optional(v.array(v.string())), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { cascadeTables, orgId, userId }: { cascadeTables?: string[]; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const orgDoc = await ctx.db.get(orgId)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          if (orgDoc.userId !== userId) return { code: 'INSUFFICIENT_ORG_ROLE' }
          if (cascadeTables)
            for (const table of cascadeTables) {
              const docs = await ctx.db
                .query(table)
                .filter(((q: FilterLike) => q.eq(q.field('orgId'), orgId)) as never)
                .collect()
              for (const d of docs) await ctx.db.delete(d._id as string)
            }

          const requests = await ctx.db
            .query('orgJoinRequest')
            .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
            .collect()
          for (const r of requests) await ctx.db.delete(r._id as string)
          const invites = await ctx.db
            .query('orgInvite')
            .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
            .collect()
          for (const i of invites) await ctx.db.delete(i._id as string)
          const orgMembers = await ctx.db
            .query('orgMember')
            .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
            .collect()
          for (const m of orgMembers) await ctx.db.delete(m._id as string)
          await ctx.db.delete(orgId)
          return { success: true }
        }
      }),
      leaveOrgAsUser = mutation({
        args: { orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { orgId, userId }: { orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const orgDoc = await ctx.db.get(orgId)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          if (orgDoc.userId === userId) return { code: 'MUST_TRANSFER_OWNERSHIP' }
          const member = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', userId)) as never)
            .unique()
          if (!member) return { code: 'NOT_ORG_MEMBER' }
          await ctx.db.delete(member._id as string)
          return { success: true }
        }
      }),
      requestJoinAsUser = mutation({
        args: { message: v.optional(v.string()), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { message, orgId, userId }: { message?: string; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const orgDoc = await ctx.db.get(orgId)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          if (orgDoc.userId === userId) return { code: 'ALREADY_ORG_MEMBER' }
          const existingMember = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', userId)) as never)
            .unique()
          if (existingMember) return { code: 'ALREADY_ORG_MEMBER' }
          const existingRequest = await ctx.db
            .query('orgJoinRequest')
            .withIndex('by_org_status', ((q: IndexLike) => q.eq('orgId', orgId).eq('status', 'pending')) as never)
            .filter(((q: FilterLike) => q.eq(q.field('userId'), userId)) as never)
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
      approveJoinRequestAsUser = mutation({
        args: { isAdmin: v.boolean(), requestId: v.id('orgJoinRequest'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { isAdmin, requestId, userId }: { isAdmin: boolean; requestId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const request = await ctx.db.get(requestId)
          if (request?.status !== 'pending') return { code: 'NOT_FOUND' }
          const membership = await getOrgMembership(ctx.db, request.orgId as string, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          const existingMember = await ctx.db
            .query('orgMember')
            .withIndex('by_org_user', ((q: IndexLike) =>
              q.eq('orgId', request.orgId).eq('userId', request.userId)) as never)
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
        handler: async (ctx: { db: DbLike }, { requestId, userId }: { requestId: string; userId: string }) => {
          if (!isTestMode()) return null
          const request = await ctx.db.get(requestId)
          if (request?.status !== 'pending') return { code: 'NOT_FOUND' }
          const membership = await getOrgMembership(ctx.db, request.orgId as string, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          await ctx.db.patch(requestId, { status: 'rejected' })
          return { success: true }
        }
      }),
      cancelJoinRequestAsUser = mutation({
        args: { requestId: v.id('orgJoinRequest'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { requestId, userId }: { requestId: string; userId: string }) => {
          if (!isTestMode()) return null
          const requestDoc = await ctx.db.get(requestId)
          if (!requestDoc) return { code: 'NOT_FOUND' }
          if (requestDoc.userId !== userId) return { code: 'FORBIDDEN' }
          if (requestDoc.status !== 'pending') return { code: 'NOT_FOUND' }
          await ctx.db.delete(requestId)
          return { success: true }
        }
      }),
      pendingInvitesAsUser = query({
        args: { orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { orgId, userId }: { orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          return ctx.db
            .query('orgInvite')
            .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
            .collect()
        }
      }),
      pendingJoinRequestsAsUser = query({
        args: { orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { orgId, userId }: { orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          return ctx.db
            .query('orgJoinRequest')
            .withIndex('by_org_status', ((q: IndexLike) => q.eq('orgId', orgId).eq('status', 'pending')) as never)
            .collect()
        }
      }),
      createExpiredInvite = mutation({
        args: { email: v.string(), isAdmin: v.boolean(), orgId: v.id('org') },
        handler: async (
          ctx: { db: DbLike },
          { email, isAdmin, orgId }: { email: string; isAdmin: boolean; orgId: string }
        ) => {
          if (!isTestMode()) return null
          const token = generateToken(),
            inviteId = await ctx.db.insert('orgInvite', {
              email,
              expiresAt: Date.now() - 1000,
              isAdmin,
              orgId,
              token
            })
          return { inviteId, token }
        }
      }),
      getJoinRequest = query({
        args: { requestId: v.id('orgJoinRequest') },
        handler: async (ctx: { db: DbLike }, { requestId }: { requestId: string }) => {
          if (!isTestMode()) return null
          return ctx.db.get(requestId)
        }
      })
    return {
      acceptInviteAsUser,
      addTestOrgMember,
      approveJoinRequestAsUser,
      cancelJoinRequestAsUser,
      cleanupOrgTestData,
      cleanupTestUsers,
      createExpiredInvite,
      createTestUser,
      deleteOrgAsUser,
      ensureTestUser,
      getAuthUserIdOrTest,
      getJoinRequest,
      getTestUser,
      getTestUserByEmail,
      inviteAsUser,
      isTestMode,
      leaveOrgAsUser,
      pendingInvitesAsUser,
      pendingJoinRequestsAsUser,
      rejectJoinRequestAsUser,
      removeMemberAsUser,
      removeTestOrgMember,
      requestJoinAsUser,
      setAdminAsUser,
      TEST_EMAIL,
      transferOwnershipAsUser,
      updateOrgAsUser
    }
  }

interface OrgTestCrudConfig<DM extends GenericDataModel = GenericDataModel> {
  acl?: boolean
  aclFrom?: { field: string; table: keyof DM & string }
  cascade?: { foreignKey: string; table: keyof DM & string }[]
  mutation: MutationBuilder<DM, 'public'>
  query: QueryBuilder<DM, 'public'>
  table: keyof DM & string
}

const checkAclPermission = (doc: Rec, userId: string, membership: { isAdmin: boolean }) => {
    const isCreator = doc.userId === userId,
      editors = (doc.editors ?? []) as string[],
      isEditor = editors.includes(userId)
    return isCreator || membership.isAdmin || isEditor
  },
  checkChildAclPermission = async (
    db: DbLike,
    doc: Rec,
    parentField: string,
    userId: string,
    membership: { isAdmin: boolean }
  ) => {
    const isCreator = doc.userId === userId
    if (isCreator || membership.isAdmin) return true
    const parentId = doc[parentField] as string,
      parent = parentId ? await db.get(parentId) : null,
      editors = parent ? ((parent.editors ?? []) as string[]) : []
    return editors.some(eid => eid === userId)
  },
  addEditorToDoc = async (db: DbLike, itemId: string, editorId: string, orgId: string) => {
    const doc = await db.get(itemId)
    if (doc?.orgId !== orgId) return { code: 'NOT_FOUND' }
    const editors = (doc.editors ?? []) as string[],
      alreadyEditor = editors.some((id: string) => id === editorId)
    if (alreadyEditor) return doc
    await db.patch(itemId, { editors: [...editors, editorId], updatedAt: Date.now() })
    return db.get(itemId)
  },
  removeEditorFromDoc = async (db: DbLike, itemId: string, editorId: string, orgId: string) => {
    const doc = await db.get(itemId)
    if (doc?.orgId !== orgId) return { code: 'NOT_FOUND' }
    const editors = (doc.editors ?? []) as string[],
      filtered: string[] = []
    for (const id of editors) if (id !== editorId) filtered.push(id)
    await db.patch(itemId, { editors: filtered, updatedAt: Date.now() })
    return db.get(itemId)
  },
  makeOrgTestCrud = <DM extends GenericDataModel>(config: OrgTestCrudConfig<DM>) => {
    const { acl, aclFrom, cascade, mutation: rawMut, query: rawQry, table } = config,
      mutation = rawMut as unknown as (opts: Rec) => Rec,
      query = rawQry as unknown as (opts: Rec) => Rec,
      hasAcl = acl || Boolean(aclFrom),
      createAsUser = mutation({
        /** biome-ignore lint/suspicious/noExplicitAny: test generic */
        args: { data: v.any(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { data, orgId, userId }: { data: Rec; orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          return ctx.db.insert(table, { ...data, orgId, updatedAt: Date.now(), userId })
        }
      }),
      updateAsUser = mutation({
        /** biome-ignore lint/suspicious/noExplicitAny: test generic */
        args: { data: v.any(), id: v.string(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { data, id, orgId, userId }: { data: Rec; id: string; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const doc = await ctx.db.get(id)
          if (doc?.orgId !== orgId) return { code: 'NOT_FOUND' }
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (hasAcl) {
            const permitted = aclFrom
              ? await checkChildAclPermission(ctx.db, doc, aclFrom.field, userId, membership)
              : checkAclPermission(doc, userId, membership)
            if (!permitted) return { code: 'FORBIDDEN' }
          }
          await ctx.db.patch(id, { ...data, updatedAt: Date.now() })
          return { success: true }
        }
      }),
      rmAsUser = mutation({
        args: { id: v.string(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { id, orgId, userId }: { id: string; orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const doc = await ctx.db.get(id)
          if (doc?.orgId !== orgId) return { code: 'NOT_FOUND' }
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (hasAcl) {
            const permitted = aclFrom
              ? await checkChildAclPermission(ctx.db, doc, aclFrom.field, userId, membership)
              : checkAclPermission(doc, userId, membership)
            if (!permitted) return { code: 'FORBIDDEN' }
          }
          if (cascade)
            for (const { foreignKey, table: childTable } of cascade) {
              const children = await ctx.db
                .query(childTable)
                .withIndex('by_parent', ((q: IndexLike) => q.eq(foreignKey, id)) as never)
                .collect()
              for (const c of children) await ctx.db.delete(c._id as string)
            }

          await ctx.db.delete(id)
          return { success: true }
        }
      }),
      bulkRmAsUser = mutation({
        args: { ids: v.array(v.string()), orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { ids, orgId, userId }: { ids: string[]; orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const orgDoc = await ctx.db.get(orgId)
          if (!orgDoc) return { code: 'NOT_FOUND' }
          const isOwner = orgDoc.userId === userId,
            member = await ctx.db
              .query('orgMember')
              .withIndex('by_org_user', ((q: IndexLike) => q.eq('orgId', orgId).eq('userId', userId)) as never)
              .unique()
          if (!(isOwner || member)) return { code: 'NOT_ORG_MEMBER' }
          if (!(isOwner || member?.isAdmin)) return { code: 'INSUFFICIENT_ORG_ROLE' }
          let count = 0
          for (const id of ids) {
            const doc = await ctx.db.get(id)
            if (doc?.orgId === orgId) {
              if (cascade)
                for (const { foreignKey, table: childTable } of cascade) {
                  const children = await ctx.db
                    .query(childTable)
                    .withIndex('by_parent', ((q: IndexLike) => q.eq(foreignKey, id)) as never)
                    .collect()
                  for (const c of children) await ctx.db.delete(c._id as string)
                }

              await ctx.db.delete(id)
              count += 1
            }
          }
          return { count }
        }
      }),
      listAsUser = query({
        args: { orgId: v.id('org'), userId: v.id('users') },
        handler: async (ctx: { db: DbLike }, { orgId, userId }: { orgId: string; userId: string }) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          return ctx.db
            .query(table)
            .withIndex('by_org', ((q: IndexLike) => q.eq('orgId', orgId)) as never)
            .collect()
        }
      }),
      result: Rec = { bulkRmAsUser, createAsUser, listAsUser, rmAsUser, updateAsUser }
    if (hasAcl) {
      result.addEditorAsUser = mutation({
        args: { editorId: v.id('users'), itemId: v.string(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { editorId, itemId, orgId, userId }: { editorId: string; itemId: string; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          return addEditorToDoc(ctx.db, itemId, editorId, orgId)
        }
      })
      result.removeEditorAsUser = mutation({
        args: { editorId: v.id('users'), itemId: v.string(), orgId: v.id('org'), userId: v.id('users') },
        handler: async (
          ctx: { db: DbLike },
          { editorId, itemId, orgId, userId }: { editorId: string; itemId: string; orgId: string; userId: string }
        ) => {
          if (!isTestMode()) return null
          const membership = await getOrgMembership(ctx.db, orgId, userId)
          if (!membership) return { code: 'NOT_ORG_MEMBER' }
          if (!membership.isAdmin) return { code: 'INSUFFICIENT_ORG_ROLE' }
          return removeEditorFromDoc(ctx.db, itemId, editorId, orgId)
        }
      })
    }
    return result
  }

export type { OrgTestCrudConfig, TestAuthConfig }
export { getOrgMembership, isTestMode, makeOrgTestCrud, makeTestAuth, TEST_EMAIL }
