import type { ZodObject, ZodRawShape } from 'zod/v4'

import { authTables } from '@convex-dev/auth/server'
import { zodOutputToConvexFields as z2c } from 'convex-helpers/server/zod4'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import { base, children, orgScoped, owned } from '../t'

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
      .index('by_parent', [parent.foreignKey as never])

export default defineSchema({
  ...authTables,
  ...({
    blog: ownedTable(owned.blog).index('by_published', ['published']),
    chat: ownedTable(owned.chat)
  } satisfies Record<keyof typeof owned, ReturnType<typeof ownedTable>>),
  ...({
    message: defineTable({
      ...z2c(children.message.schema.shape),
      updatedAt: v.number()
    }).index('by_chat', [children.message.foreignKey])
  } satisfies Record<keyof typeof children, ReturnType<typeof defineTable>>),
  ...({
    movie: baseTable(base.movie).index('by_tmdb_id', ['tmdb_id'])
  } satisfies Record<keyof typeof base, ReturnType<typeof baseTable>>),
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
    .index('by_user', ['userId']),
  project: orgTable(orgScoped.project),
  task: orgChildTable(orgScoped.task, { foreignKey: 'projectId', table: 'project' }),
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
    timestamp: v.number(),
    userId: v.id('users')
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
    .index('by_user', ['userId']),
  wiki: orgTable(orgScoped.wiki).index('by_slug', ['orgId' as never, 'slug' as never])
})
