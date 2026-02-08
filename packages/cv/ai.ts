import type { LanguageModel } from 'ai'

import { vertex } from '@ai-sdk/google-vertex'

import { chatModel } from './models.mock'

// eslint-disable-next-line no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing
const isTestEnvironment = typeof process !== 'undefined' && Boolean(process.env.PLAYWRIGHT || process.env.TEST_MODE),
  model: LanguageModel = isTestEnvironment ? chatModel : vertex('gemini-3-flash-preview')

export { model }
