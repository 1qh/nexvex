import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod/v4'

import type { OrgRole } from '../f/org-helpers'
import type { Doc, Id } from './_generated/dataModel'

import { m, pq, q } from '../f/builders'
import { err, time } from '../f/helpers'
import { getOrgMember, getOrgRole, requireOrgMember, requireOrgRole } from '../f/org-helpers'
import { org } from '../t'

const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i += 1) token += chars.charAt(Math.floor(Math.random() * chars.length))
    return token
  },
  SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000,
  create = m({
    args: { data: org.team },
    handler: async (c, { data }) => {
      const existing = await c.db
        .query('org')
        .withIndex('by_slug', o => o.eq('slug', data.slug))
        .unique()
      if (existing) return err('ORG_SLUG_TAKEN')
      const orgId = await c.db.insert('org', {
        avatarId: data.avatarId ?? undefined,
        name: data.name,
        slug: data.slug,
        userId: c.user._id,
        ...time()
      })
      return { orgId }
    }
  }),
  update = m({
    args: { data: org.team.partial(), orgId: zid('org') },
    handler: async (c, { data, orgId }) => {
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
      const newSlug = data.slug
      if (newSlug !== undefined) {
        const existing = await c.db
          .query('org')
          .withIndex('by_slug', o => o.eq('slug', newSlug))
          .unique()
        if (existing && existing._id !== orgId) return err('ORG_SLUG_TAKEN')
      }
      const patchData: Partial<{
        avatarId: Id<'_storage'>
        name: string
        slug: string
      }> = {}
      if (data.name !== undefined) patchData.name = data.name
      if (newSlug !== undefined) patchData.slug = newSlug
      if (data.avatarId !== undefined && data.avatarId !== null) patchData.avatarId = data.avatarId
      await c.db.patch(orgId, { ...patchData, ...time() })
    }
  }),
  get = q({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) => {
      await requireOrgMember(c.db, orgId, c.user._id)
      return c.db.get(orgId)
    }
  }),
  getBySlug = pq({
    args: { slug: z.string() },
    handler: async (c, { slug }) =>
      c.db
        .query('org')
        .withIndex('by_slug', o => o.eq('slug', slug))
        .unique()
  }),
  getPublic = pq({
    args: { slug: z.string() },
    handler: async (c, { slug }) => {
      const orgDoc = await c.db
        .query('org')
        .withIndex('by_slug', o => o.eq('slug', slug))
        .unique()
      if (!orgDoc) return null
      return { _id: orgDoc._id, avatarId: orgDoc.avatarId, name: orgDoc.name, slug: orgDoc.slug }
    }
  }),
  myOrgs = q({
    args: {},
    handler: async c => {
      const ownedOrgs = await c.db
          .query('org')
          .withIndex('by_user', o => o.eq('userId', c.user._id))
          .collect(),
        memberships = await c.db
          .query('orgMember')
          .withIndex('by_user', o => o.eq('userId', c.user._id))
          .collect(),
        memberOrgIds = memberships.map(x => x.orgId),
        memberOrgResults = await Promise.all(memberOrgIds.map(async id => c.db.get(id))),
        memberOrgs: Doc<'org'>[] = []
      for (const orgDoc of memberOrgResults) if (orgDoc) memberOrgs.push(orgDoc)
      const ownedIds = new Set(ownedOrgs.map(o => o._id)),
        result: {
          org: Doc<'org'>
          role: OrgRole
        }[] = []
      for (const o of ownedOrgs) result.push({ org: o, role: 'owner' })
      for (const o of memberOrgs)
        if (!ownedIds.has(o._id)) {
          const member = memberships.find(x => x.orgId === o._id),
            role: OrgRole = member?.isAdmin ? 'admin' : 'member'
          result.push({ org: o, role })
        }
      return result
    }
  }),
  remove = m({
    args: { orgId: zid('org') },
    // eslint-disable-next-line max-statements
    handler: async (c, { orgId }) => {
      const orgDoc = await c.db.get(orgId)
      if (!orgDoc) return err('NOT_FOUND')
      if (orgDoc.userId !== c.user._id) return err('FORBIDDEN')
      const tasks = await c.db
        .query('task')
        .filter(o => o.eq(o.field('orgId'), orgId))
        .collect()
      await Promise.all(tasks.map(async t => c.db.delete(t._id)))
      const projects = await c.db
        .query('project')
        .filter(o => o.eq(o.field('orgId'), orgId))
        .collect()
      await Promise.all(projects.map(async p => c.db.delete(p._id)))
      const joinRequests = await c.db
        .query('orgJoinRequest')
        .withIndex('by_org', o => o.eq('orgId', orgId))
        .collect()
      await Promise.all(joinRequests.map(async r => c.db.delete(r._id)))
      const invites = await c.db
        .query('orgInvite')
        .withIndex('by_org', o => o.eq('orgId', orgId))
        .collect()
      await Promise.all(invites.map(async i => c.db.delete(i._id)))
      const orgMembers = await c.db
        .query('orgMember')
        .withIndex('by_org', o => o.eq('orgId', orgId))
        .collect()
      await Promise.all(orgMembers.map(async x => c.db.delete(x._id)))
      await c.db.delete(orgId)
    }
  }),
  isSlugAvailable = pq({
    args: { slug: z.string() },
    handler: async (c, { slug }) => {
      const existing = await c.db
        .query('org')
        .withIndex('by_slug', o => o.eq('slug', slug))
        .unique()
      return { available: !existing }
    }
  }),
  membership = q({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) => {
      const orgDoc = await c.db.get(orgId)
      if (!orgDoc) return err('NOT_FOUND')
      const member = await getOrgMember(c.db, orgId, c.user._id),
        role = getOrgRole(orgDoc, c.user._id, member)
      if (!role) return null
      return { memberId: member?._id ?? null, role }
    }
  }),
  members = q({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) => {
      await requireOrgMember(c.db, orgId, c.user._id)
      const orgDoc = await c.db.get(orgId)
      if (!orgDoc) return err('NOT_FOUND')
      const result: {
          memberId?: Id<'orgMember'>
          role: OrgRole
          user: Doc<'users'> | null
          userId: Id<'users'>
        }[] = [],
        ownerUser = await c.db.get(orgDoc.userId)
      result.push({ role: 'owner', user: ownerUser, userId: orgDoc.userId })
      const memberDocs = await c.db
          .query('orgMember')
          .withIndex('by_org', o => o.eq('orgId', orgId))
          .collect(),
        userDocs = await Promise.all(memberDocs.map(async x => c.db.get(x.userId)))
      for (let i = 0; i < memberDocs.length; i += 1) {
        const memberDoc = memberDocs[i],
          userDoc = userDocs[i]
        if (memberDoc)
          result.push({
            memberId: memberDoc._id,
            role: memberDoc.isAdmin ? 'admin' : 'member',
            user: userDoc ?? null,
            userId: memberDoc.userId
          })
      }
      return result
    }
  }),
  setAdmin = m({
    args: { isAdmin: z.boolean(), memberId: zid('orgMember') },
    handler: async (c, { isAdmin, memberId }) => {
      const memberDoc = await c.db.get(memberId)
      if (!memberDoc) return err('NOT_FOUND')
      const orgDoc = await c.db.get(memberDoc.orgId)
      if (!orgDoc) return err('NOT_FOUND')
      if (orgDoc.userId !== c.user._id) return err('FORBIDDEN')
      if (memberDoc.userId === orgDoc.userId) return err('CANNOT_MODIFY_OWNER')
      await c.db.patch(memberId, { isAdmin, ...time() })
    }
  }),
  removeMember = m({
    args: { memberId: zid('orgMember') },
    handler: async (c, { memberId }) => {
      const memberDoc = await c.db.get(memberId)
      if (!memberDoc) return err('NOT_FOUND')
      const orgDoc = await c.db.get(memberDoc.orgId)
      if (!orgDoc) return err('NOT_FOUND')
      if (memberDoc.userId === orgDoc.userId) return err('CANNOT_MODIFY_OWNER')
      const { role } = await requireOrgRole({
        db: c.db,
        minRole: 'admin',
        orgId: memberDoc.orgId,
        userId: c.user._id
      })
      if (role === 'admin' && memberDoc.isAdmin) return err('CANNOT_MODIFY_ADMIN')
      await c.db.delete(memberId)
    }
  }),
  leave = m({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) => {
      const orgDoc = await c.db.get(orgId)
      if (!orgDoc) return err('NOT_FOUND')
      if (orgDoc.userId === c.user._id) return err('MUST_TRANSFER_OWNERSHIP')
      const member = await getOrgMember(c.db, orgId, c.user._id)
      if (!member) return err('NOT_ORG_MEMBER')
      await c.db.delete(member._id)
    }
  }),
  transferOwnership = m({
    args: { newOwnerId: zid('users'), orgId: zid('org') },
    handler: async (c, { newOwnerId, orgId }) => {
      const orgDoc = await c.db.get(orgId)
      if (!orgDoc) return err('NOT_FOUND')
      if (orgDoc.userId !== c.user._id) return err('FORBIDDEN')
      const targetMember = await getOrgMember(c.db, orgId, newOwnerId)
      if (!targetMember) return err('NOT_ORG_MEMBER')
      if (!targetMember.isAdmin) return err('TARGET_MUST_BE_ADMIN')
      await c.db.patch(orgId, { userId: newOwnerId, ...time() })
      await c.db.delete(targetMember._id)
      await c.db.insert('orgMember', {
        isAdmin: true,
        orgId,
        userId: c.user._id,
        ...time()
      })
    }
  }),
  invite = m({
    args: { email: z.email(), isAdmin: z.boolean(), orgId: zid('org') },
    handler: async (c, { email, isAdmin, orgId }) => {
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
      const token = generateToken(),
        expiresAt = Date.now() + SEVEN_DAYS_MS,
        inviteId = await c.db.insert('orgInvite', {
          email,
          expiresAt,
          isAdmin,
          orgId,
          token
        })
      return { inviteId, token }
    }
  }),
  acceptInvite = m({
    args: { token: z.string() },
    // eslint-disable-next-line max-statements
    handler: async (c, { token }) => {
      const inviteDoc = await c.db
        .query('orgInvite')
        .withIndex('by_token', o => o.eq('token', token))
        .unique()
      if (!inviteDoc) return err('INVALID_INVITE')
      if (inviteDoc.expiresAt < Date.now()) return err('INVITE_EXPIRED')
      const existingMember = await getOrgMember(c.db, inviteDoc.orgId, c.user._id),
        orgDoc = await c.db.get(inviteDoc.orgId)
      if (!orgDoc) return err('NOT_FOUND')
      if (existingMember || orgDoc.userId === c.user._id) return err('ALREADY_ORG_MEMBER')
      const pendingRequest = await c.db
        .query('orgJoinRequest')
        .withIndex('by_org_status', o => o.eq('orgId', inviteDoc.orgId).eq('status', 'pending'))
        .filter(o => o.eq(o.field('userId'), c.user._id))
        .unique()
      if (pendingRequest) await c.db.patch(pendingRequest._id, { status: 'approved', ...time() })
      await c.db.insert('orgMember', {
        isAdmin: inviteDoc.isAdmin,
        orgId: inviteDoc.orgId,
        userId: c.user._id,
        ...time()
      })
      await c.db.delete(inviteDoc._id)
      return { orgId: inviteDoc.orgId }
    }
  }),
  revokeInvite = m({
    args: { inviteId: zid('orgInvite') },
    handler: async (c, { inviteId }) => {
      const inviteDoc = await c.db.get(inviteId)
      if (!inviteDoc) return err('NOT_FOUND')
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId: inviteDoc.orgId, userId: c.user._id })
      await c.db.delete(inviteId)
    }
  }),
  pendingInvites = q({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) => {
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
      return c.db
        .query('orgInvite')
        .withIndex('by_org', o => o.eq('orgId', orgId))
        .collect()
    }
  }),
  requestJoin = m({
    args: { message: z.string().optional(), orgId: zid('org') },
    handler: async (c, { message, orgId }) => {
      const orgDoc = await c.db.get(orgId)
      if (!orgDoc) return err('NOT_FOUND')
      const existingMember = await getOrgMember(c.db, orgId, c.user._id)
      if (existingMember || orgDoc.userId === c.user._id) return err('ALREADY_ORG_MEMBER')
      const existingRequest = await c.db
        .query('orgJoinRequest')
        .withIndex('by_org_status', o => o.eq('orgId', orgId).eq('status', 'pending'))
        .filter(o => o.eq(o.field('userId'), c.user._id))
        .unique()
      if (existingRequest) return err('JOIN_REQUEST_EXISTS')
      const requestId = await c.db.insert('orgJoinRequest', {
        message,
        orgId,
        status: 'pending',
        userId: c.user._id
      })
      return { requestId }
    }
  }),
  approveJoinRequest = m({
    args: { isAdmin: z.boolean().optional(), requestId: zid('orgJoinRequest') },
    handler: async (c, { isAdmin, requestId }) => {
      const requestDoc = await c.db.get(requestId)
      if (!requestDoc) return err('NOT_FOUND')
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId: requestDoc.orgId, userId: c.user._id })
      await c.db.insert('orgMember', {
        isAdmin: isAdmin ?? false,
        orgId: requestDoc.orgId,
        userId: requestDoc.userId,
        ...time()
      })
      await c.db.patch(requestId, { status: 'approved' })
    }
  }),
  rejectJoinRequest = m({
    args: { requestId: zid('orgJoinRequest') },
    handler: async (c, { requestId }) => {
      const requestDoc = await c.db.get(requestId)
      if (!requestDoc) return err('NOT_FOUND')
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId: requestDoc.orgId, userId: c.user._id })
      await c.db.patch(requestId, { status: 'rejected' })
    }
  }),
  cancelJoinRequest = m({
    args: { requestId: zid('orgJoinRequest') },
    handler: async (c, { requestId }) => {
      const requestDoc = await c.db.get(requestId)
      if (!requestDoc) return err('NOT_FOUND')
      if (requestDoc.userId !== c.user._id) return err('FORBIDDEN')
      if (requestDoc.status !== 'pending') return err('NOT_FOUND')
      await c.db.delete(requestId)
    }
  }),
  pendingJoinRequests = q({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) => {
      await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
      const requests = await c.db
          .query('orgJoinRequest')
          .withIndex('by_org_status', o => o.eq('orgId', orgId).eq('status', 'pending'))
          .collect(),
        users = await Promise.all(requests.map(async r => c.db.get(r.userId))),
        result: {
          request: Doc<'orgJoinRequest'>
          user: Doc<'users'> | null
        }[] = []
      for (let i = 0; i < requests.length; i += 1) {
        const req = requests[i],
          usr = users[i]
        if (req) result.push({ request: req, user: usr ?? null })
      }
      return result
    }
  }),
  myJoinRequest = q({
    args: { orgId: zid('org') },
    handler: async (c, { orgId }) =>
      c.db
        .query('orgJoinRequest')
        .withIndex('by_org_status', o => o.eq('orgId', orgId).eq('status', 'pending'))
        .filter(o => o.eq(o.field('userId'), c.user._id))
        .unique()
  })
export {
  acceptInvite,
  approveJoinRequest,
  cancelJoinRequest,
  create,
  get,
  getBySlug,
  getPublic,
  invite,
  isSlugAvailable,
  leave,
  members,
  membership,
  myJoinRequest,
  myOrgs,
  pendingInvites,
  pendingJoinRequests,
  rejectJoinRequest,
  remove,
  removeMember,
  requestJoin,
  revokeInvite,
  setAdmin,
  transferOwnership,
  update
}
