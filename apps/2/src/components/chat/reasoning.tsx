'use client'

import { Reasoning, ReasoningContent, ReasoningTrigger } from '@a/ui/ai-elements/reasoning'
import { useEffect, useState } from 'react'

interface MessageReasoningProps {
  isLoading: boolean
  reasoning: string
}

interface ReasoningPart {
  state?: 'done' | 'streaming'
  text: string
  type: 'reasoning'
}

const MessageReasoning = ({ isLoading, reasoning }: MessageReasoningProps) => {
    const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading)

    useEffect(() => {
      if (isLoading) setHasBeenStreaming(true)
    }, [isLoading])

    return (
      <Reasoning data-testid='message-reasoning' defaultOpen={hasBeenStreaming} isStreaming={isLoading}>
        <ReasoningTrigger />
        <ReasoningContent>{reasoning}</ReasoningContent>
      </Reasoning>
    )
  },
  ThinkingIndicator = ({ isActive }: { isActive: boolean }) =>
    isActive ? (
      <Reasoning data-testid='thinking-indicator' isStreaming>
        <ReasoningTrigger />
      </Reasoning>
    ) : null,
  getReasoningParts = (m: { parts: { type: string }[] }): ReasoningPart[] => {
    const parts: ReasoningPart[] = []
    for (const p of m.parts) if (p.type === 'reasoning' && 'text' in p) parts.push(p as ReasoningPart)
    return parts
  },
  ReasoningList = ({ isStreaming, parts }: { isStreaming: boolean; parts: ReasoningPart[] }) => (
    <>
      {parts.map((part, i) => {
        const hasContent = part.text.trim().length > 0,
          isReasoningStreaming = part.state === 'streaming'
        if (hasContent || isReasoningStreaming)
          return (
            <MessageReasoning
              isLoading={isStreaming || isReasoningStreaming}
              key={`reasoning-${i}`}
              reasoning={part.text}
            />
          )
        return null
      })}
    </>
  )

export { getReasoningParts, ReasoningList, ThinkingIndicator }
