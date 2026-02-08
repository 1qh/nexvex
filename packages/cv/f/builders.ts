import { customCtx } from 'convex-helpers/server/customFunctions'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'

import type { Id } from '../convex/_generated/dataModel'
import type { Data, Own } from './types'

import { mutation, query } from '../convex/_generated/server'
import { authId, err, getUser, ownGet, readCtx, time } from './helpers'

const pq = zCustomQuery(
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
          data:
            | ((doc: Awaited<ReturnType<typeof get>>) => Partial<Data<T>> | Promise<Partial<Data<T>>>)
            | Partial<Data<T>>,
          expectedUpdatedAt?: number
        ) => {
          const doc = await get(id)
          if (expectedUpdatedAt !== undefined && (doc as Record<string, unknown>).updatedAt !== expectedUpdatedAt)
            return err('CONFLICT')
          const up = typeof data === 'function' ? await data(doc as unknown as Awaited<ReturnType<typeof get>>) : data
          await db.patch(id, { ...up, ...now } as never)
          return { ...doc, ...up, ...now }
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
  )

export { cm, cq, m, pq, q }
