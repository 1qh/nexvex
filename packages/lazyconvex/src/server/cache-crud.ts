/* eslint-disable no-await-in-loop, @typescript-eslint/no-unnecessary-type-parameters */
import type { GenericDataModel } from 'convex/server'
import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zodOutputToConvexFields as z2c, zid } from 'convex-helpers/server/zod4'
import { anyApi } from 'convex/server'
import { v } from 'convex/values'
import { boolean } from 'zod/v4'

import type {
  ActionCtxLike,
  CacheBuilders,
  CacheCrudResult,
  DbCtx,
  FilterLike,
  IndexLike,
  RateLimitConfig,
  Rec
} from './types'

import { checkRateLimit, dbDelete, dbInsert, dbPatch, err, noFetcher, pgOpts, pickFields, time } from './helpers'
import { isTestMode } from './test'

const makeCacheCrud = <S extends ZodRawShape, K extends string, DM extends GenericDataModel = GenericDataModel>({
  builders: b,
  fetcher,
  key,
  rateLimit: rl,
  schema,
  table,
  ttl = 7 * 24 * 60 * 60 * 1000
}: {
  builders: CacheBuilders<DM>
  fetcher?: (c: unknown, key: unknown) => Promise<unknown>
  key: K
  rateLimit?: RateLimitConfig
  schema: ZodObject<S>
  table: string
  ttl?: number
}): CacheCrudResult<S> => {
  const keys = Object.keys(schema.shape),
    pick = (d: Rec) => pickFields(d, keys),
    valid = (d: Rec) => ((d.updatedAt as number | undefined) ?? (d._creationTime as number)) + ttl > Date.now(),
    partial = schema.partial(),
    idx = `by_${key}` as const,
    kArgs = z2c({ [key]: schema.shape[key] } as never) as Rec,
    idArgs = { id: zid(table) },
    expArgs = { includeExpired: boolean().optional() },
    listArgs = { includeExpired: boolean().optional(), paginationOpts: pgOpts },
    retFields = z2c(schema.extend({ cacheHit: boolean() }).shape) as Rec,
    kVal = kArgs[key] ?? err('INVALID_WHERE'),
    byK = (x: unknown) => ((i: IndexLike) => i.eq(key, x)) as never,
    getInt = b.internalQuery({
      args: kArgs as never,
      handler: (async (c: DbCtx, a: Rec) => c.db.query(table).withIndex(idx, byK(a[key])).first()) as never
    }),
    get = b.query({
      args: kArgs as never,
      handler: (async (c: DbCtx, a: Rec) => {
        const d = await c.db.query(table).withIndex(idx, byK(a[key])).first()
        return d && valid(d) ? { ...d, cacheHit: true } : null
      }) as never
    }),
    read = b.cq({ args: idArgs, handler: (async (c: DbCtx, { id }: { id: string }) => c.db.get(id)) as never }),
    all = b.cq({
      args: expArgs,
      handler: (async (c: DbCtx, { includeExpired: ie }: { includeExpired?: boolean }) => {
        const d = await c.db.query(table).order('desc').collect()
        return ie ? d : d.filter(valid)
      }) as never
    }),
    list = b.cq({
      args: listArgs,
      handler: (async (
        c: DbCtx,
        { includeExpired: ie, paginationOpts: op }: { includeExpired?: boolean; paginationOpts: Rec }
      ) => {
        const qr = c.db.query(table).order('desc')
        if (ie) return qr.paginate(op)
        const { page, ...rest } = await qr.paginate({ ...op, numItems: (op.numItems as number) * 2 })
        return { ...rest, page: page.filter(valid).slice(0, op.numItems as number) }
      }) as never
    }),
    upsert = async (c: DbCtx, data: Rec) => {
      const ex = await c.db.query(table).withIndex(idx, byK(data[key])).first(),
        wt = { ...data, ...time() }
      if (ex) {
        await dbPatch(c.db, ex._id as string, wt)
        return ex._id
      }
      return dbInsert(c.db, table, wt)
    },
    set = b.internalMutation({
      args: { data: v.object(z2c(schema.shape) as never) },
      handler: (async (c: DbCtx, { data }: { data: Rec }) => {
        await upsert(c, pick(data))
      }) as never
    }),
    create = b.cm({
      args: schema.shape,
      handler: (async (c: DbCtx, d: Rec) => {
        if (rl && !isTestMode()) await checkRateLimit(c.db, { config: rl, key: `global:${table}`, table })
        return upsert(c, d)
      }) as never
    }),
    checkRL = rl
      ? b.internalMutation({
          args: {},
          handler: (async (c: DbCtx) => {
            await checkRateLimit(c.db, { config: rl, key: `global:${table}`, table })
          }) as never
        })
      : undefined,
    update = b.cm({
      args: { ...idArgs, ...partial.shape },
      handler: (async (c: DbCtx, a: Rec) => {
        const { id, ...d } = a as Rec & { id: string },
          ex = await c.db.get(id),
          t = time()
        if (!ex) return err('NOT_FOUND')
        await dbPatch(c.db, id, { ...d, ...t })
        return { ...ex, ...d, ...t }
      }) as never
    }),
    rm = b.cm({
      args: idArgs,
      handler: (async (c: DbCtx, { id }: { id: string }) => {
        const d = await c.db.get(id)
        if (d) await c.db.delete(id)
        return d
      }) as never
    }),
    invalidate = b.mutation({
      args: kArgs as never,
      handler: (async (c: DbCtx, a: Rec) => {
        const d = await c.db.query(table).withIndex(idx, byK(a[key])).first()
        if (d) await dbDelete(c.db, d._id as string)
        return d
      }) as never
    }),
    purge = b.cm({
      args: {},
      handler: (async (c: DbCtx) => {
        const cut = Date.now() - ttl,
          exp = await c.db
            .query(table)
            .filter((qr: FilterLike) => qr.lt(qr.field('_creationTime'), cut))
            .collect()
        // biome-ignore lint/performance/noAwaitInLoops: x
        for (const d of exp) await dbDelete(c.db, d._id as string)
        return exp.length
      }) as never
    }),
    tPath = (anyApi as Rec)[table] as Rec,
    tKArgs = { [key]: kVal } as Rec,
    doFetch = async (c: ActionCtxLike, kv: unknown) => {
      const d = pick((await fetcher?.(c, kv)) as Rec)
      await c.runMutation(tPath.set as string, { data: d })
      return { ...d, cacheHit: false }
    },
    load = fetcher
      ? b.action({
          args: tKArgs as never,
          handler: (async (c: ActionCtxLike, a: Rec) => {
            const kv = a[key],
              d = await c.runQuery(tPath.getInternal as string, { [key]: kv })
            if (d && valid(d as Rec)) return { ...pick(d as Rec), cacheHit: true }
            if (checkRL && !isTestMode()) await c.runMutation(tPath.checkRL as string, {})
            return doFetch(c, kv)
          }) as never,
          returns: v.object(retFields as never)
        })
      : b.action(noFetcher as never),
    refresh = fetcher
      ? b.action({
          args: tKArgs as never,
          handler: (async (c: ActionCtxLike, a: Rec) => {
            if (checkRL && !isTestMode()) await c.runMutation(tPath.checkRL as string, {})
            const kv = a[key]
            await c.runMutation(tPath.invalidate as string, { [key]: kv })
            return doFetch(c, kv)
          }) as never,
          returns: v.object(retFields as never)
        })
      : b.action(noFetcher as never)
  return {
    all,
    checkRL,
    create,
    get,
    getInternal: getInt,
    invalidate,
    list,
    load,
    purge,
    read,
    refresh,
    rm,
    set,
    update
  } as unknown as CacheCrudResult<S>
}

export { makeCacheCrud }
