'use client'

import { useSmoothText } from '@convex-dev/agent/react'

const useStreamingText = (text: string, isStreaming: boolean) => {
  const [visibleText] = useSmoothText(text, { startStreaming: isStreaming })
  return visibleText || (isStreaming ? '...' : '')
}

export { useStreamingText }
