/* eslint-disable no-await-in-loop */
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/suspicious/useAwait: x

interface RetryOptions {
  base?: number
  initialDelayMs?: number
  maxAttempts?: number
  maxDelayMs?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    base: 2,
    initialDelayMs: 500,
    maxAttempts: 3,
    maxDelayMs: 10_000
  },
  sleep = async (ms: number) =>
    // oxlint-disable-next-line promise/avoid-new
    new Promise<void>(resolve => {
      setTimeout(resolve, ms)
    }),
  calculateDelay = (attempt: number, opts: Required<RetryOptions>) => {
    const jitter = Math.random() * 0.3 + 0.85
    return Math.min(opts.initialDelayMs * opts.base ** attempt * jitter, opts.maxDelayMs)
  },
  withRetry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    let lastError: Error = new Error('Retry failed')

    for (let attempt = 0; attempt < opts.maxAttempts; attempt += 1)
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < opts.maxAttempts - 1) await sleep(calculateDelay(attempt, opts))
      }

    throw lastError
  },
  fetchWithRetry = async (url: string, options?: RequestInit & { retry?: RetryOptions }): Promise<Response> => {
    const { retry, ...fetchOptions } = options ?? {}

    return withRetry(async () => {
      const response = await fetch(url, fetchOptions)
      if (!response.ok && response.status >= 500) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

      return response
    }, retry)
  }

export { fetchWithRetry, withRetry }
