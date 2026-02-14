/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
import type { GenericDataModel, GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import type { ZodObject, ZodRawShape } from 'zod/v4'

import { customCtx } from 'convex-helpers/server/customFunctions'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'

import type { OrgCrudOptions } from './org-crud'
import type { CrudOptions, DbLike, Mb, Qb, Rec, SetupConfig } from './types'

import { makeCacheCrud } from './cache-crud'
import { makeChildCrud } from './child'
import { makeCrud } from './crud'
import { dbInsert, dbPatch, err, getUser, makeUnique, ownGet, readCtx, time } from './helpers'
import { makeOrg } from './org'
import { makeOrgCrud } from './org-crud'

const setup = <DM extends GenericDataModel>(config: SetupConfig<DM>) => {
  type QCtx = GenericQueryCtx<DM>
  type MCtx = GenericMutationCtx<DM>
  const { getAuthUserId } = config,
    authId = async (c: unknown) => getAuthUserId(c as never),
    asDb = (c: { db: unknown }) => c.db as never as DbLike,
    pq = zCustomQuery(
      config.query,
      customCtx(async (c: QCtx) => {
        const vid = await authId(c),
          { withAuthor } = readCtx({ db: asDb(c), storage: c.storage as never, viewerId: vid })
        return { viewerId: vid, withAuthor }
      })
    ),
    q = zCustomQuery(
      config.query,
      customCtx(async (c: QCtx) => {
        const db = asDb(c),
          user = await getUser({ ctx: c as never, db, getAuthUserId }),
          { viewerId, withAuthor } = readCtx({ db, storage: c.storage as never, viewerId: user._id })
        return {
          get: ownGet(db, user._id),
          user,
          viewerId,
          withAuthor
        }
      })
    ),
    m = zCustomMutation(
      config.mutation,
      customCtx(async (c: MCtx) => {
        const db = asDb(c),
          now = time(),
          user = await getUser({ ctx: c as never, db, getAuthUserId }),
          get = ownGet(db, user._id)
        return {
          create: async (t: string, d: Rec) => dbInsert(db, t, { ...d, ...now, userId: user._id }),
          delete: async (id: string) => {
            const d = await get(id)
            await db.delete(id)
            return d
          },
          get,
          patch: async (
            id: string,
            data: ((doc: Rec) => Partial<Rec> | Promise<Partial<Rec>>) | Partial<Rec>,
            expectedUpdatedAt?: number
          ) => {
            const doc = await get(id)
            if (expectedUpdatedAt !== undefined && doc.updatedAt !== expectedUpdatedAt) return err('CONFLICT')
            const up = typeof data === 'function' ? await data(doc) : data
            await dbPatch(db, id, { ...up, ...now })
            return { ...doc, ...up, ...now }
          },
          user
        }
      })
    ),
    cq = zCustomQuery(
      config.query,
      customCtx(() => ({}))
    ),
    cm = zCustomMutation(
      config.mutation,
      customCtx(() => ({}))
    ),
    children = config.children ?? {},
    crud = <S extends ZodRawShape>(table: string, schema: ZodObject<S>, opt?: CrudOptions<S>) =>
      makeCrud({
        builders: { children, cm, cq, m: m as never as Mb, pq: pq as never as Qb, q: q as never as Qb },
        options: opt,
        schema,
        table
      }),
    childCrud = <S extends ZodRawShape, PS extends ZodRawShape = ZodRawShape>(
      table: string,
      meta: { foreignKey: string; index: string; parent: string; parentSchema?: ZodObject<PS>; schema: ZodObject<S> },
      opt?: { pub?: { parentField: keyof PS & string } }
    ) =>
      makeChildCrud({
        builders: { m: m as never as Mb, pq: pq as never as Qb, q: q as never as Qb },
        meta,
        options: opt,
        table
      }),
    orgCrud = <S extends ZodRawShape>(table: string, schema: ZodObject<S>, opt?: OrgCrudOptions<S>) =>
      makeOrgCrud({
        builders: { m: m as never as Mb, q: q as never as Qb },
        options: opt,
        schema,
        table
      }),
    cacheCrud = <S extends ZodRawShape, K extends keyof S & string>(opts: {
      fetcher?: (c: unknown, key: unknown) => Promise<unknown>
      key: K
      rateLimit?: { max: number; window: number }
      schema: ZodObject<S>
      table: string
      ttl?: number
    }) =>
      makeCacheCrud({
        ...opts,
        builders: {
          action: config.action,
          cm,
          cq,
          internalMutation: config.internalMutation,
          internalQuery: config.internalQuery,
          mutation: config.mutation,
          query: config.query
        }
      }),
    uniqueCheck = <S extends ZodRawShape>(_schema: ZodObject<S>, table: string, field: keyof S & string) =>
      makeUnique({ field, pq: pq as never as Qb, table }),
    org = config.orgSchema
      ? makeOrg({
          cascadeTables: config.orgCascadeTables,
          getAuthUserId: config.getAuthUserId,
          mutation: config.mutation,
          query: config.query,
          schema: config.orgSchema
        })
      : undefined,
    user = { me: q({ handler: (c: Rec) => c.user }) }
  return { cacheCrud, childCrud, cm, cq, crud, m, org, orgCrud, pq, q, uniqueCheck, user }
}

export { setup }
