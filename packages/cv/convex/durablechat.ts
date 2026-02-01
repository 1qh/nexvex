// biome-ignore-all lint/style/noCommonJs: x
/* oxlint-disable typescript/no-var-requires, typescript/no-require-imports, node/global-require */
'use node'

import type { LanguageModel } from 'ai'

import { createActionTool, createAsyncTool, streamHandlerAction } from 'convex-durable-agents'
import { z } from 'zod/v4'

import { model } from '../ai'
import { components, internal } from './_generated/api'

// eslint-disable-next-line no-restricted-properties
const isTestMode = process.env.CONVEX_TEST_MODE === 'true',
  getLanguageModel = (): LanguageModel => {
    if (isTestMode)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return (require('./models.mock') as { chatModel: LanguageModel }).chatModel

    return model
  },
  durableChatHandler = streamHandlerAction(components.durable, {
    model: getLanguageModel(),
    saveStreamDeltas: { throttleMs: 100 },
    system: 'You are a helpful AI assistant. When asked about weather, use the getWeather tool.',
    tools: {
      getWeather: createActionTool({
        args: z.object({
          city: z.string().describe('City name'),
          unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit')
        }),
        description: 'Get current weather for a city',
        handler: internal.tools.weather.getWeather
      }),
      getWeatherAsync: createAsyncTool({
        args: z.object({
          city: z.string().describe('City name'),
          unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit')
        }),
        callback: internal.tools.weather.getWeatherAsync,
        description: 'Get current weather for a city (async - for long operations)'
      })
    }
  })

export { durableChatHandler }
