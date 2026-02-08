import { zid } from 'convex-helpers/server/zod4'

import type { Doc, Id } from '../convex/_generated/dataModel'
import type { ChildMeta, ChildTable } from './types'

import { m, q } from './builders'
import { err, time } from './helpers'

const pickSchemaFields = (args: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
    Object.fromEntries(keys.filter(k => k in args).map(k => [k, args[k]])),
  childCrud = <T extends ChildTable>(table: T, meta: ChildMeta<T>) => {
    type Parent = ChildMeta<T>['parent']
    type ChildDoc = Doc<T>
    const { foreignKey, index, parent, schema } = meta,
      getFK = (doc: Record<string, unknown>): Id<Parent> => doc[foreignKey] as Id<Parent>,
      schemaKeys = Object.keys(schema.shape),
      partial = schema.partial(),
      idArgs = { id: zid(table) },
      verifyParentOwnership = async (
        ctx: {
          db: { get: (id: Id<Parent>) => Promise<unknown> }
          user: Doc<'users'>
        },
        parentId: Id<Parent>
      ) => {
        const p = await ctx.db.get(parentId)
        return p && (p as { userId?: Id<'users'> }).userId === ctx.user._id ? p : null
      },
      create = m({
        args: { ...schema.shape, [foreignKey]: zid(parent) },
        handler: async (ctx, a) => {
          const args = a as Record<string, unknown>,
            parentId = args[foreignKey] as Id<Parent>,
            data = schema.parse(pickSchemaFields(args, schemaKeys))
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_FOUND')
          return ctx.db.insert(table, { ...data, [foreignKey]: parentId, ...time() } as never)
        }
      }),
      update = m({
        args: { ...idArgs, ...partial.shape },
        handler: async (ctx, a) => {
          const args = a as Record<string, unknown> & { id: Id<T> },
            { id, ...rest } = args,
            data = partial.parse(pickSchemaFields(rest, schemaKeys)),
            doc = await ctx.db.get(id)
          if (!doc) return err('NOT_FOUND')
          const parentId = getFK(doc as Record<string, unknown>)
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_FOUND')
          await ctx.db.patch(id, { ...data, ...time() } as never)
          return ctx.db.get(id)
        }
      }),
      rm = m({
        args: idArgs,
        handler: async (ctx, { id }) => {
          const doc = await ctx.db.get(id)
          if (!doc) return err('NOT_FOUND')
          const parentId = getFK(doc as Record<string, unknown>)
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_FOUND')
          await ctx.db.delete(id)
          return doc
        }
      }),
      list = q({
        args: { [foreignKey]: zid(parent) },
        handler: async (ctx, a) => {
          const args = a as Record<string, unknown>,
            parentId = args[foreignKey] as Id<Parent>
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_AUTHORIZED')
          return ctx.db
            .query(table)
            .withIndex(
              index as never,
              ((i: { eq: (k: string, v: unknown) => unknown }) => i.eq(foreignKey, parentId)) as never
            )
            .order('asc')
            .collect() as Promise<ChildDoc[]>
        }
      }),
      get = q({
        args: idArgs,
        handler: async (ctx, { id }) => {
          const doc = await ctx.db.get(id)
          if (!doc) return null
          const parentId = getFK(doc as Record<string, unknown>)
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_AUTHORIZED')
          return doc
        }
      })
    return { create, get, list, rm, update }
  }

export { childCrud }
