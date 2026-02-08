import type { Doc, Id } from '../convex/_generated/dataModel'
import type { DatabaseReader } from '../convex/_generated/server'
import type { CanEditOpts } from './types'

import { err } from './helpers'

type OrgRole = 'admin' | 'member' | 'owner'

const ROLE_LEVEL: Record<OrgRole, number> = { admin: 2, member: 1, owner: 3 },
  getOrgRole = (org: Doc<'org'>, userId: Id<'users'>, member: Doc<'orgMember'> | null): null | OrgRole => {
    if (org.userId === userId) return 'owner'
    if (!member) return null
    return member.isAdmin ? 'admin' : 'member'
  },
  getOrgMember = async (db: DatabaseReader, orgId: Id<'org'>, userId: Id<'users'>) =>
    db
      .query('orgMember')
      .withIndex('by_org_user', q => q.eq('orgId', orgId).eq('userId', userId))
      .unique(),
  requireOrgMember = async (db: DatabaseReader, orgId: Id<'org'>, userId: Id<'users'>) => {
    const org = await db.get(orgId)
    if (!org) return err('NOT_FOUND')
    const member = await getOrgMember(db, orgId, userId),
      role = getOrgRole(org, userId, member)
    if (!role) return err('NOT_ORG_MEMBER')
    return { member, org, role }
  }

interface RequireOrgRoleArgs {
  db: DatabaseReader
  minRole: OrgRole
  orgId: Id<'org'>
  userId: Id<'users'>
}

const requireOrgRole = async ({ db, minRole, orgId, userId }: RequireOrgRoleArgs) => {
    const result = await requireOrgMember(db, orgId, userId)
    if (ROLE_LEVEL[result.role] < ROLE_LEVEL[minRole]) return err('INSUFFICIENT_ORG_ROLE')
    return result
  },
  canEdit = ({ acl, doc, role, userId }: CanEditOpts): boolean => {
    if (role === 'owner' || role === 'admin') return true
    if (doc.userId === userId) return true
    if (acl && doc.editors?.includes(userId)) return true
    return false
  }

export { canEdit, getOrgMember, getOrgRole, type OrgRole, requireOrgMember, requireOrgRole, ROLE_LEVEL }
