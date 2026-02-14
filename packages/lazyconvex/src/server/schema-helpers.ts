import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zodOutputToConvexFields as z2c } from 'convex-helpers/server/zod4'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import { elementOf, isArrayType, unwrapZod } from '../zod'
import { isRecord } from './helpers'

const baseTable = <T extends ZodRawShape>(s: ZodObject<T>) =>
    defineTable({ ...z2c(s.shape), updatedAt: v.optional(v.number()) }),
  ownedTable = <T extends ZodRawShape>(s: ZodObject<T>) =>
    defineTable({ ...z2c(s.shape), updatedAt: v.number(), userId: v.id('users') }).index('by_user', ['userId' as never]),
  orgTable = <T extends ZodRawShape>(s: ZodObject<T>) =>
    defineTable({
      ...z2c(s.shape),
      orgId: v.id('org'),
      updatedAt: v.number(),
      userId: v.id('users')
    })
      .index('by_org', ['orgId' as never])
      .index('by_org_user', ['orgId' as never, 'userId' as never]),
  orgChildTable = <T extends ZodRawShape>(
    s: ZodObject<T>,
    parent: {
      foreignKey: string
      table: string
    }
  ) =>
    defineTable({
      ...z2c(s.shape),
      orgId: v.id('org'),
      updatedAt: v.number(),
      userId: v.id('users')
    })
      .index('by_org', ['orgId' as never])
      .index('by_parent', [parent.foreignKey as never]),
  childTable = <T extends ZodRawShape>(s: ZodObject<T>, indexField: string, indexName?: string) =>
    defineTable({
      ...z2c(s.shape),
      updatedAt: v.number()
    }).index(indexName ?? `by_${indexField}`, [indexField as never]),
  orgTables = () => ({
    org: defineTable({
      avatarId: v.optional(v.id('_storage')),
      name: v.string(),
      slug: v.string(),
      updatedAt: v.number(),
      userId: v.id('users')
    })
      .index('by_slug', ['slug'])
      .index('by_user', ['userId']),
    orgInvite: defineTable({
      email: v.string(),
      expiresAt: v.number(),
      isAdmin: v.boolean(),
      orgId: v.id('org'),
      token: v.string()
    })
      .index('by_org', ['orgId'])
      .index('by_token', ['token']),
    orgJoinRequest: defineTable({
      message: v.optional(v.string()),
      orgId: v.id('org'),
      status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
      userId: v.id('users')
    })
      .index('by_org', ['orgId'])
      .index('by_org_status', ['orgId', 'status'])
      .index('by_user', ['userId']),
    orgMember: defineTable({
      isAdmin: v.boolean(),
      orgId: v.id('org'),
      updatedAt: v.number(),
      userId: v.id('users')
    })
      .index('by_org', ['orgId'])
      .index('by_org_user', ['orgId', 'userId'])
      .index('by_user', ['userId'])
  }),
  rateLimitTable = () => ({
    rateLimit: defineTable({
      count: v.number(),
      key: v.string(),
      table: v.string(),
      windowStart: v.number()
    }).index('by_table_key', ['table', 'key'])
  }),
  uploadTables = () => ({
    uploadChunk: defineTable({
      chunkIndex: v.number(),
      storageId: v.id('_storage'),
      totalChunks: v.number(),
      uploadId: v.string(),
      userId: v.id('users')
    })
      .index('by_upload', ['uploadId'])
      .index('by_user', ['userId']),
    uploadRateLimit: defineTable({
      count: v.number(),
      userId: v.id('users'),
      windowStart: v.number()
    }).index('by_user', ['userId']),
    uploadSession: defineTable({
      completedChunks: v.number(),
      contentType: v.string(),
      fileName: v.string(),
      finalStorageId: v.optional(v.id('_storage')),
      status: v.union(v.literal('pending'), v.literal('assembling'), v.literal('completed'), v.literal('failed')),
      totalChunks: v.number(),
      totalSize: v.number(),
      uploadId: v.string(),
      userId: v.id('users')
    })
      .index('by_upload_id', ['uploadId'])
      .index('by_user', ['userId'])
  })

interface CheckSchemaOutput {
  path: string
  zodType: string
}

const unsupportedTypes = new Set(['pipe', 'transform']),
  scanSchema = (schema: unknown, path: string, out: CheckSchemaOutput[]) => {
    const b = unwrapZod(schema)
    if (b.type && unsupportedTypes.has(b.type)) out.push({ path, zodType: b.type })
    if (isArrayType(b.type)) return scanSchema(elementOf(b.schema), `${path}[]`, out)
    if (b.type === 'object' && b.schema && isRecord((b.schema as unknown as { shape?: unknown }).shape))
      for (const [k, vl] of Object.entries((b.schema as unknown as { shape: Record<string, unknown> }).shape))
        scanSchema(vl, path ? `${path}.${k}` : k, out)
  },
  checkSchema = (schemas: Record<string, ZodObject<ZodRawShape>>) => {
    const res: CheckSchemaOutput[] = []
    for (const [table, schema] of Object.entries(schemas)) scanSchema(schema, table, res)
    if (res.length) {
      for (const f of res) process.stderr.write(`${f.path}: unsupported zod type "${f.zodType}"\n`)
      process.exitCode = 1
    }
  }

export { baseTable, checkSchema, childTable, orgChildTable, orgTable, orgTables, ownedTable, rateLimitTable, uploadTables }
