'use client'

import type { UIMessage } from 'convex-durable-agents/react'

import { api } from '@a/cv'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from '@a/ui/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@a/ui/ai-elements/message'
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@a/ui/ai-elements/tool'
import { getMessageKey, getMessageStatus, useAgentChat, useSmoothText } from 'convex-durable-agents/react'
import { MessageSquareIcon } from 'lucide-react'

import ChatInput from '~/components/chat/input'
import { getReasoningParts, ReasoningList, ThinkingIndicator } from '~/components/chat/reasoning'
import StatusBadge from '~/components/chat/status'
import { getToolName } from '~/components/chat/tools'

const useStreamingText = (text: string, isStreaming: boolean) => {
    const [visibleText] = useSmoothText(text, { startStreaming: isStreaming })
    return visibleText || (isStreaming ? '...' : '')
  },
  getTextFromMessage = (m: UIMessage): string => {
    const textParts = m.parts.filter((p): p is { text: string; type: 'text' } => p.type === 'text')
    return textParts.map(p => p.text).join('')
  },
  isToolPart = (
    p: UIMessage['parts'][number]
  ): p is UIMessage['parts'][number] & { state: string; toolCallId: string; type: `tool-${string}` } =>
    p.type.startsWith('tool-'),
  MessageItem = ({ m }: { m: UIMessage }) => {
    const status = getMessageStatus(m),
      isStreaming = status === 'streaming',
      text = getTextFromMessage(m),
      reasoningParts = getReasoningParts(m),
      toolCalls = m.parts.filter(isToolPart),
      visibleText = useStreamingText(text, isStreaming)

    if (m.role === 'system') return null

    return (
      <Message data-status={status} data-testid='message' from={m.role} key={getMessageKey(m)}>
        <MessageContent>
          <ReasoningList isStreaming={isStreaming} parts={reasoningParts} />
          {toolCalls.map(tc => {
            const toolName = getToolName(tc.type),
              input = 'input' in tc ? tc.input : undefined,
              output = 'output' in tc ? tc.output : undefined,
              errorText = 'errorText' in tc ? String(tc.errorText) : undefined

            return (
              <Tool defaultOpen key={tc.toolCallId}>
                <ToolHeader state={tc.state as 'output-available'} title={toolName} type='tool-invocation' />
                <ToolContent>
                  {input === undefined ? null : <ToolInput input={input} />}
                  <ToolOutput errorText={errorText} output={output} />
                </ToolContent>
              </Tool>
            )
          })}
          {visibleText ? (
            <>
              <MessageResponse className={status === 'failed' ? 'text-destructive' : ''}>{visibleText}</MessageResponse>
              {isStreaming ? <span className='animate-pulse'>|</span> : null}
            </>
          ) : null}
        </MessageContent>
      </Message>
    )
  },
  Client = ({ threadId }: { threadId: string }) => {
    const { isFailed, isLoading, isRunning, isStopped, messages, resume, sendMessage, status, stop } = useAgentChat({
        getThread: api.durableapi.getThread,
        listMessages: api.durableapi.listMessagesWithStreams,
        resumeThread: api.durableapi.resumeThread,
        sendMessage: api.durableapi.sendMessage,
        stopThread: api.durableapi.stopThread,
        threadId
      }),
      showThinking = isRunning && messages.filter(m => m.role === 'assistant').length === 0,
      handleSend = (text: string) => {
        sendMessage(text)
      },
      handleStop = () => {
        stop()
      },
      handleResume = () => {
        resume()
      }

    return (
      <div className='flex flex-1 flex-col overflow-hidden'>
        <StatusBadge
          isFailed={isFailed}
          isRunning={isRunning}
          isStopped={isStopped}
          onResume={handleResume}
          status={status}
        />
        <Conversation className='flex-1'>
          <ConversationContent className='mx-auto max-w-3xl'>
            {messages.length === 0 && !isLoading ? (
              <ConversationEmptyState
                data-testid='empty-state'
                description='Send a message to start'
                icon={<MessageSquareIcon className='size-8' />}
                title='Durable Chat'
              />
            ) : (
              messages.map(m => <MessageItem key={getMessageKey(m)} m={m} />)
            )}
            <ThinkingIndicator isActive={showThinking} />
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className='border-t p-4'>
          <ChatInput isBusy={isRunning} onAbort={handleStop} onSubmit={handleSend} />
        </div>
      </div>
    )
  }

export default Client
