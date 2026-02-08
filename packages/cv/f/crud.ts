// oxlint-disable promise/prefer-await-to-then
/* eslint-disable no-await-in-loop, no-continue, max-statements */
// biome-ignore-all lint/suspicious/useAwait: x
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/nursery/noContinue: x
import type { ExpressionOrValue, FilterBuilder, NamedTableInfo, Query } from 'convex/server'
import type { z as _, ZodObject, ZodRawShape } from 'zod/v4'

import { zid } from 'convex-helpers/server/zod4'
import { array, boolean, number, string } from 'zod/v4'

import type { DataModel, Doc, Id, TableNames } from '../convex/_generated/dataModel'
import type { MutationCtx } from '../convex/_generated/server'
import type { OwnedTable } from '../t'
import type { CrudOptions, Data, OwnDoc, ReadCtx, WhereGroupOf, WhereOf } from './types'

import { isStringType, unwrapZod } from '../zod'
import { m, pq, q } from './builders'
import {
  addUrls,
  cascadeFor,
  cleanFiles,
  detectFiles,
  err,
  errValidation,
  extractPatchData,
  groupList,
  isComparisonOp,
  log,
  matchW,
  pgOpts
} from './helpers'

const crud = <T extends OwnedTable, S extends ZodRawShape & { own?: never }>(
  table: T,
  schema: ZodObject<S>,
  opt?: CrudOptions<S>
) => {
  type WG = WhereGroupOf<S>
  type W = WhereOf<S>
  const stringFields: string[] = []
  // biome-ignore lint/nursery/noForIn: iterating shape keys with hasOwn guard
  for (const k in schema.shape)
    if (Object.hasOwn(schema.shape, k) && isStringType(unwrapZod(schema.shape[k]).type)) stringFields.push(k)
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
    enrich = async (c: ReadCtx, docs: OwnDoc<T>[]) =>
      Promise.all((await c.withAuthor(docs)).map(async d => addUrls(c.storage, d, fileFs))),
    buildExpr = (fb: FilterBuilder<NamedTableInfo<DataModel, T>>, w: WG, vid: Id<'users'> | null) => {
      let e: ExpressionOrValue<boolean> | null = null
      const and = (x: ExpressionOrValue<boolean>) => {
        e = e ? fb.and(e, x) : x
      }
      // biome-ignore lint/nursery/noForIn: x
      for (const k in w) {
        if (k === 'own') continue
        const fv = w[k as keyof WG]
        if (fv === undefined) continue
        const field = fb.field(k as never)
        if (isComparisonOp(fv)) {
          if (fv.$gt !== undefined) and(fb.gt(field, fv.$gt as never))
          if (fv.$gte !== undefined) and(fb.gte(field, fv.$gte as never))
          if (fv.$lt !== undefined) and(fb.lt(field, fv.$lt as never))
          if (fv.$lte !== undefined) and(fb.lte(field, fv.$lte as never))
          if (fv.$between !== undefined) {
            and(fb.gte(field, fv.$between[0] as never))
            and(fb.lte(field, fv.$between[1] as never))
          }
        } else and(fb.eq(field, fv as never))
      }
      if (w.own) and(vid ? fb.eq(fb.field('userId'), vid as never) : fb.eq(true, false))
      return e
    },
    canUseOwnIndex = (w: undefined | W): boolean => {
      if (!w || w.or?.length) return false
      const gs = groupList(w)
      return gs.length === 1 && gs[0]?.own === true
    },
    startQ = (c: ReadCtx, w: undefined | W) =>
      canUseOwnIndex(w) && c.viewerId
        ? c.db
            .query(table)
            .withIndex(
              'by_user' as never,
              ((o: { eq: (k: string, v: unknown) => unknown }) => o.eq('userId', c.viewerId)) as never
            )
        : c.db.query(table),
    applyW = (qr: Query<NamedTableInfo<DataModel, T>>, w: undefined | W, vid: Id<'users'> | null) => {
      let qry = qr
      if (opt?.softDelete) qry = qry.filter(fb => fb.eq(fb.field('deletedAt' as never), null))
      const gs = groupList(w)
      if (!gs.length) return qry
      return qry.filter(f => {
        let e: ExpressionOrValue<boolean> | null = null
        for (const g of gs) {
          const ge = buildExpr(f, g, vid)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (ge) e = e ? f.or(e, ge) : ge
        }
        return e ?? true
      })
    },
    allH =
      (fb?: W) =>
      async (c: ReadCtx, { where }: { where?: unknown }) => {
        const w = parseW(where, fb),
          docs = (await applyW(startQ(c, w), w, c.viewerId).order('desc').collect()) as OwnDoc<T>[]
        if (docs.length > 1000)
          log('warn', 'crud:large_result', { count: docs.length, table, tip: 'Use pagination or indexed queries' })
        return enrich(c, docs)
      },
    listH =
      (fb?: W) =>
      async (
        c: ReadCtx,
        {
          paginationOpts: op,
          where
        }: {
          paginationOpts: _.infer<typeof pgOpts>
          where?: unknown
        }
      ) => {
        const w = parseW(where, fb),
          { page, ...rest } = await applyW(startQ(c, w), w, c.viewerId).order('desc').paginate(op)
        return { ...rest, page: await enrich(c, page as OwnDoc<T>[]) }
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
          id: Id<T>
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
          if ((doc as { userId?: Id<'users'> }).userId !== c.viewerId) return null
        }
        return (await enrich(c, [doc as OwnDoc<T>]))[0] ?? null
      },
    countH =
      (fb?: W) =>
      async (c: ReadCtx, { where }: { where?: unknown }) => {
        const w = parseW(where, fb),
          docs = await applyW(startQ(c, w), w, c.viewerId).collect()
        if (docs.length > 1000)
          log('warn', 'crud:large_count', { count: docs.length, table, tip: 'Use indexed queries for large tables' })
        return docs.length
      },
    searchH =
      (fb?: W) =>
      async (
        c: ReadCtx,
        {
          fields: fs,
          query: qry,
          where
        }: {
          fields?: string[]
          query: string
          where?: unknown
        }
      ) => {
        const w = parseW(where, fb)
        try {
          const results = await c.db
              .query(table)
              .withSearchIndex('search_field' as never, sb => sb.search('text' as never, qry))
              .collect(),
            filtered = results.filter(d => matchW(d, w, c.viewerId))
          if (opt?.softDelete)
            return await enrich(c, filtered.filter(d => !(d as Record<string, unknown>).deletedAt) as OwnDoc<T>[])
          return await enrich(c, filtered as OwnDoc<T>[])
        } catch {
          log('warn', 'crud:search_fallback', { table, tip: 'Add a search index for better performance' })
          const searchFs = fs?.length ? fs : stringFields,
            lower = qry.toLowerCase(),
            docs = await applyW(startQ(c, w), w, c.viewerId).order('desc').collect(),
            matches = docs.filter(d => {
              const rec = d as Record<string, unknown>
              return searchFs.some(f => {
                const val = rec[f]
                if (typeof val !== 'string') return false
                return val.toLowerCase().includes(lower)
              })
            })
          return enrich(c, matches as OwnDoc<T>[])
        }
      },
    readApi = (wrap: typeof pq | typeof q, fb?: W) => ({
      all: wrap({ args: wArgs, handler: allH(fb) }),
      count: wrap({ args: wArgs, handler: countH(fb) }),
      list: wrap({ args: { paginationOpts: pgOpts, ...wArgs }, handler: listH(fb) }),
      read: wrap({ args: { ...idArgs, ...ownArg, ...wArgs }, handler: readH(fb) }),
      search: wrap({
        args: { fields: array(string()).optional(), query: string(), ...wArgs },
        handler: searchH(fb)
      })
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
            c.db
              .query(table)
              .withIndex(index as never, ((i: { eq: (k: string, vl: string) => unknown }) => i.eq(key, value)) as never),
            w,
            c.viewerId
          )
            .order('desc')
            .collect()
        return enrich(c, docs as OwnDoc<T>[])
      },
    rmHandler = async (
      c: {
        db: MutationCtx['db']
        delete: (id: Id<T>) => Promise<unknown>
        storage: MutationCtx['storage']
      },
      { id }: { id: Id<T> }
    ) => {
      if (opt?.cascade !== false)
        for (const { foreignKey: fk, table: tbl } of cascadeFor(table))
          for (const r of await c.db
            .query(tbl as TableNames)
            .filter(f => f.eq(f.field(fk as never), id))
            .collect())
            await c.db.delete(r._id)
      if (opt?.softDelete) {
        const doc = await c.db.get(id)
        if (!doc) {
          log('warn', 'crud:not_found', { id, table })
          return err('NOT_FOUND')
        }
        await c.db.patch(id, { deletedAt: Date.now() } as never)
        log('info', 'crud:delete', { id, soft: true, table })
        return doc as Doc<T>
      }
      const d = (await c.delete(id)) as Doc<T>
      await cleanFiles({ doc: d as Record<string, unknown>, fileFields: fileFs, storage: c.storage })
      log('info', 'crud:delete', { id, table })
      return d
    }
  return {
    auth: readApi(q, defaults.auth),
    authIndexed: q({
      args: { index: string(), key: string(), value: string(), ...wArgs },
      handler: indexedH(defaults.auth)
    }),
    bulkRm: m({
      args: { ids: bulkIdsSchema },
      handler: async (c, { ids }: { ids: Id<T>[] }) => {
        if (ids.length > 100) return err('LIMIT_EXCEEDED')
        let deleted = 0
        for (const id of ids) {
          await rmHandler(c as Parameters<typeof rmHandler>[0], { id })
          deleted += 1
        }
        return deleted
      }
    }),
    bulkUpdate: m({
      args: { data: partial, ids: bulkIdsSchema },
      handler: async (c, args) => {
        const a = args as {
            data: Record<string, unknown>
            ids: Id<T>[]
          },
          { data, ids } = a
        if (ids.length > 100) return err('LIMIT_EXCEEDED')
        const results: Doc<T>[] = []
        for (const id of ids) {
          const prev = await c.get(id),
            ret = await c.patch(id, data as Partial<Data<T>>)
          await cleanFiles({
            doc: prev as Record<string, unknown>,
            fileFields: fileFs,
            next: data,
            storage: c.storage
          })
          results.push(ret as unknown as Doc<T>)
        }
        return results
      }
    }),
    create: m({
      args: schema.shape,
      handler: async (c, a) => {
        const id = await c.create(table, a as never)
        log('info', 'crud:create', { table, userId: c.user._id })
        return id
      }
    }),
    pub: readApi(pq, defaults.pub),
    pubIndexed: pq({
      args: { index: string(), key: string(), value: string(), ...wArgs },
      handler: indexedH(defaults.pub)
    }),
    restore: opt?.softDelete
      ? m({
          args: idArgs,
          handler: async (c, { id }) => {
            const doc = await c.get(id)
            await c.db.patch(id, { deletedAt: null } as never)
            return { ...doc, deletedAt: null }
          }
        })
      : undefined,
    rm: m({ args: idArgs, handler: async (c, { id }) => rmHandler(c as Parameters<typeof rmHandler>[0], { id }) }),
    update: m({
      args: { ...idArgs, ...partial.shape, expectedUpdatedAt: number().optional() },
      handler: async (c, a) => {
        const args = a as Record<string, unknown>,
          id = args.id as Id<T>,
          expectedUpdatedAt = args.expectedUpdatedAt as number | undefined,
          d = extractPatchData(args, ['id', 'expectedUpdatedAt'] as const),
          prev = await c.get(id),
          ret = await c.patch(id, d as Partial<Data<T>>, expectedUpdatedAt)
        await cleanFiles({ doc: prev as Record<string, unknown>, fileFields: fileFs, next: d, storage: c.storage })
        log('info', 'crud:update', { id, table })
        return ret
      }
    })
  }
}

export { crud }
