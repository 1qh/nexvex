/* eslint-disable no-await-in-loop, max-statements, @typescript-eslint/no-unnecessary-condition */
/** biome-ignore-all lint/performance/noAwaitInLoops: sequential deletes */
import type { GenericDataModel, GenericMutationCtx, GenericQueryCtx, MutationBuilder, QueryBuilder } from 'convex/server'
import type { GenericId } from 'convex/values'
import type { ZodObject, ZodRawShape } from 'zod/v4'

import { customCtx } from 'convex-helpers/server/customFunctions'
import { zCustomMutation, zCustomQuery, zid } from 'convex-helpers/server/zod4'
import { z } from 'zod/v4'

import type { DbLike, FilterLike, IndexLike, Mb, OrgRole, Qb, Rec } from './types'

import { err, getUser, time } from './helpers'
import { requireOrgMember, requireOrgRole } from './org-crud'
import { makeInviteHandlers } from './org-invites'
import { makeJoinHandlers } from './org-join'
import { makeMemberHandlers } from './org-members'

interface OrgDocLike {
  [k: string]: unknown
  _creationTime: number
  _id: GenericId<'org'>
  avatarId?: GenericId<'_storage'>
  name: string
  slug: string
  updatedAt: number
  userId: GenericId<'users'>
}

const makeOrg = <DM extends GenericDataModel, S extends ZodRawShape>({
  cascadeTables,
  getAuthUserId,
  mutation,
  query,
  schema: orgSchema
}: {
  cascadeTables?: string[]
  getAuthUserId: (ctx: never) => Promise<null | string>
  mutation: MutationBuilder<DM, 'public'>
  query: QueryBuilder<DM, 'public'>
  schema: ZodObject<S>
}) => {
  const mb = zCustomMutation(
      mutation,
      customCtx(async (c: GenericMutationCtx<DM>) => ({
        user: await getUser({ ctx: c as never, db: c.db as never as DbLike, getAuthUserId })
      }))
    ) as never as Mb,
    qb = zCustomQuery(
      query,
      customCtx(async (c: GenericQueryCtx<DM>) => ({
        user: await getUser({ ctx: c as never, db: c.db as never as DbLike, getAuthUserId })
      }))
    ) as never as Qb,
    pqb = zCustomQuery(
      query,
      customCtx(() => ({}))
    ) as never as Qb,
    m = mb,
    q = qb,
    pq = pqb,
    create = m({
      args: { data: orgSchema },
      handler: async (c: Rec, { data }: { data: Rec }) => {
        const existing = await (c.db as DbLike)
          .query('org')
          .withIndex('by_slug', ((o: IndexLike) => o.eq('slug', data.slug)) as never)
          .unique()
        if (existing) return err('ORG_SLUG_TAKEN')
        const orgId = await (c.db as DbLike).insert('org', {
          avatarId: (data.avatarId as string) ?? undefined,
          name: data.name,
          slug: data.slug,
          userId: (c.user as Rec)._id,
          ...time()
        })
        return { orgId } as { orgId: GenericId<'org'> }
      }
    }),
    update = m({
      args: { data: orgSchema.partial(), orgId: zid('org') },
      handler: async (c: Rec, { data, orgId }: { data: Rec; orgId: string }) => {
        await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: (c.user as Rec)._id as string })
        const newSlug = data.slug as string | undefined
        if (newSlug !== undefined) {
          const existing = await (c.db as DbLike)
            .query('org')
            .withIndex('by_slug', ((o: IndexLike) => o.eq('slug', newSlug)) as never)
            .unique()
          if (existing && existing._id !== orgId) return err('ORG_SLUG_TAKEN')
        }
        const patchData: Rec = {}
        if (data.name !== undefined) patchData.name = data.name
        if (newSlug !== undefined) patchData.slug = newSlug
        if (data.avatarId !== undefined && data.avatarId !== null) patchData.avatarId = data.avatarId
        await (c.db as DbLike).patch(orgId, { ...patchData, ...time() })
      }
    }),
    get = q({
      args: { orgId: zid('org') },
      handler: async (c: Rec, { orgId }: { orgId: string }): Promise<null | OrgDocLike> => {
        await requireOrgMember({ db: c.db, orgId, userId: (c.user as Rec)._id as string })
        return (c.db as DbLike).get(orgId) as Promise<null | OrgDocLike>
      }
    }),
    getBySlug = pq({
      args: { slug: z.string() },
      handler: async (c: Rec, { slug }: { slug: string }): Promise<null | OrgDocLike> =>
        (c.db as DbLike)
          .query('org')
          .withIndex('by_slug', ((o: IndexLike) => o.eq('slug', slug)) as never)
          .unique() as Promise<null | OrgDocLike>
    }),
    getPublic = pq({
      args: { slug: z.string() },
      handler: async (
        c: Rec,
        { slug }: { slug: string }
      ): Promise<null | { _id: GenericId<'org'>; avatarId?: GenericId<'_storage'>; name: string; slug: string }> => {
        const orgDoc = await (c.db as DbLike)
          .query('org')
          .withIndex('by_slug', ((o: IndexLike) => o.eq('slug', slug)) as never)
          .unique()
        if (!orgDoc) return null
        return {
          _id: orgDoc._id as GenericId<'org'>,
          avatarId: orgDoc.avatarId as GenericId<'_storage'> | undefined,
          name: orgDoc.name as string,
          slug: orgDoc.slug as string
        }
      }
    }),
    myOrgs = q({
      args: {},
      handler: async (c: Rec): Promise<{ org: OrgDocLike; role: OrgRole }[]> => {
        const uid = (c.user as Rec)._id as string,
          db = c.db as DbLike,
          ownedOrgs = await db
            .query('org')
            .withIndex('by_user', ((o: IndexLike) => o.eq('userId', uid)) as never)
            .collect(),
          memberships = await db
            .query('orgMember')
            .withIndex('by_user', ((o: IndexLike) => o.eq('userId', uid)) as never)
            .collect(),
          memberOrgIds = memberships.map((x: Rec) => x.orgId as string),
          memberOrgResults = await Promise.all(memberOrgIds.map(async (id: string) => db.get(id))),
          memberOrgs: Rec[] = []
        for (const orgDoc of memberOrgResults) if (orgDoc) memberOrgs.push(orgDoc)
        const ownedIds = new Set(ownedOrgs.map((o: Rec) => o._id as string)),
          result: { org: OrgDocLike; role: OrgRole }[] = []
        for (const o of ownedOrgs) result.push({ org: o as OrgDocLike, role: 'owner' })
        for (const o of memberOrgs)
          if (!ownedIds.has(o._id as string)) {
            const member = memberships.find((x: Rec) => x.orgId === o._id),
              role: OrgRole = member?.isAdmin ? 'admin' : 'member'
            result.push({ org: o as OrgDocLike, role })
          }
        return result
      }
    }),
    remove = m({
      args: { orgId: zid('org') },
      handler: async (c: Rec, { orgId }: { orgId: string }) => {
        const db = c.db as DbLike,
          orgDoc = await db.get(orgId)
        if (!orgDoc) return err('NOT_FOUND')
        if (orgDoc.userId !== (c.user as Rec)._id) return err('FORBIDDEN')
        if (cascadeTables)
          for (const table of cascadeTables) {
            const docs = await db
              .query(table)
              .filter((o: FilterLike) => o.eq(o.field('orgId'), orgId))
              .collect()
            await Promise.all(docs.map(async (d: Rec) => db.delete(d._id as string)))
          }
        const joinRequests = await db
          .query('orgJoinRequest')
          .withIndex('by_org', ((o: IndexLike) => o.eq('orgId', orgId)) as never)
          .collect()
        await Promise.all(joinRequests.map(async (r: Rec) => db.delete(r._id as string)))
        const invites = await db
          .query('orgInvite')
          .withIndex('by_org', ((o: IndexLike) => o.eq('orgId', orgId)) as never)
          .collect()
        await Promise.all(invites.map(async (i: Rec) => db.delete(i._id as string)))
        const orgMembers = await db
          .query('orgMember')
          .withIndex('by_org', ((o: IndexLike) => o.eq('orgId', orgId)) as never)
          .collect()
        await Promise.all(orgMembers.map(async (x: Rec) => db.delete(x._id as string)))
        await db.delete(orgId)
      }
    }),
    isSlugAvailable = pq({
      args: { slug: z.string() },
      handler: async (c: Rec, { slug }: { slug: string }) => {
        const existing = await (c.db as DbLike)
          .query('org')
          .withIndex('by_slug', ((o: IndexLike) => o.eq('slug', slug)) as never)
          .unique()
        return { available: !existing } as { available: boolean }
      }
    }),
    memberOps = makeMemberHandlers({ m, q }),
    inviteOps = makeInviteHandlers({ m, q }),
    joinOps = makeJoinHandlers({ m, q })
  return {
    ...inviteOps,
    ...joinOps,
    ...memberOps,
    create,
    get,
    getBySlug,
    getPublic,
    isSlugAvailable,
    myOrgs,
    remove,
    update
  }
}

export { makeOrg }
export type { OrgDocLike }
export type { InviteDocLike } from './org-invites'
export type { JoinRequestItem } from './org-join'
export type { OrgMemberItem, OrgUserLike } from './org-members'
