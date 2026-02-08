/* eslint-disable no-await-in-loop, no-continue, max-statements */
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/nursery/noContinue: x
import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zid } from 'convex-helpers/server/zod4'
import { array, number } from 'zod/v4'

import type { Doc, Id, TableNames } from '../convex/_generated/dataModel'
import type { MutationCtx } from '../convex/_generated/server'
import type { OrgScopedTable } from '../t'
import type { OrgDoc } from './types'

import { m, q } from './builders'
import { cleanFiles, detectFiles, err, extractPatchData, pgOpts, time } from './helpers'
import { canEdit, getOrgMember, requireOrgMember, requireOrgRole } from './org-helpers'

interface AclFromOption<T extends TableNames = TableNames> {
  field: [TableNames] extends [T] ? string : keyof Doc<T> & string
  table: TableNames
}
interface CascadeOption {
  foreignKey: string
  table: TableNames
}
interface OrgCrudAclOptions<T extends TableNames = TableNames> {
  acl: true
  aclFrom?: AclFromOption<T>
  cascade?: CascadeOption
}
interface OrgCrudBaseOptions<T extends TableNames = TableNames> {
  acl?: false
  aclFrom?: AclFromOption<T>
  cascade?: CascadeOption
}
type OrgCrudOptions<T extends TableNames = TableNames> = OrgCrudAclOptions<T> | OrgCrudBaseOptions<T>
type OrgTable = OrgScopedTable
const resolveAclDoc = async <T extends TableNames>(
    db: MutationCtx['db'],
    doc: OrgDoc<TableNames>,
    opt?: OrgCrudOptions<T>
  ): Promise<{
    editors?: Id<'users'>[]
    userId: Id<'users'>
  }> => {
    if (opt?.aclFrom) {
      const parentId = (doc as Record<string, unknown>)[opt.aclFrom.field] as Id<TableNames>,
        parent = parentId ? ((await db.get(parentId)) as null | OrgDoc<TableNames>) : null
      return {
        editors: parent ? (((parent as Record<string, unknown>).editors as Id<'users'>[] | undefined) ?? []) : [],
        userId: doc.userId
      }
    }
    return doc
  },
  _orgCrud = <T extends OrgTable, S extends ZodRawShape>(table: T, schema: ZodObject<S>, opt?: OrgCrudOptions<T>) => {
    const partial = schema.partial(),
      bulkIdsSchema = array(zid(table)).max(100),
      fileFs = detectFiles(schema.shape),
      idArgs = { id: zid(table) },
      orgIdArg = { orgId: zid('org') },
      useAcl = Boolean(opt?.acl) || Boolean(opt?.aclFrom),
      cascadeDelete = async (db: MutationCtx['db'], id: Id<T>) => {
        if (!opt?.cascade) return
        const { foreignKey, table: tbl } = opt.cascade,
          kids = await db
            .query(tbl)
            .filter(f => f.eq(f.field(foreignKey as never), id))
            .collect()
        for (const kid of kids) await db.delete(kid._id)
      },
      create = m({
        args: { ...orgIdArg, ...schema.shape },
        handler: async (c, a) => {
          const args = a as Record<string, unknown>,
            orgId = args.orgId as Id<'org'>,
            data = extractPatchData(args, ['orgId'] as const)
          await requireOrgMember(c.db, orgId, c.user._id)
          const id = await c.db.insert(table, { ...data, orgId, userId: c.user._id, ...time() } as never)
          return id
        }
      }),
      list = q({
        args: { ...orgIdArg, paginationOpts: pgOpts },
        handler: async (c, { orgId, paginationOpts }) => {
          await requireOrgMember(c.db, orgId, c.user._id)
          return c.db
            .query(table)
            .withIndex('by_org', o => o.eq('orgId', orgId as never))
            .order('desc')
            .paginate(paginationOpts)
        }
      }),
      all = q({
        args: { ...orgIdArg },
        handler: async (c, { orgId }) => {
          await requireOrgMember(c.db, orgId, c.user._id)
          return c.db
            .query(table)
            .withIndex('by_org', o => o.eq('orgId', orgId as never))
            .order('desc')
            .collect()
        }
      }),
      read = q({
        args: { ...orgIdArg, ...idArgs },
        handler: async (c, { id, orgId }) => {
          await requireOrgMember(c.db, orgId, c.user._id)
          const doc = (await c.db.get(id)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          return doc
        }
      }),
      update = m({
        args: { ...orgIdArg, ...idArgs, ...partial.shape, expectedUpdatedAt: number().optional() },
        handler: async (c, a) => {
          const args = a as Record<string, unknown>,
            id = args.id as Id<T>,
            orgId = args.orgId as Id<'org'>,
            expectedUpdatedAt = args.expectedUpdatedAt as number | undefined,
            data = extractPatchData(args, ['id', 'orgId', 'expectedUpdatedAt'] as const),
            { role } = await requireOrgMember(c.db, orgId, c.user._id),
            doc = (await c.db.get(id)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          const aclDoc = await resolveAclDoc(c.db, doc as unknown as OrgDoc<TableNames>, opt)
          if (!canEdit({ acl: useAcl, doc: aclDoc, role, userId: c.user._id })) return err('FORBIDDEN')
          if (expectedUpdatedAt !== undefined && (doc as Record<string, unknown>).updatedAt !== expectedUpdatedAt)
            return err('CONFLICT')
          await c.db.patch(id, { ...data, ...time() } as never)
          return c.db.get(id) as Promise<OrgDoc<T>>
        }
      }),
      rm = m({
        args: { ...orgIdArg, ...idArgs },
        handler: async (c, { id, orgId }) => {
          const { role } = await requireOrgMember(c.db, orgId, c.user._id),
            doc = (await c.db.get(id)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          const aclDoc = await resolveAclDoc(c.db, doc as unknown as OrgDoc<TableNames>, opt)
          if (!canEdit({ acl: useAcl, doc: aclDoc, role, userId: c.user._id })) return err('FORBIDDEN')
          await cascadeDelete(c.db, id)
          await c.db.delete(id)
          await cleanFiles({ doc: doc as Record<string, unknown>, fileFields: fileFs, storage: c.storage })
          return doc
        }
      }),
      bulkUpdate = m({
        args: { ...orgIdArg, data: partial, ids: bulkIdsSchema },
        handler: async (c, a) => {
          const args = a as {
              data: Record<string, unknown>
              ids: Id<T>[]
              orgId: Id<'org'>
            },
            { data, ids, orgId } = args
          if (ids.length > 100) return err('LIMIT_EXCEEDED')
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
          const results: OrgDoc<T>[] = []
          for (const id of ids) {
            const doc = (await c.db.get(id)) as null | OrgDoc<T>
            if (!doc || doc.orgId !== orgId) continue
            await c.db.patch(id, { ...data, ...time() } as never)
            const updated = (await c.db.get(id)) as null | OrgDoc<T>
            if (updated) results.push(updated)
          }
          return results
        }
      }),
      bulkRm = m({
        args: { ...orgIdArg, ids: bulkIdsSchema },
        handler: async (c, a) => {
          const { ids, orgId } = a as {
            ids: Id<T>[]
            orgId: Id<'org'>
          }
          if (ids.length > 100) return err('LIMIT_EXCEEDED')
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
          let deleted = 0
          for (const id of ids) {
            const doc = (await c.db.get(id)) as null | OrgDoc<T>
            if (!doc || doc.orgId !== orgId) continue
            await cascadeDelete(c.db, id)
            await c.db.delete(id)
            await cleanFiles({ doc: doc as Record<string, unknown>, fileFields: fileFs, storage: c.storage })
            deleted += 1
          }
          return deleted
        }
      }),
      base = { all, bulkRm, bulkUpdate, create, list, read, rm, update }
    if (!opt?.acl)
      return base as typeof base & {
        addEditor?: undefined
        editors?: undefined
        removeEditor?: undefined
        setEditors?: undefined
      }
    const itemIdKey = `${table}Id` as const,
      itemIdArg = { [itemIdKey]: zid(table) } as unknown as Record<`${T}Id`, ReturnType<typeof zid>>,
      addEditor = m({
        args: { editorId: zid('users'), ...orgIdArg, ...itemIdArg },
        handler: async (c, a) => {
          const args = a as Record<string, unknown>,
            orgId = args.orgId as Id<'org'>,
            itemId = args[itemIdKey] as Id<T>,
            editorId = args.editorId as Id<'users'>
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
          const doc = (await c.db.get(itemId)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          const editorIsOwner = (await c.db.get(orgId))?.userId === editorId,
            editorMember = await getOrgMember(c.db, orgId, editorId)
          if (!(editorIsOwner || editorMember)) return err('NOT_ORG_MEMBER')
          const eds = ((doc as Record<string, unknown>).editors as Id<'users'>[] | undefined) ?? [],
            already = eds.some(eid => eid === editorId)
          if (already) return doc
          if (eds.length >= 100) return err('LIMIT_EXCEEDED')
          await c.db.patch(itemId, { editors: [...eds, editorId], ...time() } as never)
          return c.db.get(itemId) as Promise<OrgDoc<T>>
        }
      }),
      removeEditor = m({
        args: { editorId: zid('users'), ...orgIdArg, ...itemIdArg },
        handler: async (c, a) => {
          const args = a as Record<string, unknown>,
            orgId = args.orgId as Id<'org'>,
            itemId = args[itemIdKey] as Id<T>,
            editorId = args.editorId as Id<'users'>
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
          const doc = (await c.db.get(itemId)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          const eds = ((doc as Record<string, unknown>).editors as Id<'users'>[] | undefined) ?? [],
            filtered = eds.filter(eid => eid !== editorId)
          await c.db.patch(itemId, { editors: filtered, ...time() } as never)
          return c.db.get(itemId) as Promise<OrgDoc<T>>
        }
      }),
      editors = q({
        args: { ...orgIdArg, ...itemIdArg },
        handler: async (c, a) => {
          const args = a as Record<string, unknown>,
            orgId = args.orgId as Id<'org'>,
            itemId = args[itemIdKey] as Id<T>
          await requireOrgMember(c.db, orgId, c.user._id)
          const doc = (await c.db.get(itemId)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          const editorIds = ((doc as Record<string, unknown>).editors as Id<'users'>[] | undefined) ?? [],
            users = await Promise.all(editorIds.map(async eid => c.db.get(eid))),
            result: {
              email: string
              name: string
              userId: Id<'users'>
            }[] = []
          for (let i = 0; i < editorIds.length; i += 1) {
            const u = users[i],
              eid = editorIds[i]
            if (u && eid) result.push({ email: u.email ?? '', name: u.name ?? '', userId: eid })
          }
          return result
        }
      }),
      setEditors = m({
        args: { editorIds: array(zid('users')).max(100), ...orgIdArg, ...itemIdArg },
        handler: async (c, a) => {
          const args = a as Record<string, unknown>,
            orgId = args.orgId as Id<'org'>,
            itemId = args[itemIdKey] as Id<T>,
            editorIds = args.editorIds as Id<'users'>[]
          await requireOrgRole({ db: c.db, minRole: 'admin', orgId, userId: c.user._id })
          const doc = (await c.db.get(itemId)) as null | OrgDoc<T>
          if (!doc || doc.orgId !== orgId) return err('NOT_FOUND')
          for (const editorId of editorIds) {
            const isOwner = (await c.db.get(orgId))?.userId === editorId,
              member = await getOrgMember(c.db, orgId, editorId)
            if (!(isOwner || member)) return err('NOT_ORG_MEMBER')
          }
          await c.db.patch(itemId, { editors: editorIds, ...time() } as never)
          return c.db.get(itemId) as Promise<OrgDoc<T>>
        }
      })
    return { ...base, addEditor, editors, removeEditor, setEditors }
  }
type AclKeys = 'addEditor' | 'editors' | 'removeEditor' | 'setEditors'
type AclReturn<T extends OrgTable, S extends ZodRawShape> = NoAclReturn<T, S> & Required<Pick<FullReturn<T, S>, AclKeys>>
type FullReturn<T extends OrgTable, S extends ZodRawShape> = ReturnType<typeof _orgCrud<T, S>>
type NoAclReturn<T extends OrgTable, S extends ZodRawShape> = Omit<FullReturn<T, S>, AclKeys>
const orgCascade = <CT extends TableNames>(config: { foreignKey: keyof Doc<CT> & string; table: CT }): CascadeOption =>
    config,
  orgCrud: {
    <T extends OrgTable, S extends ZodRawShape>(table: T, schema: ZodObject<S>, opt: OrgCrudAclOptions<T>): AclReturn<T, S>
    <T extends OrgTable, S extends ZodRawShape>(
      table: T,
      schema: ZodObject<S>,
      opt?: OrgCrudBaseOptions<T>
    ): NoAclReturn<T, S>
  } = _orgCrud as never
export { type AclFromOption, type CascadeOption, orgCascade, orgCrud, type OrgCrudOptions, type OrgTable }
