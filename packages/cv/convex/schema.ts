import type { ZodObject, ZodRawShape } from 'zod/v4'

import { authTables } from '@convex-dev/auth/server'
import { zodOutputToConvexFields as z2c } from 'convex-helpers/server/zod4'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import t from '../t'

const base = <T extends ZodRawShape>(s: ZodObject<T>) => defineTable({ ...z2c(s.shape), updatedAt: v.number() }),
  owned = <T extends ZodRawShape>(s: ZodObject<T>) =>
    defineTable({ ...z2c(s.shape), updatedAt: v.number(), userId: v.id('users') }).index('by_user', ['userId' as never])

export default defineSchema({
  ...authTables,
  ...({
    blog: owned(t.blog).index('by_slug', ['slug']).index('by_published', ['published']),
    dbChat: owned(t.dbChat),
    movie: base(t.movie).index('by_tmdb_id', ['tmdb_id'])
  } satisfies Record<keyof typeof t, ReturnType<typeof base | typeof owned>>),
  dbMessage: defineTable({
    chatId: v.id('dbChat'),
    createdAt: v.number(),
    parts: v.any(),
    role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
    updatedAt: v.number()
  }).index('by_chat', ['chatId']),
  messageUsage: defineTable({
    inputTokens: v.number(),
    model: v.optional(v.string()),
    outputTokens: v.number(),
    threadId: v.string(),
    totalTokens: v.number()
  }).index('by_thread', ['threadId']),
  pendingToolApprovals: defineTable({
    args: v.any(),
    promptMessageId: v.string(),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
    threadId: v.string(),
    toolCallId: v.string(),
    toolName: v.string()
  })
    .index('by_thread', ['threadId'])
    .index('by_status', ['threadId', 'status'])
})
