// biome-ignore-all lint/style/noCommonJs: x
/* oxlint-disable typescript/no-var-requires, typescript/no-require-imports, node/global-require */
'use node'

import type { LanguageModel } from 'ai'

import { Agent } from '@convex-dev/agent'
import { tool } from 'ai'
import { v } from 'convex/values'
import z, { array, number, object, string } from 'zod/v4'

import type { WeatherArgs } from './toolschemas'

import { model as languageModel } from '../ai'
import { components, internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { fetchWithRetry } from './retry'
import { parseWeatherArgs, weatherArgsSchema } from './toolschemas'

const SENTENCE_CHUNKING_REGEX = /[.!?]\s/u,
  // eslint-disable-next-line no-restricted-properties
  isTestMode = process.env.CONVEX_TEST_MODE === 'true',
  geoApiResponseSchema = object({
    results: array(object({ latitude: number(), longitude: number(), name: string() })).optional()
  }),
  weatherApiResponseSchema = object({
    current: object({ temperature_2m: number() })
  }),
  weatherOutputSchema = object({
    city: string(),
    error: string().optional(),
    temperature: number().optional(),
    timestamp: string().optional(),
    unit: string()
  }),
  getWeatherTool = tool({
    description: 'Get current weather for a city (requires user approval)',
    inputSchema: weatherArgsSchema,
    outputSchema: weatherOutputSchema
  }),
  getLanguageModel = (): LanguageModel => {
    if (isTestMode)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return (require('./models.mock') as { chatModel: LanguageModel }).chatModel

    return languageModel
  },
  agent = new Agent(components.a1, {
    contextOptions: { recentMessages: 10 },
    instructions: 'You are a helpful AI assistant. When asked about weather, use the getWeather tool.',
    languageModel: getLanguageModel(),
    name: 'ChatAssistant',
    tools: { getWeather: getWeatherTool },
    usageHandler: async (ctx, { model, threadId, usage }) => {
      if (!threadId) return
      await ctx.runMutation(internal.chat.saveUsage, {
        inputTokens: usage.inputTokens ?? 0,
        model,
        outputTokens: usage.outputTokens ?? 0,
        threadId,
        totalTokens: usage.totalTokens ?? 0
      })
    }
  }),
  fetchWeatherData = async (city: string, unit: 'celsius' | 'fahrenheit') => {
    try {
      const geoRes = await fetchWithRetry(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
          { retry: { initialDelayMs: 500, maxAttempts: 3 } }
        ),
        geoJson: unknown = await geoRes.json(),
        geoData = geoApiResponseSchema.safeParse(geoJson)
      if (!geoData.success) return { city, error: 'Geocoding API error', unit }
      const [first] = geoData.data.results ?? []
      if (!first) return { city, error: 'Location not found', unit }
      const { latitude, longitude, name } = first,
        weatherRes = await fetchWithRetry(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&temperature_unit=${unit}`,
          { retry: { initialDelayMs: 500, maxAttempts: 3 } }
        ),
        weatherJson: unknown = await weatherRes.json(),
        weatherData = weatherApiResponseSchema.safeParse(weatherJson)
      if (!weatherData.success) return { city, error: 'Weather API error', unit }
      return {
        city: name,
        temperature: weatherData.data.current.temperature_2m,
        timestamp: new Date().toISOString(),
        unit
      }
    } catch {
      return { city, error: 'Weather service temporarily unavailable', unit }
    }
  },
  streamResponse = internalAction({
    args: { promptMessageId: v.string(), threadId: v.string() },

    handler: async (ctx, { promptMessageId, threadId }) => {
      const result = await agent.streamText(
        ctx,
        { threadId },
        { promptMessageId } as Parameters<typeof agent.streamText>[2],
        { saveStreamDeltas: { chunking: SENTENCE_CHUNKING_REGEX, throttleMs: 100 } }
      )
      await result.consumeStream()

      const toolCalls = await result.toolCalls,
        pendingToolCalls = toolCalls.filter(tc => tc.toolName === 'getWeather'),
        validatedCalls = pendingToolCalls
          .filter((tc): tc is typeof tc & { input: unknown } => 'input' in tc)
          .map(tc => ({ parsed: parseWeatherArgs(tc.input), tc }))
          .filter(
            (r): r is { parsed: WeatherArgs; tc: (typeof pendingToolCalls)[0] & { input: unknown } } => r.parsed !== null
          )
      await Promise.all(
        validatedCalls.map(async ({ parsed, tc }) =>
          ctx.runMutation(internal.chat.savePendingApproval, {
            args: parsed,
            promptMessageId,
            threadId,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName
          })
        )
      )

      if (pendingToolCalls.length === 0) {
        const thread = await ctx.runQuery(components.a1.threads.getThread, { threadId })
        if (thread?.title === 'New Chat') {
          const { object: titleObject } = await agent.generateObject(
            ctx,
            { threadId },
            {
              prompt: 'Generate a short 2-5 word title for this conversation based on the messages',
              schema: z.object({ title: z.string() })
            },
            { storageOptions: { saveMessages: 'none' } }
          )
          await ctx.runMutation(internal.chat.updateThreadTitle, { threadId, title: titleObject.title })
        }
      }
    }
  }),
  approveToolCall = internalAction({
    args: {
      approvalId: v.id('pendingToolApprovals'),
      threadId: v.string(),
      toolArgs: v.object({ city: v.string(), unit: v.union(v.literal('celsius'), v.literal('fahrenheit')) }),
      toolCallId: v.string()
    },
    handler: async (ctx, { approvalId, threadId, toolArgs, toolCallId }) => {
      const weatherResult = await fetchWeatherData(toolArgs.city, toolArgs.unit)
      await agent.saveMessage(ctx, {
        message: {
          content: [
            {
              output: { type: 'text', value: JSON.stringify(weatherResult) },
              toolCallId,
              toolName: 'getWeather',
              type: 'tool-result'
            }
          ],
          role: 'tool'
        },
        threadId
      })
      await ctx.runMutation(internal.chat.updateApprovalStatus, { approvalId, status: 'approved' })
      const continueResult = await agent.streamText(
        ctx,
        { threadId },
        {},
        { saveStreamDeltas: { chunking: SENTENCE_CHUNKING_REGEX, throttleMs: 100 } }
      )
      await continueResult.consumeStream()

      const thread = await ctx.runQuery(components.a1.threads.getThread, { threadId })
      if (thread?.title === 'New Chat') {
        const { object: titleObject } = await agent.generateObject(
          ctx,
          { threadId },
          {
            prompt: 'Generate a short 2-5 word title for this conversation based on the messages',
            schema: z.object({ title: z.string() })
          },
          { storageOptions: { saveMessages: 'none' } }
        )
        await ctx.runMutation(internal.chat.updateThreadTitle, { threadId, title: titleObject.title })
      }
    }
  }),
  rejectToolCall = internalAction({
    args: {
      approvalId: v.id('pendingToolApprovals'),
      reason: v.optional(v.string()),
      threadId: v.string(),
      toolCallId: v.string()
    },
    handler: async (ctx, { approvalId, reason, threadId, toolCallId }) => {
      await agent.saveMessage(ctx, {
        message: {
          content: [
            {
              output: { type: 'text', value: `Tool call rejected by user. Reason: ${reason ?? 'User declined'}` },
              toolCallId,
              toolName: 'getWeather',
              type: 'tool-result'
            }
          ],
          role: 'tool'
        },
        threadId
      })
      await ctx.runMutation(internal.chat.updateApprovalStatus, { approvalId, status: 'rejected' })
      const continueResult = await agent.streamText(
        ctx,
        { threadId },
        {},
        { saveStreamDeltas: { chunking: SENTENCE_CHUNKING_REGEX, throttleMs: 100 } }
      )
      await continueResult.consumeStream()
    }
  })

export { agent, approveToolCall, rejectToolCall, streamResponse }
