import { zid } from 'convex-helpers/server/zod4'
import { string } from 'zod/v4'

import type { Doc, TableNames } from '../convex/_generated/dataModel'

import { pq } from './builders'

type StringFields<T extends TableNames> = {
  [K in keyof Doc<T>]: Doc<T>[K] extends string ? K : never
}[keyof Doc<T>]

const uniqueCheck = <T extends TableNames>(table: T, field: StringFields<T>) =>
  pq({
    args: { exclude: zid(table).optional(), value: string() },
    handler: async (c, { exclude, value }) => {
      const existing = await c.db
        .query(table)
        .filter(f => f.eq(f.field(field as never), value as never))
        .first()
      return !existing || existing._id === exclude
    }
  })

export { uniqueCheck }
