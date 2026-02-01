import { PersistentTextStreaming, StreamIdValidator } from '@convex-dev/persistent-text-streaming'
import { v } from 'convex/values'

import { components } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'

const streaming = new PersistentTextStreaming(components.streaming),
  createStream = mutation({
    args: {},
    handler: async ctx => streaming.createStream(ctx)
  }),
  getStreamBody = query({
    args: { streamId: StreamIdValidator },
    handler: async (ctx, { streamId }) =>
      streaming.getStreamBody(ctx, streamId as Parameters<typeof streaming.getStreamBody>[1])
  }),
  createStreamInternal = internalMutation({
    handler: async ctx => streaming.createStream(ctx)
  }),
  getStreamBodyInternal = internalQuery({
    args: { streamId: v.string() },
    handler: async (ctx, { streamId }) =>
      streaming.getStreamBody(ctx, streamId as Parameters<typeof streaming.getStreamBody>[1])
  }),
  addChunk = internalMutation({
    args: { final: v.boolean(), streamId: v.string(), text: v.string() },
    handler: async (ctx, { final, streamId, text }) => {
      await ctx.runMutation(components.streaming.lib.addChunk, { final, streamId, text })
    }
  }),
  setStreamStatus = internalMutation({
    args: {
      status: v.union(
        v.literal('pending'),
        v.literal('streaming'),
        v.literal('done'),
        v.literal('error'),
        v.literal('timeout')
      ),
      streamId: v.string()
    },
    handler: async (ctx, { status, streamId }) => {
      await ctx.runMutation(components.streaming.lib.setStreamStatus, { status, streamId })
    }
  })

export { addChunk, createStream, createStreamInternal, getStreamBody, getStreamBodyInternal, setStreamStatus, streaming }
