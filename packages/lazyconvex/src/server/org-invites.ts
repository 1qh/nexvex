/* eslint-disable max-statements */
import type { GenericId } from 'convex/values'

import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod/v4'

import type { DbLike, FilterLike, IndexLike, Mb, Qb, Rec } from './types'

import { err, time } from './helpers'
import { getOrgMember, requireOrgRole } from './org-crud'

interface InviteDocLike {
  [k: string]: unknown
  _creationTime: number
  _id: GenericId<'orgInvite'>
  email: string
  expiresAt: number
  isAdmin: boolean
  orgId: GenericId<'org'>
  token: string
}

const generateToken = () => {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    let token = ''
    for (const b of bytes) token += b.toString(36).padStart(2, '0').slice(0, 2)
    return token.slice(0, 32)
  },
  SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000,
  makeInviteHandlers = ({ m, q }: { m: Mb; q: Qb }) => {
    const invite = m({
        args: { email: z.email(), isAdmin: z.boolean(), orgId: zid('org') },
        handler: async (c: Rec, { email, isAdmin, orgId }: { email: string; isAdmin: boolean; orgId: string }) => {
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: (c.user as Rec)._id as string })
          const token = generateToken(),
            expiresAt = Date.now() + SEVEN_DAYS_MS,
            inviteId = await (c.db as DbLike).insert('orgInvite', {
              email,
              expiresAt,
              isAdmin,
              orgId,
              token
            })
          return { inviteId, token } as { inviteId: GenericId<'orgInvite'>; token: string }
        }
      }),
      acceptInvite = m({
        args: { token: z.string() },
        handler: async (c: Rec, { token }: { token: string }) => {
          const db = c.db as DbLike,
            userId = (c.user as Rec)._id as string,
            inviteDoc = await db
              .query('orgInvite')
              .withIndex('by_token', ((o: IndexLike) => o.eq('token', token)) as never)
              .unique()
          if (!inviteDoc) return err('INVALID_INVITE')
          if ((inviteDoc.expiresAt as number) < Date.now()) return err('INVITE_EXPIRED')
          const existingMember = await getOrgMember({ db, orgId: inviteDoc.orgId as string, userId }),
            orgDoc = await db.get(inviteDoc.orgId as string)
          if (!orgDoc) return err('NOT_FOUND')
          if (existingMember || orgDoc.userId === userId) return err('ALREADY_ORG_MEMBER')
          const pendingRequest = await db
            .query('orgJoinRequest')
            .withIndex('by_org_status', ((o: IndexLike) =>
              o.eq('orgId', inviteDoc.orgId).eq('status', 'pending')) as never)
            .filter((o: FilterLike) => o.eq(o.field('userId'), userId))
            .unique()
          if (pendingRequest) await db.patch(pendingRequest._id as string, { status: 'approved', ...time() })
          await db.insert('orgMember', {
            isAdmin: inviteDoc.isAdmin,
            orgId: inviteDoc.orgId,
            userId,
            ...time()
          })
          await db.delete(inviteDoc._id as string)
          return { orgId: inviteDoc.orgId } as { orgId: GenericId<'org'> }
        }
      }),
      revokeInvite = m({
        args: { inviteId: zid('orgInvite') },
        handler: async (c: Rec, { inviteId }: { inviteId: string }) => {
          const db = c.db as DbLike,
            inviteDoc = await db.get(inviteId)
          if (!inviteDoc) return err('NOT_FOUND')
          await requireOrgRole({
            db,
            minRole: 'admin',
            orgId: inviteDoc.orgId as string,
            userId: (c.user as Rec)._id as string
          })
          await db.delete(inviteId)
        }
      }),
      pendingInvites = q({
        args: { orgId: zid('org') },
        handler: async (c: Rec, { orgId }: { orgId: string }): Promise<InviteDocLike[]> => {
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: (c.user as Rec)._id as string })
          return (c.db as DbLike)
            .query('orgInvite')
            .withIndex('by_org', ((o: IndexLike) => o.eq('orgId', orgId)) as never)
            .collect() as Promise<InviteDocLike[]>
        }
      })
    return { acceptInvite, invite, pendingInvites, revokeInvite }
  }

export type { InviteDocLike }
export { makeInviteHandlers }
