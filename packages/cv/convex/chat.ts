import { abortStream, listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { getAuthUserId } from '@convex-dev/auth/server'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { err } from '../f'
import { components, internal } from './_generated/api'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { limiter } from './ratelimit'
import { parseWeatherArgs } from './toolschemas'

type ChatErrorType = 'auth' | 'network' | 'rate_limit' | 'unknown'

const categorizeError = (error: Error): ChatErrorType => {
  const message = error.message.toLowerCase()
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) return 'network'
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('401')) return 'auth'
  if (message.includes('rate') || message.includes('limit') || message.includes('429') || message.includes('too many'))
    return 'rate_limit'
  return 'unknown'
}

const getErrorMessage = (type: ChatErrorType): string => {
  const messages: Record<ChatErrorType, string> = {
    auth: 'Authentication required. Please sign in to continue.',
    network: 'Connection error. Please check your internet and try again.',
    rate_limit: 'Too many requests. Please wait a moment before trying again.',
    unknown: 'Something went wrong. Please try again.'
  }
  return messages[type]
}

const { a1 } = components,
  { createThread, deleteAllForThreadIdAsync, getThread, listThreadsByUserId, updateThread } = a1.threads,
  { addMessages, deleteByIds } = a1.messages,
  create = mutation({
    args: { title: v.optional(v.string()) },
    handler: async (ctx, { title }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      const rateLimitResult = await limiter.limit(ctx, 'threadCreate', { key: userId })
      if (!rateLimitResult.ok) return err('RATE_LIMITED')
      const thread = await ctx.runMutation(createThread, { title: title ?? 'New Chat', userId })
      return thread._id
    }
  }),
  listThreads = query({
    handler: async ctx => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return []
      const result = await ctx.runQuery(listThreadsByUserId, {
          paginationOpts: { cursor: null, numItems: 50 },
          userId
        }),
        messageChecks = await Promise.all(
          result.page.map(async thread => {
            const messages = await listUIMessages(ctx, a1, {
              paginationOpts: { cursor: null, numItems: 1 },
              threadId: thread._id
            })
            return { hasMessages: messages.page.length > 0, thread }
          })
        )
      return messageChecks.filter(c => c.hasMessages).map(c => c.thread)
    }
  }),
  rm = action({
    args: { threadId: v.string() },
    handler: async (ctx, { threadId }) => {
      await ctx.runMutation(deleteAllForThreadIdAsync, { threadId })
    }
  }),
  get = query({
    args: { threadId: v.string() },
    handler: async (ctx, { threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return null
      return ctx.runQuery(getThread, { threadId })
    }
  }),
  sendMessage = mutation({
    args: { content: v.string(), threadId: v.string() },
    handler: async (ctx, { content, threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      const rateLimitResult = await limiter.limit(ctx, 'chatMessage', { key: userId })
      if (!rateLimitResult.ok) return err('RATE_LIMITED')
      const {
        messages: [msg]
      } = await ctx.runMutation(addMessages, {
        messages: [{ message: { content, role: 'user' } }],
        threadId,
        userId
      })
      if (!msg) return err('MESSAGE_NOT_SAVED')
      await ctx.scheduler.runAfter(0, internal.chatnode.streamResponse, { promptMessageId: msg._id, threadId })
      return msg._id
    }
  }),
  listMessages = query({
    args: {
      paginationOpts: paginationOptsValidator,
      streamArgs: v.optional(vStreamArgs),
      threadId: v.string()
    },
    handler: async (ctx, { paginationOpts, streamArgs, threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return { continueCursor: '', isDone: true, page: [], streams: undefined }
      const messages = await listUIMessages(ctx, a1, { paginationOpts, threadId }),
        streams = await syncStreams(ctx, a1, { streamArgs, threadId })
      return { ...messages, streams }
    }
  }),
  updateThreadTitle = internalMutation({
    args: { threadId: v.string(), title: v.string() },
    handler: async (ctx, { threadId, title }) => {
      await ctx.runMutation(updateThread, { patch: { title }, threadId })
    }
  }),
  savePendingApproval = internalMutation({
    args: {
      args: v.any(),
      promptMessageId: v.string(),
      threadId: v.string(),
      toolCallId: v.string(),
      toolName: v.string()
    },
    handler: async (ctx, { args, promptMessageId, threadId, toolCallId, toolName }) => {
      await ctx.db.insert('pendingToolApprovals', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        args,
        promptMessageId,
        status: 'pending',
        threadId,
        toolCallId,
        toolName
      })
    }
  }),
  updateApprovalStatus = internalMutation({
    args: {
      approvalId: v.id('pendingToolApprovals'),
      status: v.union(v.literal('approved'), v.literal('rejected'))
    },
    handler: async (ctx, { approvalId, status }) => {
      await ctx.db.patch(approvalId, { status })
    }
  }),
  getPendingApprovals = query({
    args: { threadId: v.string() },
    handler: async (ctx, { threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return []
      return ctx.db
        .query('pendingToolApprovals')
        .withIndex('by_status', q => q.eq('threadId', threadId).eq('status', 'pending'))
        .collect()
    }
  }),
  abort = mutation({
    args: { order: v.number(), threadId: v.string() },
    handler: async (ctx, { order, threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      return abortStream(ctx, a1, { order, reason: 'User cancelled', threadId })
    }
  }),
  approveToolCall = action({
    args: { approvalId: v.id('pendingToolApprovals') },
    handler: async (ctx, { approvalId }) => {
      const approval = await ctx.runQuery(internal.chat.getApprovalById, { approvalId })
      if (!approval) return
      const toolArgs = parseWeatherArgs(approval.args)
      if (!toolArgs) return err('INVALID_TOOL_ARGS')
      await ctx.runAction(internal.chatnode.approveToolCall, {
        approvalId,
        threadId: approval.threadId,
        toolArgs,
        toolCallId: approval.toolCallId
      })
    }
  }),
  rejectToolCall = action({
    args: { approvalId: v.id('pendingToolApprovals'), reason: v.optional(v.string()) },
    handler: async (ctx, { approvalId, reason }) => {
      const approval = await ctx.runQuery(internal.chat.getApprovalById, { approvalId })
      if (!approval) return
      await ctx.runAction(internal.chatnode.rejectToolCall, {
        approvalId,
        reason,
        threadId: approval.threadId,
        toolCallId: approval.toolCallId
      })
    }
  }),
  getApprovalById = internalQuery({
    args: { approvalId: v.id('pendingToolApprovals') },
    handler: async (ctx, { approvalId }) => ctx.db.get(approvalId)
  }),
  saveUsage = internalMutation({
    args: {
      inputTokens: v.number(),
      model: v.optional(v.string()),
      outputTokens: v.number(),
      threadId: v.string(),
      totalTokens: v.number()
    },
    handler: async (ctx, args) => {
      await ctx.db.insert('messageUsage', args)
    }
  }),
  aggregateUsage = (records: { inputTokens: number; outputTokens: number; totalTokens: number }[]) => {
    let inputTokens = 0,
      outputTokens = 0,
      totalTokens = 0
    for (const r of records) {
      inputTokens += r.inputTokens
      outputTokens += r.outputTokens
      totalTokens += r.totalTokens
    }
    return { inputTokens, outputTokens, records: records.length, totalTokens }
  },
  getUsage = query({
    args: { threadId: v.string() },
    handler: async (ctx, { threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return null
      const records = await ctx.db
        .query('messageUsage')
        .withIndex('by_thread', q => q.eq('threadId', threadId))
        .collect()
      return aggregateUsage(records)
    }
  }),
  regenerateResponse = action({
    args: { messageOrder: v.number(), threadId: v.string() },
    handler: async (ctx, { messageOrder, threadId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      const messages = await listUIMessages(ctx, a1, {
          paginationOpts: { cursor: null, numItems: 100 },
          threadId
        }),
        targetMessage = messages.page.find(m => m.order === messageOrder)
      if (!targetMessage || targetMessage.role !== 'assistant') return err('INVALID_MESSAGE')
      const precedingUserMessage = messages.page.find(m => m.order === messageOrder - 1 && m.role === 'user')
      if (!precedingUserMessage) return err('NO_PRECEDING_USER_MESSAGE')
      await ctx.runMutation(deleteByIds, { messageIds: [(targetMessage as unknown as { _id: string })._id] })
      await ctx.scheduler.runAfter(0, internal.chatnode.streamResponse, {
        promptMessageId: (precedingUserMessage as unknown as { _id: string })._id,
        threadId
      })
    }
  })
export {
  abort,
  approveToolCall,
  categorizeError,
  create,
  get,
  getApprovalById,
  getErrorMessage,
  getPendingApprovals,
  getUsage,
  listMessages,
  listThreads,
  regenerateResponse,
  rejectToolCall,
  rm,
  savePendingApproval,
  saveUsage,
  sendMessage,
  updateApprovalStatus,
  updateThreadTitle
}
export type { ChatErrorType }
