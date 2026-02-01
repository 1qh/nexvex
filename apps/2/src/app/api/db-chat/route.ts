/* eslint-disable max-statements, no-await-in-loop */
/** biome-ignore-all lint/performance/noAwaitInLoops: x */
import type { Id } from '@a/cv/model'
import type { UIMessage } from 'ai'

import { api } from '@a/cv'
import { model } from '@a/cv/ai'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, tool } from 'ai'
import { fetchMutation, fetchQuery } from 'convex/nextjs'
import { z } from 'zod/v4'

export const maxDuration = 60

const geocodeCity = async (city: string): Promise<null | { latitude: number; longitude: number }> => {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    )
    if (!response.ok) return null
    const data = (await response.json()) as { results?: { latitude: number; longitude: number }[] },
      [result] = data.results ?? []
    return result ? { latitude: result.latitude, longitude: result.longitude } : null
  },
  getWeather = tool({
    description: 'Get the current weather at a location. You can provide either coordinates or a city name.',
    execute: async input => {
      let lat: number, lon: number
      if (input.city) {
        const coords = await geocodeCity(input.city)
        if (!coords) return { error: `Could not find coordinates for "${input.city}". Please check the city name.` }
        lat = coords.latitude
        lon = coords.longitude
      } else if (input.latitude !== undefined && input.longitude !== undefined) {
        lat = input.latitude
        lon = input.longitude
      } else return { error: 'Please provide either a city name or both latitude and longitude coordinates.' }

      const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
        ),
        weatherData = (await response.json()) as Record<string, unknown>
      if ('city' in input) weatherData.cityName = input.city
      return weatherData
    },
    inputSchema: z.object({
      city: z.string().describe("City name (e.g., 'San Francisco', 'New York', 'London')").optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional()
    }),
    needsApproval: true
  }),
  requestSchema = z.object({
    id: z.string(),
    message: z
      .object({
        id: z.string(),
        parts: z.array(z.record(z.string(), z.unknown())),
        role: z.enum(['user', 'assistant', 'system'])
      })
      .optional(),
    messages: z
      .array(
        z.object({
          id: z.string(),
          parts: z.array(z.record(z.string(), z.unknown())),
          role: z.enum(['user', 'assistant', 'system'])
        })
      )
      .optional()
  })

interface DbMessage {
  _id: string
  parts: unknown
  role: 'assistant' | 'system' | 'user'
}

const POST = async (request: Request) => {
    const token = await convexAuthNextjsToken()
    if (!token) return new Response('Unauthorized', { status: 401 })

    const json = (await request.json()) as unknown,
      parsed = requestSchema.safeParse(json)
    if (!parsed.success) return new Response('Bad request', { status: 400 })

    const { id, message, messages } = parsed.data,
      chatId = id as Id<'dbChat'>,
      isToolApprovalFlow = Boolean(messages)

    let chat = await fetchQuery(api.dbchat.getChat, { id: chatId }, { token })
    if (!chat && message?.role === 'user') {
      await fetchMutation(api.dbchat.createChat, { title: 'New Chat', visibility: 'private' }, { token })
      chat = await fetchQuery(api.dbchat.getChat, { id: chatId }, { token })
    }
    if (!chat) return new Response('Chat not found', { status: 404 })

    let existingMessages: UIMessage[] = []
    if (!isToolApprovalFlow) {
      const dbMessages = (await fetchQuery(api.dbchat.getMessages, { chatId }, { token })) as DbMessage[]
      existingMessages = dbMessages.map(m => ({
        id: m._id,
        parts: m.parts as UIMessage['parts'],
        role: m.role
      }))
    }

    const uiMessages: UIMessage[] = isToolApprovalFlow
      ? (messages as UIMessage[])
      : message
        ? [...existingMessages, message as UIMessage]
        : existingMessages

    if (message?.role === 'user' && !isToolApprovalFlow)
      await fetchMutation(api.dbchat.saveMessage, { chatId, parts: message.parts, role: 'user' }, { token })

    const modelMessages = await convertToModelMessages(uiMessages),
      stream = createUIMessageStream({
        execute: ({ writer: dataStream }) => {
          const result = streamText({
            experimental_activeTools: ['getWeather'],
            messages: modelMessages,
            model,
            system: 'You are a helpful assistant. You can get weather information for any location.',
            tools: { getWeather }
          })
          dataStream.merge(result.toUIMessageStream({ sendReasoning: true }))
        },
        onFinish: async ({ messages: finishedMessages }) => {
          if (isToolApprovalFlow)
            for (const msg of finishedMessages) {
              const existingMsg = uiMessages.find(m => m.id === msg.id)
              if (existingMsg)
                await fetchMutation(
                  api.dbchat.updateMessage,
                  { id: msg.id as Id<'dbMessage'>, parts: msg.parts },
                  { token }
                )
              else await fetchMutation(api.dbchat.saveMessage, { chatId, parts: msg.parts, role: msg.role }, { token })
            }
          else if (finishedMessages.length > 0)
            for (const msg of finishedMessages)
              await fetchMutation(api.dbchat.saveMessage, { chatId, parts: msg.parts, role: msg.role }, { token })
        },
        originalMessages: isToolApprovalFlow ? uiMessages : undefined
      })

    return createUIMessageStreamResponse({ stream })
  },
  DELETE = async (request: Request) => {
    const token = await convexAuthNextjsToken()
    if (!token) return new Response('Unauthorized', { status: 401 })

    const { searchParams } = new URL(request.url),
      id = searchParams.get('id')
    if (!id) return new Response('Bad request', { status: 400 })

    await fetchMutation(api.dbchat.deleteChat, { id: id as Id<'dbChat'> }, { token })
    return new Response('OK', { status: 200 })
  }

export { DELETE, POST }
