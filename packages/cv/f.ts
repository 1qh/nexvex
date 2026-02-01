// oxlint-disable promise/prefer-await-to-then
/* eslint-disable no-await-in-loop, no-continue, max-statements */
// biome-ignore-all lint/suspicious/useAwait: x
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/nursery/noContinue: x
import type { ExpressionOrValue, FilterBuilder, NamedTableInfo, paginationOptsValidator, Query } from 'convex/server'
import type { GenericValidator, Validator } from 'convex/values'
import type { z as _, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodRawShape } from 'zod/v4'

import { getAuthUserId } from '@convex-dev/auth/server'
import { customCtx } from 'convex-helpers/server/customFunctions'
import { zodOutputToConvexFields as z2c, zCustomMutation, zCustomQuery, zid } from 'convex-helpers/server/zod4'
import { ConvexError, v } from 'convex/values'
import { array, boolean, nullable, number, object, string } from 'zod/v4'

import type { DataModel, Doc, Id, TableNames } from './convex/_generated/dataModel'
import type { ActionCtx, DatabaseReader, MutationCtx, QueryCtx } from './convex/_generated/server'

import { internal } from './convex/_generated/api'
import { action, internalMutation, internalQuery, mutation, query } from './convex/_generated/server'
import { cvFileKindOf } from './zod'

interface AuthCtx extends ReadCtx {
  my: <T extends Own>(t: T) => Query<NamedTableInfo<DataModel, T>>
  user: Doc<'users'>
}
interface CacheOptions<
  T extends TableNames,
  S extends ZodRawShape,
  K extends keyof _.infer<ZodObject<S>> & keyof Doc<T> & string
> {
  fetcher?: (c: ActionCtx, key: Doc<T>[K]) => Promise<_.infer<ZodObject<S>>>
  key: K
  schema: ZodObject<S>
  table: T
  ttl?: number
}
interface CrudOptions<S extends ZodObject<ZodRawShape>> {
  auth?: { where?: WhereOf<S> }
  my?: { where?: WhereOf<S> }
  pub?: { where?: WhereOf<S> }
}
type Data<T extends TableNames> = Omit<Doc<T>, '_creationTime' | '_id' | 'updatedAt' | 'userId'>
type FID = Id<'_storage'>
type Own = { [K in TableNames]: Doc<K> extends { userId: Id<'users'> } ? K : never }[TableNames]
interface ReadCtx {
  db: DatabaseReader
  storage: QueryCtx['storage']
  viewerId: Id<'users'> | null
  withAuthor: <T extends WithUser>(docs: T[]) => Promise<(T & { author: Doc<'users'> | null; own: boolean | null })[]>
}
type UrlKey<K, V> =
  NonNullable<V> extends FID | FID[] | readonly FID[] ? `${K & string}Url${NonNullable<V> extends FID ? '' : 's'}` : never
type UrlVal<V> =
  NonNullable<V> extends FID | FID[] | readonly FID[]
    ? NonNullable<V> extends FID
      ? null | string
      : (null | string)[]
    : never

type WhereGroupOf<S extends ZodObject<ZodRawShape>> = Partial<_.infer<S>> & { own?: boolean }
type WhereOf<S extends ZodObject<ZodRawShape>> = WhereGroupOf<S> & { or?: WhereGroupOf<S>[] }
type WithUrls<D> = D & { [K in keyof D as UrlKey<K, D[K]>]: UrlVal<D[K]> }
interface WithUser {
  userId: Id<'users'>
}

const pgOpts = object({
    cursor: nullable(string()),
    endCursor: nullable(string()).optional(),
    id: number().optional(),
    maximumBytesRead: number().optional(),
    maximumRowsRead: number().optional(),
    numItems: number()
  } satisfies Record<keyof typeof paginationOptsValidator.fields, ZodNullable | ZodNumber | ZodOptional>),
  detectFiles = <S extends ZodRawShape>(s: S) => (Object.keys(s) as (keyof S & string)[]).filter(k => cvFileKindOf(s[k])),
  authId = async (c: MutationCtx | QueryCtx) => (await getAuthUserId(c)) as Id<'users'> | null,
  err = (code: string): never => {
    throw new ConvexError({ code })
  },
  noFetcher = (): never => {
    throw new Error('No fetcher')
  },
  time = () => ({ updatedAt: Date.now() }),
  getUser = async (c: MutationCtx | QueryCtx) => {
    const uid = await authId(c)
    if (!uid) return err('NOT_AUTHENTICATED')
    const u = await c.db.get(uid)
    return u ?? err('USER_NOT_FOUND')
  },
  ownGet =
    (c: MutationCtx | QueryCtx, u: Id<'users'>) =>
    async <T extends Own>(id: Id<T>): Promise<Doc<T>> => {
      const d = await c.db.get(id)
      return d && (d as { userId?: Id<'users'> }).userId === u ? (d as Doc<T>) : err('NOT_FOUND')
    },
  readCtx = (db: DatabaseReader, storage: ReadCtx['storage'], viewerId: Id<'users'> | null): ReadCtx => ({
    db,
    storage,
    viewerId,
    withAuthor: async <T extends WithUser>(docs: T[]) => {
      const ids = [...new Set(docs.map(d => d.userId))],
        users = await Promise.all(ids.map(async id => db.get(id))),
        map = new Map(ids.map((id, i) => [id, users[i]] as const))
      return docs.map(d => ({ ...d, author: map.get(d.userId) ?? null, own: viewerId ? viewerId === d.userId : null }))
    }
  }),
  pq = zCustomQuery(
    query,
    customCtx(async c => readCtx(c.db, c.storage, await authId(c)))
  ),
  q = zCustomQuery(
    query,
    customCtx(async c => {
      const user = await getUser(c)
      return {
        ...readCtx(c.db, c.storage, user._id),
        get: ownGet(c, user._id),
        my: <T extends Own>(t: T) => c.db.query(t).withIndex('by_user', o => o.eq('userId', user._id as never)),
        user
      }
    })
  ),
  m = zCustomMutation(
    mutation,
    customCtx(async c => {
      const now = time(),
        user = await getUser(c),
        { db, storage } = c,
        get = ownGet(c, user._id)
      return {
        create: async <T extends Own>(t: T, d: Data<T>) => db.insert(t, { ...d, ...now, userId: user._id } as never),
        db,
        delete: async <T extends Own>(id: Id<T>) => {
          const d = await get(id)
          await db.delete(id)
          return d
        },
        get,
        patch: async <T extends Own>(
          id: Id<T>,
          data: ((doc: Doc<T>) => Partial<Data<T>> | Promise<Partial<Data<T>>>) | Partial<Data<T>>
        ) => {
          const doc = await get(id),
            up = typeof data === 'function' ? await data(doc) : data
          await db.patch(id, { ...up, ...now } as unknown as Partial<Doc<T>>)
          return { ...doc, ...up, ...now } as Doc<T>
        },
        storage,
        user
      }
    })
  ),
  cq = zCustomQuery(
    query,
    customCtx(() => ({}))
  ),
  cm = zCustomMutation(
    mutation,
    customCtx(() => ({}))
  ),
  crud = <T extends Own, S extends ZodRawShape & { own?: never }>(
    table: T,
    schema: ZodObject<S>,
    opt?: CrudOptions<ZodObject<S>>
  ) => {
    type OwnDoc = Doc<T> & WithUser
    type WG = WhereGroupOf<ZodObject<S>>
    type W = WhereOf<ZodObject<S>>
    const partial = schema.partial(),
      fileFs = detectFiles(schema.shape),
      toId = (x: unknown): FID | null => (typeof x === 'string' ? (x as FID) : null),
      wgSchema = partial.extend({ own: boolean().optional() }),
      wSchema = wgSchema.extend({ or: array(wgSchema).optional() }),
      wArgs = { where: wSchema.optional() },
      idArgs = { id: zid(table) },
      parseW = (i: unknown, fb?: W): undefined | W =>
        i === undefined ? fb : wSchema.safeParse(i).success ? (wSchema.parse(i) as W) : err('INVALID_WHERE'),
      defaults = { auth: parseW(opt?.auth?.where), my: parseW(opt?.my?.where), pub: parseW(opt?.pub?.where) },
      addUrls = async <D extends Record<string, unknown>>(st: ReadCtx['storage'], doc: D): Promise<WithUrls<D>> => {
        if (!fileFs.length) return doc as WithUrls<D>
        const o = { ...doc } as Record<string, unknown>,
          getUrl = async (x: unknown) => {
            const id = toId(x)
            return id ? st.getUrl(id) : null
          }
        for (const f of fileFs) {
          const fv = doc[f]
          if (fv !== null)
            o[Array.isArray(fv) ? `${f}Urls` : `${f}Url`] = Array.isArray(fv)
              ? await Promise.all(fv.map(getUrl))
              : await getUrl(fv)
        }
        return o as WithUrls<D>
      },
      enrich = async (c: ReadCtx, docs: OwnDoc[]) =>
        Promise.all((await c.withAuthor(docs)).map(async d => addUrls(c.storage, d))),
      cleanFiles = async (st: MutationCtx['storage'], doc: Record<string, unknown>, next?: Record<string, unknown>) => {
        if (!fileFs.length) return
        const del = new Set<FID>()
        for (const f of fileFs) {
          const prev = doc[f]
          if (prev === null) continue
          const pArr = Array.isArray(prev) ? prev : [prev]
          if (!next) {
            for (const p of pArr) {
              const id = toId(p)
              if (id) del.add(id)
            }
            continue
          }
          if (!Object.hasOwn(next, f)) continue
          const nv = next[f],
            keep = new Set(Array.isArray(nv) ? nv : nv ? [nv] : [])
          for (const p of pArr)
            if (!keep.has(p as FID)) {
              const id = toId(p)
              if (id) del.add(id)
            }
        }
        if (del.size) await Promise.all([...del].map(async id => st.delete(id)))
      },
      groupList = (w?: W): WG[] =>
        w
          ? [{ ...w, or: undefined } as WG, ...(w.or ?? [])].filter(
              g => g.own ?? Object.keys(g).some(k => k !== 'own' && g[k as keyof WG] !== undefined)
            )
          : [],
      buildExpr = (fb: FilterBuilder<NamedTableInfo<DataModel, T>>, w: WG, vid: Id<'users'> | null) => {
        let e: ExpressionOrValue<boolean> | null = null
        const and = (x: ExpressionOrValue<boolean>) => {
          e = e ? fb.and(e, x) : x
        }
        // biome-ignore lint/nursery/noForIn: x
        for (const k in w)
          if (k !== 'own' && w[k as keyof WG] !== undefined) and(fb.eq(fb.field(k as never), w[k as keyof WG] as never))
        if (w.own) and(vid ? fb.eq(fb.field('userId'), vid as never) : fb.eq(true, false))
        return e
      },
      applyW = (qr: Query<NamedTableInfo<DataModel, T>>, w: undefined | W, vid: Id<'users'> | null) => {
        const gs = groupList(w)
        if (!gs.length) return qr
        return qr.filter(f => {
          let e: ExpressionOrValue<boolean> | null = null
          for (const g of gs) {
            const ge = buildExpr(f, g, vid)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (ge) e = e ? f.or(e, ge) : ge
          }
          return e ?? true
        })
      },
      matchW = (doc: Doc<T>, w?: W, vid?: Id<'users'> | null) => {
        const gs = groupList(w)
        if (!gs.length) return true
        for (const g of gs) {
          const ok = Object.entries(g).every(
            ([k, vl]: [string, unknown]) => k === 'own' || vl === undefined || Object.is(doc[k as keyof Doc<T>], vl)
          )
          if (ok && (!g.own || vid === doc.userId)) return true
        }
        return false
      },
      allH =
        (fb?: W) =>
        async (c: ReadCtx, { where }: { where?: unknown }) =>
          enrich(c, (await applyW(c.db.query(table), parseW(where, fb), c.viewerId).order('desc').collect()) as OwnDoc[]),
      listH =
        (fb?: W) =>
        async (c: ReadCtx, { paginationOpts: op, where }: { paginationOpts: _.infer<typeof pgOpts>; where?: unknown }) => {
          const { page, ...rest } = await applyW(c.db.query(table), parseW(where, fb), c.viewerId)
            .order('desc')
            .paginate(op)
          return { ...rest, page: await enrich(c, page as OwnDoc[]) }
        },
      readH =
        (fb?: W) =>
        async (c: ReadCtx, { id, where }: { id: Id<T>; where?: unknown }) => {
          const doc = await c.db.get(id),
            w = parseW(where, fb)
          return doc && matchW(doc, w, c.viewerId) ? ((await enrich(c, [doc as OwnDoc]))[0] ?? null) : null
        },
      myH =
        (fb?: W) =>
        async (c: AuthCtx, { where }: { where?: unknown }) =>
          enrich(c, (await applyW(c.my(table), parseW(where, fb), c.viewerId).order('desc').collect()) as OwnDoc[]),
      readApi = (wrap: typeof pq | typeof q, fb?: W) => ({
        all: wrap({ args: wArgs, handler: allH(fb) }),
        list: wrap({ args: { paginationOpts: pgOpts, ...wArgs }, handler: listH(fb) }),
        read: wrap({ args: { ...idArgs, ...wArgs }, handler: readH(fb) })
      })
    return {
      auth: readApi(q, defaults.auth),
      create: m({ args: schema.shape, handler: async (c, a) => c.create(table, a as Data<T>) }),
      my: q({ args: wArgs, handler: myH(defaults.my) }),
      pub: readApi(pq, defaults.pub),
      rm: m({
        args: idArgs,
        handler: async (c, { id }) => {
          const d = await c.delete(id as Id<T>)
          await cleanFiles(c.storage, d)
          return d
        }
      }),
      update: m({
        args: { ...idArgs, ...partial.shape },
        handler: async (c, a) => {
          const { id, ...d } = a as Record<string, unknown> & { id: Id<T> },
            prev = await c.get(id),
            ret = await c.patch(id, d as Partial<Data<T>>)
          await cleanFiles(c.storage, prev, d)
          return ret
        }
      })
    }
  },
  cache = <T extends TableNames, S extends ZodRawShape, K extends keyof _.infer<ZodObject<S>> & keyof Doc<T> & string>({
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
      valid = (d: Doc<T>) => d._creationTime + ttl > Date.now(),
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
        args: { data: v.any() },
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
          if (!ex) throw new Error('Not found')
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

export { cache, crud, err, m, pq, q }
