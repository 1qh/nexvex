'use node'

import { v } from 'convex/values'
import { z } from 'zod/v4'

import { components } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { fetchWithRetry } from '../retry'

const geoApiResponseSchema = z.object({
    results: z.array(z.object({ latitude: z.number(), longitude: z.number(), name: z.string() })).optional()
  }),
  weatherApiResponseSchema = z.object({
    current: z.object({ temperature_2m: z.number() })
  }),
  weatherResultSchema = v.object({
    city: v.string(),
    error: v.optional(v.string()),
    temperature: v.optional(v.number()),
    timestamp: v.optional(v.string()),
    unit: v.string()
  }),
  fetchWeather = async (city: string, unit: 'celsius' | 'fahrenheit' = 'celsius') => {
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
  },
  getWeather = internalAction({
    args: { city: v.string(), unit: v.optional(v.union(v.literal('celsius'), v.literal('fahrenheit'))) },
    handler: async (_ctx, { city, unit = 'celsius' }) => {
      try {
        return await fetchWeather(city, unit)
      } catch {
        return { city, error: 'Weather service temporarily unavailable', unit }
      }
    },
    returns: weatherResultSchema
  }),
  getWeatherAsync = internalAction({
    args: {
      args: v.object({ city: v.string(), unit: v.optional(v.union(v.literal('celsius'), v.literal('fahrenheit'))) }),
      threadId: v.string(),
      toolCallId: v.string(),
      toolName: v.string()
    },
    handler: async (ctx, { args: toolArgs, toolCallId }) => {
      const { city, unit = 'celsius' } = toolArgs
      try {
        const result = await fetchWeather(city, unit)
        if (result.error) await ctx.runMutation(components.durable.agent.addToolError, { error: result.error, toolCallId })
        else await ctx.runMutation(components.durable.agent.addToolResult, { result, toolCallId })
      } catch {
        await ctx.runMutation(components.durable.agent.addToolError, {
          error: 'Weather service temporarily unavailable',
          toolCallId
        })
      }
    }
  })

export { getWeather, getWeatherAsync }
