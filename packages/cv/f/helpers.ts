/* eslint-disable no-await-in-loop, no-continue, max-statements */
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/nursery/noContinue: x
import type { ZodRawShape } from 'zod/v4'

import { ConvexError } from 'convex/values'
import { nullable, number, object, string } from 'zod/v4'

import type { Doc, Id } from '../convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../convex/_generated/server'
import type {
  ChildMeta,
  ChildTable,
  ComparisonOp,
  ErrorCode,
  FID,
  Own,
  PaginationOptsShape,
  ReadCtx,
  WithUrls
} from './types'

import { getAuthUserIdOrTest } from '../convex/testauth'
import { children } from '../t'
import { cvFileKindOf } from '../zod'

const log = (level: 'debug' | 'error' | 'info' | 'warn', msg: string, data?: Record<string, unknown>) => {
    console[level](JSON.stringify({ level, msg, ts: Date.now(), ...data }))
  },
  isComparisonOp = (val: unknown): val is ComparisonOp<unknown> =>
    typeof val === 'object' &&
    val !== null &&
    ('$gt' in val || '$gte' in val || '$lt' in val || '$lte' in val || '$between' in val),
  pgOpts = object({
    cursor: nullable(string()),
    endCursor: nullable(string()).optional(),
    id: number().optional(),
    maximumBytesRead: number().optional(),
    maximumRowsRead: number().optional(),
    numItems: number()
  } satisfies PaginationOptsShape),
  cascadeFor = (
    parent: string
  ): {
    foreignKey: ChildMeta['foreignKey']
    table: ChildTable
  }[] =>
    (Object.entries(children) as [ChildTable, ChildMeta][])
      .filter(([, c]) => c.parent === parent)
      .map(([table, c]) => ({ foreignKey: c.foreignKey, table })),
  detectFiles = <S extends ZodRawShape>(s: S) => (Object.keys(s) as (keyof S & string)[]).filter(k => cvFileKindOf(s[k])),
  authId = async (c: MutationCtx | QueryCtx) => getAuthUserIdOrTest(c),
  err = (code: ErrorCode): never => {
    throw new ConvexError({ code })
  },
  errMsg = (code: ErrorCode, message: string): never => {
    throw new ConvexError({ code, message })
  },
  noFetcher = (): never => err('NO_FETCHER'),
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
  readCtx = (db: ReadCtx['db'], storage: ReadCtx['storage'], viewerId: Id<'users'> | null): ReadCtx => ({
    db,
    storage,
    viewerId,
    withAuthor: async <T extends { userId: Id<'users'> }>(docs: T[]) => {
      const ids = [...new Set(docs.map(d => d.userId))],
        users = await Promise.all(ids.map(async id => db.get(id))),
        map = new Map(ids.map((id, i) => [id, users[i]] as const))
      return docs.map(d => ({ ...d, author: map.get(d.userId) ?? null, own: viewerId ? viewerId === d.userId : null }))
    }
  }),
  toId = (x: unknown): FID | null => (typeof x === 'string' ? (x as FID) : null),
  cleanFiles = async (opts: {
    doc: Record<string, unknown>
    fileFields: string[]
    next?: Record<string, unknown>
    storage: MutationCtx['storage']
  }) => {
    const { doc, fileFields, next, storage } = opts
    if (!fileFields.length) return
    const del = new Set<FID>()
    for (const f of fileFields) {
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
    if (del.size) await Promise.all([...del].map(async id => storage.delete(id)))
  },
  addUrls = async <D extends Record<string, unknown>>(
    storage: ReadCtx['storage'],
    doc: D,
    fileFields: string[]
  ): Promise<WithUrls<D>> => {
    if (!fileFields.length) return doc as WithUrls<D>
    const o = { ...doc } as Record<string, unknown>,
      getUrl = async (x: unknown) => {
        const id = toId(x)
        return id ? storage.getUrl(id) : null
      }
    for (const f of fileFields) {
      const fv = doc[f]
      if (fv !== null)
        o[Array.isArray(fv) ? `${f}Urls` : `${f}Url`] = Array.isArray(fv)
          ? await Promise.all(fv.map(getUrl))
          : await getUrl(fv)
    }
    return o as WithUrls<D>
  },
  matchField = (docVal: unknown, filterVal: unknown): boolean => {
    if (isComparisonOp(filterVal)) {
      const dv = docVal as number
      if (filterVal.$gt !== undefined && !(dv > (filterVal.$gt as number))) return false
      if (filterVal.$gte !== undefined && !(dv >= (filterVal.$gte as number))) return false
      if (filterVal.$lt !== undefined && !(dv < (filterVal.$lt as number))) return false
      if (filterVal.$lte !== undefined && !(dv <= (filterVal.$lte as number))) return false
      if (filterVal.$between !== undefined) {
        const [min, max] = filterVal.$between as [number, number]
        if (!(dv >= min && dv <= max)) return false
      }
      return true
    }
    return Object.is(docVal, filterVal)
  },
  groupList = <WG extends Record<string, unknown> & { own?: boolean }>(w?: WG & { or?: WG[] }): WG[] =>
    w
      ? [{ ...w, or: undefined } as WG, ...(w.or ?? [])].filter(
          g => g.own ?? Object.keys(g).some(k => k !== 'own' && g[k] !== undefined)
        )
      : [],
  matchW = <WG extends Record<string, unknown> & { own?: boolean }>(
    doc: Record<string, unknown>,
    w: undefined | (WG & { or?: WG[] }),
    vid?: Id<'users'> | null
  ) => {
    const gs = groupList(w)
    if (!gs.length) return true
    for (const g of gs) {
      const ok = Object.entries(g).every(
        ([k, vl]: [string, unknown]) => k === 'own' || vl === undefined || matchField(doc[k], vl)
      )
      if (ok && (!g.own || vid === (doc as { userId?: Id<'users'> }).userId)) return true
    }
    return false
  },
  extractPatchData = (args: Record<string, unknown>, exclude: readonly string[]): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const k of Object.keys(args)) if (!exclude.includes(k)) result[k] = args[k]
    return result
  },
  errValidation = (
    code: ErrorCode,
    zodError: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }
  ): never => {
    const { fieldErrors } = zodError.flatten(),
      fields = Object.keys(fieldErrors)
    throw new ConvexError({ code, fields, message: fields.length ? `Invalid: ${fields.join(', ')}` : 'Validation failed' })
  }

export {
  addUrls,
  authId,
  cascadeFor,
  cleanFiles,
  detectFiles,
  err,
  errMsg,
  errValidation,
  extractPatchData,
  getUser,
  groupList,
  isComparisonOp,
  log,
  matchField,
  matchW,
  noFetcher,
  ownGet,
  pgOpts,
  readCtx,
  time,
  toId
}
