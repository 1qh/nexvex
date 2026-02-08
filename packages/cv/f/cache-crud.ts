/* eslint-disable no-await-in-loop */
import type { GenericValidator, Validator } from 'convex/values'
import type { z as _, ZodObject, ZodRawShape } from 'zod/v4'

import { zodOutputToConvexFields as z2c, zid } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { boolean } from 'zod/v4'

import type { Doc, Id, TableNames } from '../convex/_generated/dataModel'
import type { ActionCtx, MutationCtx } from '../convex/_generated/server'
import type { CacheOptions } from './types'

import { internal } from '../convex/_generated/api'
import { action, internalMutation, internalQuery, mutation, query } from '../convex/_generated/server'
import { cm, cq } from './builders'
import { err, noFetcher, pgOpts, time } from './helpers'

const cacheCrud = <
  T extends TableNames,
  S extends ZodRawShape,
  K extends keyof _.infer<ZodObject<S>> & keyof Doc<T> & string
>({
  fetcher,
  key,
  schema,
  table,
  ttl = 7 * 24 * 60 * 60 * 1000
}: CacheOptions<T, S, K>) => {
  type CD = _.infer<ZodObject<S>>
  type KV = Doc<T>[K]
  const keys = Object.keys(schema.shape),
    pick = (d: Record<string, unknown>): CD => Object.fromEntries(keys.filter(k => k in d).map(k => [k, d[k]])) as CD,
    valid = (d: Doc<T>) => ((d as { updatedAt?: number }).updatedAt ?? d._creationTime) + ttl > Date.now(),
    partial = schema.partial(),
    idx = `by_${key}` as const,
    kArgs = z2c({ [key]: schema.shape[key] } as never) as Record<string, GenericValidator>,
    idArgs = { id: zid(table) },
    expArgs = { includeExpired: boolean().optional() },
    listArgs = { includeExpired: boolean().optional(), paginationOpts: pgOpts },
    retFields = z2c(schema.extend({ cacheHit: boolean() }).shape) as Record<string, GenericValidator>,
    kVal = (kArgs[key] ?? err('INVALID_WHERE')) as Validator<KV>,
    byK = (x: unknown) => ((i: { eq: (k: string, vl: unknown) => unknown }) => i.eq(key, x)) as never,
    getInt = internalQuery({
      args: kArgs as never,
      handler: async (c, a: Record<K, KV>) =>
        c.db.query(table).withIndex(idx, byK(a[key])).first() as Promise<Doc<T> | null>
    }),
    get = query({
      args: kArgs,
      handler: async (c, a: Record<K, KV>) => {
        const d = await c.db.query(table).withIndex(idx, byK(a[key])).first()
        return d && valid(d) ? { ...d, cacheHit: true as const } : null
      }
    }),
    read = cq({ args: idArgs, handler: async (c, { id }) => c.db.get(id) }),
    all = cq({
      args: expArgs,
      handler: async (c, { includeExpired: ie }) => {
        const d = await c.db.query(table).order('desc').collect()
        return ie ? d : d.filter(valid)
      }
    }),
    list = cq({
      args: listArgs,
      handler: async (c, { includeExpired: ie, paginationOpts: op }) => {
        const qr = c.db.query(table).order('desc')
        if (ie) return qr.paginate(op)
        const { page, ...rest } = await qr.paginate({ ...op, numItems: op.numItems * 2 })
        return { ...rest, page: page.filter(valid).slice(0, op.numItems) }
      }
    }),
    upsert = async (c: MutationCtx, data: CD) => {
      const ex = await c.db.query(table).withIndex(idx, byK(data[key])).first(),
        wt = { ...data, ...time() }
      if (ex) {
        await c.db.patch(ex._id, wt as never)
        return ex._id
      }
      return c.db.insert(table, wt as never)
    },
    set = internalMutation({
      args: { data: v.object(z2c(schema.shape)) },
      handler: async (c, { data }: { data: Record<string, unknown> }) => {
        await upsert(c, pick(data))
      }
    }),
    create = cm({ args: schema.shape, handler: async (c, d) => upsert(c, d as CD) }),
    update = cm({
      args: { ...idArgs, ...partial.shape },
      handler: async (c, a) => {
        const { id, ...d } = a as Partial<CD> & { id: Id<T> },
          ex = await c.db.get(id),
          t = time()
        if (!ex) return err('NOT_FOUND')
        await c.db.patch(id, { ...d, ...t } as never)
        return { ...ex, ...d, ...t }
      }
    }),
    rm = cm({
      args: idArgs,
      handler: async (c, { id }) => {
        const d = await c.db.get(id)
        if (d) await c.db.delete(id)
        return d
      }
    }),
    invalidate = mutation({
      args: kArgs,
      handler: async (c, a: Record<K, KV>) => {
        const d = await c.db.query(table).withIndex(idx, byK(a[key])).first()
        if (d) await c.db.delete(d._id)
        return d
      }
    }),
    purge = cm({
      args: {},
      handler: async c => {
        const cut = Date.now() - ttl,
          exp = await c.db
            .query(table)
            .filter(qr => qr.lt(qr.field('_creationTime'), cut))
            .collect()
        // biome-ignore lint/performance/noAwaitInLoops: x
        for (const d of exp) await c.db.delete(d._id)
        return exp.length
      }
    }),
    tPath = (internal as Record<string, Record<string, unknown>>)[table] as {
      getInternal: string
      invalidate: string
      set: string
    },
    tKArgs = { [key]: kVal } as Record<K, typeof kVal>,
    doFetch = async (c: ActionCtx, kv: KV) => {
      const d = pick((await fetcher?.(c, kv)) as Record<string, unknown>)
      await c.runMutation(tPath.set as never, { data: d } as never)
      return { ...d, cacheHit: false as const }
    },
    load = fetcher
      ? action({
          args: tKArgs,
          handler: async (c, a): Promise<CD & { cacheHit: boolean }> => {
            const kv = (a as Record<K, KV>)[key],
              d = (await c.runQuery(tPath.getInternal as never, { [key]: kv } as never)) as Doc<T> | null
            return d && valid(d) ? { ...pick(d as Record<string, unknown>), cacheHit: true } : doFetch(c, kv)
          },
          returns: v.object(retFields)
        })
      : action(noFetcher),
    refresh = fetcher
      ? action({
          args: tKArgs,
          handler: async (c, a): Promise<CD & { cacheHit: boolean }> => {
            const kv = (a as Record<K, KV>)[key]
            await c.runMutation(tPath.invalidate as never, { [key]: kv } as never)
            return doFetch(c, kv)
          },
          returns: v.object(retFields)
        })
      : action(noFetcher)
  return { all, create, get, getInternal: getInt, invalidate, list, load, purge, read, refresh, rm, set, update }
}
export { cacheCrud }
