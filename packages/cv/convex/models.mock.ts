'use node'

import type {
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult
} from '@ai-sdk/provider'

import { simulateReadableStream } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'

const CITY_PATTERN_1 = /weather (?:in|for) (?<city>[a-z]+)/iu,
  CITY_PATTERN_2 = /(?<city>[a-z]+)(?:'s)? weather/iu,
  finishReasonStop: LanguageModelV3FinishReason = { raw: 'stop', unified: 'stop' },
  finishReasonToolCalls: LanguageModelV3FinishReason = { raw: 'tool_calls', unified: 'tool-calls' },
  mockUsage = {
    inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
    outputTokens: { reasoning: 0, text: 20, total: 20 }
  },
  extractCityFromPrompt = (promptStr: string): string => {
    const match1 = CITY_PATTERN_1.exec(promptStr)
    if (match1?.groups?.city) return match1.groups.city
    const match2 = CITY_PATTERN_2.exec(promptStr)
    if (match2?.groups?.city) return match2.groups.city
    return 'London'
  },
  isWeatherRequest = (promptStr: string): boolean =>
    promptStr.includes('weather') && !promptStr.includes('tool-result') && !promptStr.includes('temperature'),
  hasToolResult = (promptStr: string): boolean => promptStr.includes('tool-result') || promptStr.includes('temperature'),
  isRejection = (promptStr: string): boolean => promptStr.includes('rejected') || promptStr.includes('declined'),
  getTextResponse = (promptStr: string): string => {
    if (isRejection(promptStr))
      return 'I understand the tool call was rejected. Is there anything else I can help you with?'
    if (hasToolResult(promptStr))
      return 'Based on the weather data, I can see the current conditions for your requested location.'
    if (promptStr.includes('joke')) return 'Why do programmers prefer dark mode? Because light attracts bugs!'
    if (promptStr.includes('hello') || promptStr.includes('hi'))
      return 'Hello! I am a mock AI assistant. How can I help you today?'
    if (promptStr.includes('story') || promptStr.includes('essay') || promptStr.includes('detailed'))
      return 'Once upon a time in a land far away there lived a magnificent dragon who guarded ancient treasures. The dragon had scales of emerald green and eyes that sparkled like diamonds. Every day the dragon would soar through the clouds watching over the peaceful kingdom below. Many brave knights came to challenge the dragon but none could match its wisdom and strength. The dragon was not evil as the legends claimed but rather a gentle guardian of the realm protecting the innocent from harm. One day a young princess approached the dragon not with weapons but with kindness and from that day forward they became the best of friends. Together they brought peace and prosperity to the entire kingdom and the dragon lived happily ever after.'
    return 'This is a mock response for testing purposes.'
  },
  createWeatherToolCall = (city: string): LanguageModelV3Content => ({
    input: JSON.stringify({ city, unit: 'celsius' }),
    toolCallId: `mock-tool-call-${Date.now()}`,
    toolName: 'getWeather',
    type: 'tool-call'
  }),
  getResponseForPrompt = (
    prompt: LanguageModelV3Prompt
  ): { content: LanguageModelV3Content[]; finishReason: LanguageModelV3FinishReason } => {
    const promptStr = JSON.stringify(prompt).toLowerCase()
    if (isWeatherRequest(promptStr))
      return { content: [createWeatherToolCall(extractCityFromPrompt(promptStr))], finishReason: finishReasonToolCalls }

    return { content: [{ text: getTextResponse(promptStr), type: 'text' }], finishReason: finishReasonStop }
  },
  createGenerateResult = (prompt: LanguageModelV3Prompt): LanguageModelV3GenerateResult => {
    const { content, finishReason } = getResponseForPrompt(prompt)
    return { content, finishReason, usage: mockUsage, warnings: [] }
  },
  createStreamResult = (prompt: LanguageModelV3Prompt): LanguageModelV3StreamResult => {
    const { content, finishReason } = getResponseForPrompt(prompt),
      chunks: LanguageModelV3StreamPart[] = []

    for (const part of content)
      if (part.type === 'tool-call')
        chunks.push({
          input: part.input,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          type: 'tool-call'
        })
      else if (part.type === 'text') {
        const words = part.text.split(' ')
        chunks.push({ id: 't1', type: 'text-start' })
        for (const word of words) chunks.push({ delta: `${word} `, id: 't1', type: 'text-delta' })
        chunks.push({ id: 't1', type: 'text-end' })
      }

    chunks.push({ finishReason, type: 'finish', usage: mockUsage })
    return { stream: simulateReadableStream<LanguageModelV3StreamPart>({ chunkDelayInMs: 300, chunks }) }
  },
  chatModel = new MockLanguageModelV3({
    // eslint-disable-next-line @typescript-eslint/require-await
    doGenerate: async ({ prompt }) => createGenerateResult(prompt),
    // eslint-disable-next-line @typescript-eslint/require-await
    doStream: async ({ prompt }) => createStreamResult(prompt),
    modelId: 'mock-chat-model',
    provider: 'mock'
  })

export { chatModel }
