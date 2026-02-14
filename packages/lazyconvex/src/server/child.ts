import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zid } from 'convex-helpers/server/zod4'

import type { BaseBuilders, ChildCrudResult, DbReadLike, IndexLike, Rec, UserCtx } from './types'

import { dbDelete, dbInsert, dbPatch, err, pickFields, time } from './helpers'

interface ChildCrudOptions<PS extends ZodRawShape = ZodRawShape> {
  pub?: { parentField: keyof PS & string }
}

interface ChildMeta<S extends ZodRawShape = ZodRawShape, PS extends ZodRawShape = ZodRawShape> {
  foreignKey: string
  index: string
  parent: string
  parentSchema?: ZodObject<PS>
  schema: ZodObject<S>
}

const checkParentField = async (db: DbReadLike, parentId: string, field: string) => {
    const p = await db.get(parentId)
    return p?.[field] ? p : null
  },
  makeChildCrud = <S extends ZodRawShape, PS extends ZodRawShape = ZodRawShape>({
    builders,
    meta,
    options,
    table
  }: {
    builders: BaseBuilders
    meta: ChildMeta<S, PS>
    options?: ChildCrudOptions<PS>
    table: string
  }): ChildCrudResult<S> => {
    const { m, pq, q } = builders,
      { foreignKey, index, parent, schema } = meta,
      getFK = (doc: Rec): string => doc[foreignKey] as string,
      schemaKeys = Object.keys(schema.shape),
      partial = schema.partial(),
      idArgs = { id: zid(table) },
      // oxlint-disable-next-line unicorn/consistent-function-scoping
      verifyParentOwnership = async (ctx: UserCtx, parentId: string) => {
        const p = await ctx.db.get(parentId)
        return p && p.userId === ctx.user._id ? p : null
      },
      create = m({
        args: { ...schema.shape, [foreignKey]: zid(parent) },
        handler: (async (ctx: UserCtx, a: Rec) => {
          const args = a,
            parentId = args[foreignKey] as string,
            data = schema.parse(pickFields(args, schemaKeys))
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_FOUND', `${table}:create`)
          return dbInsert(ctx.db, table, { ...data, [foreignKey]: parentId, ...time() })
        }) as never
      }),
      update = m({
        args: { ...idArgs, ...partial.shape },
        handler: (async (ctx: UserCtx, a: Rec) => {
          const args = a as Rec & { id: string },
            { id, ...rest } = args,
            data = partial.parse(pickFields(rest, schemaKeys)),
            doc = await ctx.db.get(id)
          if (!doc) return err('NOT_FOUND', `${table}:update`)
          const parentId = getFK(doc)
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_FOUND', `${table}:update`)
          await dbPatch(ctx.db, id, { ...data, ...time() })
          return ctx.db.get(id)
        }) as never
      }),
      rm = m({
        args: idArgs,
        handler: (async (ctx: UserCtx, { id }: { id: string }) => {
          const doc = await ctx.db.get(id)
          if (!doc) return err('NOT_FOUND', `${table}:rm`)
          const parentId = getFK(doc)
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_FOUND', `${table}:rm`)
          await dbDelete(ctx.db, id)
          return doc
        }) as never
      }),
      list = q({
        args: { [foreignKey]: zid(parent) },
        handler: (async (ctx: UserCtx, a: Rec) => {
          const args = a,
            parentId = args[foreignKey] as string
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_AUTHORIZED', `${table}:list`)
          return ctx.db
            .query(table)
            .withIndex(index, ((i: IndexLike) => i.eq(foreignKey, parentId)) as never)
            .order('asc')
            .collect()
        }) as never
      }),
      get = q({
        args: idArgs,
        handler: (async (ctx: UserCtx, { id }: { id: string }) => {
          const doc = await ctx.db.get(id)
          if (!doc) return null
          const parentId = getFK(doc)
          if (!(await verifyParentOwnership(ctx, parentId))) return err('NOT_AUTHORIZED', `${table}:get`)
          return doc
        }) as never
      })
    const pubField = options?.pub?.parentField,
      pub =
        pubField && pq
          ? {
              get: pq({
                args: idArgs,
                handler: (async (ctx: { db: DbReadLike }, { id }: { id: string }) => {
                  const doc = await ctx.db.get(id)
                  if (!doc) return null
                  if (!(await checkParentField(ctx.db, getFK(doc), pubField))) return err('NOT_FOUND', `${table}:pub.get`)
                  return doc
                }) as never
              }),
              list: pq({
                args: { [foreignKey]: zid(parent) },
                handler: (async (ctx: { db: DbReadLike }, a: Rec) => {
                  const parentId = a[foreignKey] as string
                  if (!(await checkParentField(ctx.db, parentId, pubField))) return err('NOT_FOUND', `${table}:pub.list`)
                  return ctx.db
                    .query(table)
                    .withIndex(index, ((i: IndexLike) => i.eq(foreignKey, parentId)) as never)
                    .order('asc')
                    .collect()
                }) as never
              })
            }
          : undefined
    return { create, get, list, ...(pub ? { pub } : {}), rm, update } as unknown as ChildCrudResult<S>
  }

export { makeChildCrud }
