import { ConvexError } from 'convex/values'

import type { ErrorCode } from './types'

import { ERROR_MESSAGES } from './types'

type ErrorHandler = Partial<Record<ErrorCode, () => void>> & { default?: () => void }

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object',
  getErrorCode = (e: unknown): ErrorCode | undefined => {
    if (!(e instanceof ConvexError)) return
    const { data } = e as { data?: unknown }
    if (!isRecord(data)) return
    const { code } = data
    return typeof code === 'string' && code in ERROR_MESSAGES ? (code as ErrorCode) : undefined
  },
  getErrorMessage = (e: unknown): string => {
    if (e instanceof ConvexError) {
      const { data } = e as { data?: unknown }
      if (isRecord(data)) {
        if (typeof data.message === 'string') return data.message
        const { code } = data
        if (typeof code === 'string' && code in ERROR_MESSAGES) return ERROR_MESSAGES[code as ErrorCode]
      }
    }
    if (e instanceof Error) return e.message
    return 'Unknown error'
  },
  handleConvexError = (e: unknown, handlers: ErrorHandler): void => {
    const code = getErrorCode(e),
      handler = code ? handlers[code] : undefined
    if (handler) {
      handler()
      return
    }
    handlers.default?.()
  }

export { getErrorCode, getErrorMessage, handleConvexError }
