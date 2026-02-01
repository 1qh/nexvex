/* eslint-disable no-await-in-loop */
import { getAuthUserId } from '@convex-dev/auth/server'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { crud, err } from '../f'
import t from '../t'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'

const time = () => ({ updatedAt: Date.now() }),
  {
    create: createChat,
    my,
    pub: { all, list, read },
    rm: rmChat,
    update: updateChat
  } = crud('dbChat', t.dbChat),
  listChats = query({
    handler: async ctx => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return []
      const chats = await ctx.db
        .query('dbChat')
        .filter(q => q.eq(q.field('userId'), userId))
        .order('desc')
        .collect()
      const chatWithMessages = await Promise.all(
        chats.map(async chat => {
          const firstMessage = await ctx.db
            .query('dbMessage')
            .withIndex('by_chat', q => q.eq('chatId', chat._id))
            .first()
          return { chat, hasMessages: Boolean(firstMessage) }
        })
      )
      return chatWithMessages.filter(c => c.hasMessages).map(c => c.chat)
    }
  }),
  getChat = query({
    args: { id: v.id('dbChat') },
    handler: async (ctx, { id }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return null
      const chat = await ctx.db.get(id)
      if (chat?.userId !== userId) return null
      return chat
    }
  }),
  deleteChat = mutation({
    args: { id: v.id('dbChat') },
    handler: async (ctx, { id }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      const chat = await ctx.db.get(id)
      if (chat?.userId !== userId) return err('NOT_FOUND')
      const messages = await ctx.db
        .query('dbMessage')
        .withIndex('by_chat', q => q.eq('chatId', id))
        .collect()
      // biome-ignore lint/performance/noAwaitInLoops: sequential
      for (const msg of messages) await ctx.db.delete(msg._id)
      await ctx.db.delete(id)
      return chat
    }
  }),
  saveMessage = mutation({
    args: {
      chatId: v.id('dbChat'),
      id: v.optional(v.string()),
      parts: v.any(),
      role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system'))
    },
    handler: async (ctx, { chatId, parts, role }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      const chat = await ctx.db.get(chatId)
      if (chat?.userId !== userId) return err('NOT_FOUND')
      const now = Date.now()
      return ctx.db.insert('dbMessage', {
        chatId,
        createdAt: now,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        parts,
        role,
        ...time()
      })
    }
  }),
  updateMessage = mutation({
    args: {
      id: v.id('dbMessage'),
      parts: v.any()
    },
    handler: async (ctx, { id, parts }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return err('NOT_AUTHENTICATED')
      const msg = await ctx.db.get(id)
      if (!msg) return err('NOT_FOUND')
      const chat = await ctx.db.get(msg.chatId)
      if (chat?.userId !== userId) return err('NOT_FOUND')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      await ctx.db.patch(id, { parts, ...time() })
    }
  }),
  getMessages = query({
    args: { chatId: v.id('dbChat') },
    handler: async (ctx, { chatId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return []
      const chat = await ctx.db.get(chatId)
      if (chat?.userId !== userId) return []
      return ctx.db
        .query('dbMessage')
        .withIndex('by_chat', q => q.eq('chatId', chatId))
        .order('asc')
        .collect()
    }
  }),
  getMessagesPaginated = query({
    args: { chatId: v.id('dbChat'), paginationOpts: paginationOptsValidator },
    handler: async (ctx, { chatId, paginationOpts }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) return { continueCursor: '', isDone: true, page: [] }
      const chat = await ctx.db.get(chatId)
      if (chat?.userId !== userId) return { continueCursor: '', isDone: true, page: [] }
      return ctx.db
        .query('dbMessage')
        .withIndex('by_chat', q => q.eq('chatId', chatId))
        .order('asc')
        .paginate(paginationOpts)
    }
  }),
  getMessageById = internalQuery({
    args: { id: v.id('dbMessage') },
    handler: async (ctx, { id }) => ctx.db.get(id)
  }),
  deleteMessage = internalMutation({
    args: { id: v.id('dbMessage') },
    handler: async (ctx, { id }) => {
      await ctx.db.delete(id)
    }
  }),
  updateChatTitle = internalMutation({
    args: { id: v.id('dbChat'), title: v.string() },
    handler: async (ctx, { id, title }) => {
      await ctx.db.patch(id, { title, ...time() })
    }
  })

export {
  all,
  createChat,
  deleteChat,
  deleteMessage,
  getChat,
  getMessageById,
  getMessages,
  getMessagesPaginated,
  list,
  listChats,
  my,
  read,
  rmChat,
  saveMessage,
  updateChat,
  updateChatTitle,
  updateMessage
}
