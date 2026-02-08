/* eslint-disable no-await-in-loop, eslint-plugin-jest/no-conditional-in-test */
import { ConvexHttpClient } from 'convex/browser'

import { expect, test } from './fixtures'
import { login } from './helpers'
import testApi from './test-api'

const getClient = () => {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
  if (!convexUrl) throw new Error('CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set')
  return new ConvexHttpClient(convexUrl)
}

test.describe
  .serial('Cascade Delete Stress Tests', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
    })

    test('deletes parent with 50+ children successfully', async () => {
      const client = getClient()

      const chatId = (await client.mutation(testApi.chat.create, {
        title: `Stress Test Chat ${Date.now()}`
      })) as string

      for (let i = 0; i < 60; i += 1) {
        await client.mutation(testApi.message.create, {
          chatId,
          parts: [{ text: `Test message ${i}`, type: 'text' }],
          role: 'user'
        })
      }

      const messagesBefore = (await client.query(testApi.message.list, {
        chatId
      })) as unknown[]
      expect(messagesBefore.length).toBe(60)

      await client.mutation(testApi.chat.rm, { id: chatId })

      const messagesAfter = await client
        .query(testApi.message.list, {
          chatId
        })
        .catch(() => null)

      expect(messagesAfter).toBeNull()
    })

    test('all children are removed after parent deletion', async () => {
      const client = getClient()

      const chatId = (await client.mutation(testApi.chat.create, {
        title: `Cleanup Test ${Date.now()}`
      })) as string

      const messageIds: string[] = []
      for (let i = 0; i < 75; i += 1) {
        const msgId = (await client.mutation(testApi.message.create, {
          chatId,
          parts: [{ text: `Message ${i}`, type: 'text' }],
          role: 'user'
        })) as string
        messageIds.push(msgId)
      }

      await client.mutation(testApi.chat.rm, { id: chatId })

      const messagesRemaining = await client
        .query(testApi.message.list, {
          chatId
        })
        .catch(() => null)

      expect(messagesRemaining).toBeNull()
    })

    test('deletion completes within reasonable time', async () => {
      const client = getClient()

      const chatId = (await client.mutation(testApi.chat.create, {
        title: `Performance Test ${Date.now()}`
      })) as string

      for (let i = 0; i < 100; i += 1) {
        await client.mutation(testApi.message.create, {
          chatId,
          parts: [{ text: `Perf message ${i}`, type: 'text' }],
          role: 'user'
        })
      }

      const startTime = Date.now()
      await client.mutation(testApi.chat.rm, { id: chatId })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(10_000)

      const messagesAfter = await client
        .query(testApi.message.list, {
          chatId
        })
        .catch(() => null)

      expect(messagesAfter).toBeNull()
    })

    test('cascade delete handles maximum batch size correctly', async () => {
      const client = getClient()

      const chatId = (await client.mutation(testApi.chat.create, {
        title: `Batch Test ${Date.now()}`
      })) as string

      for (let i = 0; i < 125; i += 1) {
        await client.mutation(testApi.message.create, {
          chatId,
          parts: [{ text: `Batch ${i}`, type: 'text' }],
          role: i % 3 === 0 ? 'system' : 'user'
        })
      }

      const messagesBefore = (await client.query(testApi.message.list, {
        chatId
      })) as unknown[]
      expect(messagesBefore.length).toBe(125)

      await client.mutation(testApi.chat.rm, { id: chatId })

      const messagesAfter = await client
        .query(testApi.message.list, {
          chatId
        })
        .catch(() => null)

      expect(messagesAfter).toBeNull()
    })
  })
