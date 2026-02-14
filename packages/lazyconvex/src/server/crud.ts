// oxlint-disable promise/prefer-await-to-then
/* eslint-disable no-await-in-loop, no-continue, max-statements */
// biome-ignore-all lint/suspicious/useAwait: x
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/nursery/noContinue: x
import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zid } from 'convex-helpers/server/zod4'
import { array, boolean, number, string } from 'zod/v4'

import type {
  CrudBuilders,
  CrudOptions,
  CrudResult,
  DbLike,
  EnrichedDoc,
  FilterLike,
  IndexLike,
  MutCtx,
  Qb,
  ReadCtx,
  Rec,
  SearchLike,
  StorageLike
} from './types'

import {
  addUrls,
  cascadeFor,
  checkRateLimit,
  cleanFiles,
  dbDelete,
  dbPatch,
  detectFiles,
  err,
  errValidation,
  groupList,
  isComparisonOp,
  log,
  matchW,
  pgOpts
} from './helpers'
import { isTestMode } from './test'

interface CrudMCtx extends MutCtx {
  create: (t: string, d: Rec) => Promise<string>
  delete: (id: string) => Promise<unknown>
  get: (id: string) => Promise<Rec>
  patch: (id: string, data: Rec, expectedUpdatedAt?: number) => Promise<Rec>
}

const makeCrud = <S extends ZodRawShape>({
  builders,
  options: opt,
  schema,
  table
}: {
  builders: CrudBuilders
  options?: CrudOptions<S>
  schema: ZodObject<S>
  table: string
}) => {
  type WG = Rec & { own?: boolean }
  type W = WG & { or?: WG[] }
  const { m, pq, q } = builders,
    searchCfg =
      opt?.search === 'index'
        ? { field: 'text', index: 'search_field' }
        : typeof opt?.search === 'object'
          ? { field: opt.search.field ?? 'text', index: opt.search.index ?? 'search_field' }
          : null
  const partial = schema.partial(),
    bulkIdsSchema = array(zid(table)).max(100),
    fileFs = detectFiles(schema.shape),
    wgSchema = partial.extend({ own: boolean().optional() }),
    wSchema = wgSchema.extend({ or: array(wgSchema).optional() }),
    wArgs = { where: wSchema.optional() },
    ownArg = { own: boolean().optional() },
    idArgs = { id: zid(table) },
    parseW = (i: unknown, fb?: W): undefined | W => {
      if (i === undefined) return fb
      const r = wSchema.safeParse(i)
      return r.success ? (r.data as W) : errValidation('INVALID_WHERE', r.error)
    },
    defaults = { auth: parseW(opt?.auth?.where), pub: parseW(opt?.pub?.where) },
    enrich = async (c: ReadCtx, docs: Rec[]) =>
      Promise.all(
        (await c.withAuthor(docs as { userId: string }[])).map(async d =>
          addUrls({ doc: d, fileFields: fileFs, storage: c.storage })
        )
      ) as Promise<EnrichedDoc<S>[]>,
    buildExpr = (fb: FilterLike, w: WG, vid: null | string) => {
      let e: unknown = null
      const and = (x: unknown) => {
        e = e ? fb.and(e, x) : x
      }
      // biome-ignore lint/nursery/noForIn: x
      for (const k in w) {
        if (k === 'own') continue
        const fv = w[k]
        if (fv === undefined) continue
        const field = fb.field(k)
        if (isComparisonOp(fv)) {
          if (fv.$gt !== undefined) and(fb.gt(field, fv.$gt))
          if (fv.$gte !== undefined) and(fb.gte(field, fv.$gte))
          if (fv.$lt !== undefined) and(fb.lt(field, fv.$lt))
          if (fv.$lte !== undefined) and(fb.lte(field, fv.$lte))
          if (fv.$between !== undefined) {
            and(fb.gte(field, fv.$between[0]))
            and(fb.lte(field, fv.$between[1]))
          }
        } else and(fb.eq(field, fv))
      }
      if (w.own) and(vid ? fb.eq(fb.field('userId'), vid) : fb.eq(true, false))
      return e
    },
    canUseOwnIndex = (w: undefined | W): boolean => {
      if (!w || w.or?.length) return false
      const gs = groupList(w)
      return gs.length === 1 && gs[0]?.own === true
    },
    startQ = (c: ReadCtx, w: undefined | W) =>
      canUseOwnIndex(w) && c.viewerId
        ? c.db.query(table).withIndex('by_user', ((o: IndexLike) => o.eq('userId', c.viewerId)) as never)
        : c.db.query(table),
    applyW = (qr: ReturnType<ReadCtx['db']['query']>, w: undefined | W, vid: null | string) => {
      let qry = qr
      // oxlint-disable-next-line unicorn/no-useless-undefined
      if (opt?.softDelete) qry = qry.filter((fb: FilterLike) => fb.eq(fb.field('deletedAt'), undefined))
      const gs = groupList(w)
      if (!gs.length) return qry
      return qry.filter((f: FilterLike) => {
        let e: unknown = null
        for (const g of gs) {
          const ge = buildExpr(f, g, vid)
          if (ge) e = e ? f.or(e, ge) : ge
        }
        return e ?? true
      })
    },
    listH =
      (fb?: W) =>
      async (
        c: ReadCtx,
        {
          paginationOpts: op,
          where
        }: {
          paginationOpts: unknown
          where?: unknown
        }
      ) => {
        const w = parseW(where, fb),
          { page, ...rest } = await applyW(startQ(c, w), w, c.viewerId)
            .order('desc')
            .paginate(op as Rec)
        return { ...rest, page: await enrich(c, page) }
      },
    readH =
      (fb?: W) =>
      async (
        c: ReadCtx,
        {
          id,
          own,
          where
        }: {
          id: string
          own?: boolean
          where?: unknown
        }
      ) => {
        const doc = await c.db.get(id),
          w = parseW(where, fb)
        if (!doc) return null
        if (!matchW(doc, w, c.viewerId)) return null
        if (own) {
          if (!c.viewerId) return null
          if ((doc as { userId?: string }).userId !== c.viewerId) return null
        }
        return (await enrich(c, [doc]))[0] ?? null
      },
    searchIndexed = async (c: ReadCtx, qry: string, w: undefined | W) => {
      const sIdx = searchCfg?.index ?? 'search_field',
        sField = searchCfg?.field ?? 'text',
        results = await c.db
          .query(table)
          .withSearchIndex(sIdx, ((sb: SearchLike) => sb.search(sField, qry)) as never)
          .collect(),
        filtered = results.filter(d => matchW(d, w, c.viewerId))
      if (opt?.softDelete)
        return enrich(
          c,
          filtered.filter((d: Rec) => !d.deletedAt)
        )
      return enrich(c, filtered)
    },
    searchH =
      (fb?: W) =>
      async (
        c: ReadCtx,
        {
          query: qry,
          where
        }: {
          query: string
          where?: unknown
        }
      ) => {
        const w = parseW(where, fb)
        return searchIndexed(c, qry, w)
      },
    readApi = (wrap: Qb, fb?: W) => ({
      list: wrap({ args: { paginationOpts: pgOpts, ...wArgs }, handler: listH(fb) as never }),
      read: wrap({ args: { ...idArgs, ...ownArg, ...wArgs }, handler: readH(fb) as never }),
      ...(searchCfg
        ? {
            search: wrap({
              args: { query: string(), ...wArgs },
              handler: searchH(fb) as never
            })
          }
        : {})
    }),
    indexedH =
      (fb?: W) =>
      async (
        c: ReadCtx,
        {
          index,
          key,
          value,
          where
        }: {
          index: string
          key: string
          value: string
          where?: unknown
        }
      ) => {
        const w = parseW(where, fb),
          docs = await applyW(
            c.db.query(table).withIndex(index, ((i: IndexLike) => i.eq(key, value)) as never),
            w,
            c.viewerId
          )
            .order('desc')
            .collect()
        return enrich(c, docs)
      },
    rmHandler = async (
      c: {
        db: DbLike
        delete: (id: string) => Promise<unknown>
        storage: StorageLike
      },
      { id }: { id: string }
    ) => {
      if (opt?.cascade !== false)
        for (const { foreignKey: fk, table: tbl } of cascadeFor(table, builders.children))
          for (const r of await c.db
            .query(tbl)
            .filter((f: FilterLike) => f.eq(f.field(fk), id))
            .collect())
            await dbDelete(c.db, r._id as string)
      if (opt?.softDelete) {
        const doc = await c.db.get(id)
        if (!doc) {
          log('warn', 'crud:not_found', { id, table })
          return err('NOT_FOUND', `${table}:rm`)
        }
        await dbPatch(c.db, id, { deletedAt: Date.now() })
        log('info', 'crud:delete', { id, soft: true, table })
        return doc
      }
      const d = await c.delete(id)
      await cleanFiles({ doc: d as Rec, fileFields: fileFs, storage: c.storage })
      log('info', 'crud:delete', { id, table })
      return d
    }
  return {
    auth: readApi(q, defaults.auth),
    authIndexed: q({
      args: { index: string(), key: string(), value: string(), ...wArgs },
      handler: indexedH(defaults.auth) as never
    }),
    bulkRm: m({
      args: { ids: bulkIdsSchema },
      handler: (async (c: CrudMCtx, { ids }: { ids: string[] }) => {
        if (ids.length > 100) return err('LIMIT_EXCEEDED', `${table}:bulkRm`)
        let deleted = 0
        for (const id of ids) {
          await rmHandler(c as never, { id })
          deleted += 1
        }
        return deleted
      }) as never
    }),
    bulkUpdate: m({
      args: { data: partial, ids: bulkIdsSchema },
      handler: (async (c: CrudMCtx, args: Rec) => {
        const { data, ids } = args as { data: Rec; ids: string[] }
        if (ids.length > 100) return err('LIMIT_EXCEEDED', `${table}:bulkUpdate`)
        const results: unknown[] = []
        for (const id of ids) {
          const prev = await c.get(id),
            ret = await c.patch(id, data)
          await cleanFiles({ doc: prev, fileFields: fileFs, next: data, storage: c.storage })
          results.push(ret)
        }
        return results
      }) as never
    }),
    create: m({
      args: schema.shape,
      handler: (async (c: CrudMCtx, a: Rec) => {
        if (opt?.rateLimit && !isTestMode())
          await checkRateLimit(c.db, { config: opt.rateLimit, key: c.user._id as string, table })
        const id = await c.create(table, a)
        log('info', 'crud:create', { table, userId: c.user._id })
        return id
      }) as never
    }),
    pub: readApi(pq, defaults.pub),
    pubIndexed: pq({
      args: { index: string(), key: string(), value: string(), ...wArgs },
      handler: indexedH(defaults.pub) as never
    }),
    restore: opt?.softDelete
      ? m({
          args: idArgs,
          handler: (async (c: CrudMCtx, { id }: { id: string }) => {
            const doc = await c.get(id)
            await dbPatch(c.db, id, { deletedAt: undefined })
            return { ...doc, deletedAt: undefined }
          }) as never
        })
      : undefined,
    rm: m({
      args: idArgs,
      handler: (async (c: CrudMCtx, { id }: { id: string }) => rmHandler(c as never, { id })) as never
    }),
    update: m({
      args: { ...idArgs, ...partial.shape, expectedUpdatedAt: number().optional() },
      handler: (async (c: CrudMCtx, a: Rec) => {
        const { expectedUpdatedAt, id, ...rest } = a as Rec & {
            expectedUpdatedAt?: number
            id: string
          },
          patch = rest as Rec,
          prev = await c.get(id),
          ret = await c.patch(id, patch, expectedUpdatedAt)
        await cleanFiles({ doc: prev, fileFields: fileFs, next: patch, storage: c.storage })
        log('info', 'crud:update', { id, table })
        return ret
      }) as never
    })
  } as unknown as CrudResult<S>
}

export { makeCrud }
