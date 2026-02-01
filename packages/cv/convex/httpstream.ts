/* oxlint-disable no-empty-function, promise/prefer-await-to-then */

import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { limiter } from './ratelimit'

interface StreamRequestBody {
  message: string
  threadId: string
}

// eslint-disable-next-line max-statements
const streamHttpAction = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization'),
    token = authHeader?.replace('Bearer ', '')

  if (!token)
    return Response.json(
      { error: 'Unauthorized' },
      {
        headers: { 'Content-Type': 'application/json' },
        status: 401
      }
    )

  const identity = await ctx.auth.getUserIdentity()
  if (!identity)
    return Response.json(
      { error: 'Invalid token' },
      {
        headers: { 'Content-Type': 'application/json' },
        status: 401
      }
    )

  const userId = identity.subject,
    rateLimitResult = await limiter.limit(ctx, 'streamRequest', { key: userId })

  if (!rateLimitResult.ok)
    return Response.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateLimitResult.retryAfter / 1000))
        },
        status: 429
      }
    )

  let body: StreamRequestBody
  try {
    body = (await request.json()) as StreamRequestBody
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }

  const { message, threadId } = body

  if (!(threadId && message))
    return Response.json(
      { error: 'Missing threadId or message' },
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      }
    )

  try {
    await ctx.runMutation(internal.durableapi.internalSendMessage, {
      prompt: message,
      threadId
    })

    const encoder = new TextEncoder(),
      stream = new ReadableStream({
        start: async controller => {
          let lastOrder = -1,
            pollCount = 0
          const maxPolls = 300

          // eslint-disable-next-line max-statements
          const pollMessages = async () => {
            if (pollCount >= maxPolls) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, timeout: true })}\n\n`))
              controller.close()
              return
            }
            pollCount += 1

            try {
              const thread = await ctx.runQuery(internal.durableapi.internalGetThread, { threadId })

              if (!thread) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Thread not found' })}\n\n`))
                controller.close()
                return
              }

              const messages = await ctx.runQuery(internal.durableapi.internalListMessages, { threadId })

              for (const msg of messages)
                if (msg.order > lastOrder) {
                  lastOrder = msg.order
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg })}\n\n`))
                }

              if (thread.status === 'completed' || thread.status === 'failed' || thread.status === 'stopped') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, status: thread.status })}\n\n`))
                controller.close()
                return
              }

              setTimeout(() => {
                pollMessages().catch(console.error)
              }, 200)
            } catch (error) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`
                )
              )
              controller.close()
            }
          }

          await pollMessages()
        }
      })

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream'
      }
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

export { streamHttpAction }
