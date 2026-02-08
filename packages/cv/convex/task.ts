import { zid } from 'convex-helpers/server/zod4'

import type { Id } from '../convex/_generated/dataModel'
import type { OrgDoc } from '../f/types'

import { orgCrud } from '../f'
import { m, pq } from '../f/builders'
import { err, time } from '../f/helpers'
import { canEdit, requireOrgMember, requireOrgRole } from '../f/org-helpers'
import { orgScoped } from '../t'

const { bulkRm, bulkUpdate, create, list, read, rm, update } = orgCrud('task', orgScoped.task, {
    aclFrom: { field: 'projectId', table: 'project' }
  }),
  byProject = pq({
    args: { orgId: zid('org'), projectId: zid('project') },
    handler: async (ctx, { orgId, projectId }) => {
      if (!ctx.viewerId) return err('NOT_AUTHENTICATED')
      await requireOrgMember(ctx.db, orgId, ctx.viewerId)
      const tasks = await ctx.db
        .query('task')
        .withIndex('by_parent', q => q.eq('projectId' as never, projectId as never))
        .collect()
      return tasks.filter(t => (t as OrgDoc<'task'>).orgId === orgId)
    }
  }),
  toggle = m({
    args: { id: zid('task'), orgId: zid('org') },
    handler: async (ctx, { id, orgId }) => {
      const { role } = await requireOrgMember(ctx.db, orgId, ctx.user._id),
        task = (await ctx.db.get(id)) as null | OrgDoc<'task'>
      if (!task || task.orgId !== orgId) return err('NOT_FOUND')

      const projectId = task.projectId as Id<'project'>,
        project = projectId ? ((await ctx.db.get(projectId)) as null | OrgDoc<'project'>) : null,
        pEditors = project ? (project.editors ?? []) : []
      if (!canEdit({ acl: true, doc: { editors: pEditors, userId: task.userId }, role, userId: ctx.user._id }))
        return err('FORBIDDEN')

      await ctx.db.patch(id, { completed: !task.completed, ...time() } as never)
      return ctx.db.get(id)
    }
  }),
  assign = m({
    args: {
      assigneeId: zid('users').optional(),
      id: zid('task'),
      orgId: zid('org')
    },
    handler: async (
      ctx,
      {
        assigneeId,
        id,
        orgId
      }: {
        assigneeId?: Id<'users'>
        id: Id<'task'>
        orgId: Id<'org'>
      }
    ) => {
      await requireOrgRole({ db: ctx.db, minRole: 'admin', orgId, userId: ctx.user._id })
      const task = (await ctx.db.get(id)) as null | OrgDoc<'task'>
      if (!task || task.orgId !== orgId) return err('NOT_FOUND')

      if (assigneeId) await requireOrgMember(ctx.db, orgId, assigneeId)

      await ctx.db.patch(id, { assigneeId: assigneeId ?? null, ...time() } as never)
      return ctx.db.get(id)
    }
  })

export { assign, bulkRm, bulkUpdate, byProject, create, list, read, rm, toggle, update }
