'use client'

import type { ChatErrorType } from '@a/cv/chat'
import type { Doc } from '@a/cv/model'
import type { UIMessage } from '@convex-dev/agent/react'

import { api } from '@a/cv'
import { categorizeError, getErrorMessage } from '@a/cv/chat'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from '@a/ui/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@a/ui/ai-elements/message'
import { Tool, ToolContent, ToolHeader, ToolInput } from '@a/ui/ai-elements/tool'
import { Alert, AlertDescription } from '@a/ui/alert'
import { Button } from '@a/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@a/ui/tooltip'
import { optimisticallySendMessage, useUIMessages } from '@convex-dev/agent/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  RefreshCw,
  TimerIcon,
  WifiOffIcon,
  XIcon
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import type { ToolPart } from '~/components/chat/tools'

import { useStreamingText } from '~/components/chat/hooks'
import ChatInput from '~/components/chat/input'
import { getReasoningParts, ReasoningList, ThinkingIndicator } from '~/components/chat/reasoning'

const tryParseJson = (str: string): Record<string, unknown> => {
    try {
      return JSON.parse(str) as Record<string, unknown>
    } catch {
      return { error: str }
    }
  },
  parseToolOutput = (output: unknown): Record<string, unknown> => {
    if (typeof output === 'string') return tryParseJson(output)
    if (typeof output !== 'object' || output === null) return { error: String(output) }
    const obj = output as Record<string, unknown>
    if (obj.type === 'text' && typeof obj.value === 'string') return tryParseJson(obj.value)
    return obj
  },
  formatWeatherOutput = (output: unknown): string => {
    const parsed = parseToolOutput(output)
    if ('temperature' in parsed && 'city' in parsed) {
      const unit = parsed.unit === 'fahrenheit' ? 'F' : 'C'
      return `The current temperature in ${String(parsed.city)} is ${String(parsed.temperature)}°${unit}`
    }
    if ('error' in parsed) return `Weather error: ${String(parsed.error)}`
    return JSON.stringify(parsed, null, 2)
  },
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getErrorIcon = (type: ChatErrorType) => {
    const icons: Record<ChatErrorType, React.ReactNode> = {
      auth: <KeyRoundIcon className='size-4 text-red-600' />,
      network: <WifiOffIcon className='size-4 text-red-600' />,
      rate_limit: <TimerIcon className='size-4 text-red-600' />,
      unknown: <AlertCircleIcon className='size-4 text-red-600' />
    }
    return icons[type]
  },
  ErrorAlert = ({ error, onDismiss, onRetry }: { error: Error | null; onDismiss: () => void; onRetry: () => void }) => {
    if (!error) return null
    const errorType = categorizeError(error),
      message = getErrorMessage(errorType),
      icon = getErrorIcon(errorType),
      renderAction = () => {
        if (errorType === 'network')
          return (
            <Button data-testid='error-retry-button' onClick={onRetry} size='sm' variant='default'>
              <RefreshCw className='mr-1 size-3' />
              Retry
            </Button>
          )
        if (errorType === 'auth')
          return (
            <Button asChild data-testid='error-signin-button' size='sm' variant='default'>
              <Link href='/sign-in'>
                <KeyRoundIcon className='mr-1 size-3' />
                Sign in
              </Link>
            </Button>
          )
        if (errorType === 'rate_limit')
          return (
            <span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
              <TimerIcon className='size-3' />
              Please wait before trying again
            </span>
          )
        return (
          <Button data-testid='error-dismiss-button' onClick={onDismiss} size='sm' variant='outline'>
            <XIcon className='mr-1 size-3' />
            Dismiss
          </Button>
        )
      }
    return (
      <Alert className='mx-auto max-w-3xl border-red-500/50 bg-red-500/10' data-testid='error-alert'>
        {icon}
        <AlertDescription className='flex flex-col gap-3'>
          <div>{message}</div>
          <div className='flex gap-2'>{renderAction()}</div>
        </AlertDescription>
      </Alert>
    )
  },
  ToolApprovalCard = ({ approval }: { approval: Doc<'pendingToolApprovals'> }) => {
    const [isProcessing, setIsProcessing] = useState(false),
      approve = useAction(api.chat.approveToolCall),
      reject = useAction(api.chat.rejectToolCall),
      args = approval.args as { city: string; unit: string },
      handleApprove = async () => {
        setIsProcessing(true)
        try {
          await approve({ approvalId: approval._id })
        } finally {
          setIsProcessing(false)
        }
      },
      handleReject = async () => {
        setIsProcessing(true)
        try {
          await reject({ approvalId: approval._id, reason: 'User declined' })
        } finally {
          setIsProcessing(false)
        }
      }

    return (
      <Alert className='mx-auto max-w-3xl border-yellow-500/50 bg-yellow-500/10' data-testid='tool-approval-card'>
        <CloudIcon className='size-4 text-yellow-600' />
        <AlertDescription className='flex flex-col gap-3'>
          <div>
            <span className='font-medium'>Weather Request:</span> The assistant wants to check the weather for{' '}
            <span className='font-semibold'>{args.city}</span> ({args.unit})
          </div>
          <div className='flex gap-2'>
            <Button
              data-testid='approve-button'
              disabled={isProcessing}
              onClick={() => {
                handleApprove()
              }}
              size='sm'
              variant='default'>
              <CheckIcon className='mr-1 size-3' />
              Approve
            </Button>
            <Button
              data-testid='deny-button'
              disabled={isProcessing}
              onClick={() => {
                handleReject()
              }}
              size='sm'
              variant='outline'>
              <XIcon className='mr-1 size-3' />
              Deny
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  },
  ToolResultDisplay = ({ errorText, output }: { errorText?: string; output?: unknown }) => {
    if (!(output || errorText)) return null
    const outputText = output ? formatWeatherOutput(output) : ''
    return (
      <div className='space-y-2 p-4'>
        <h4 className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
          {errorText ? 'Error' : 'Result'}
        </h4>
        <div className={errorText ? 'rounded-md bg-destructive/10 p-2 text-destructive' : 'rounded-md bg-muted/50 p-3'}>
          {errorText ? <span className='text-sm'>{errorText}</span> : <span className='text-sm'>{outputText}</span>}
        </div>
      </div>
    )
  },
  NewMessageIndicator = ({ messageCount }: { messageCount: number }) => {
    const { isAtBottom, scrollToBottom } = useStickToBottomContext(),
      [hasNewMessages, setHasNewMessages] = useState(false),
      prevCountRef = useRef(messageCount)

    useEffect(() => {
      if (messageCount > prevCountRef.current && !isAtBottom) setHasNewMessages(true)
      prevCountRef.current = messageCount
    }, [messageCount, isAtBottom])

    useEffect(() => {
      if (isAtBottom) setHasNewMessages(false)
    }, [isAtBottom])

    if (!hasNewMessages) return null

    return (
      <button
        className='absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105'
        data-testid='new-message-indicator'
        onClick={() => {
          scrollToBottom()
        }}
        type='button'>
        New message
        <ChevronDownIcon className='size-4' />
      </button>
    )
  },
  MessageItem = ({
    m,
    threadId,
    usage
  }: {
    m: UIMessage
    threadId: string
    usage: null | undefined | { inputTokens: number; outputTokens: number; records: number; totalTokens: number }
  }) => {
    const [isRegenerating, setIsRegenerating] = useState(false),
      regenerate = useAction(api.chat.regenerateResponse),
      role = m.role as string,
      displayRole = role === 'tool' ? 'assistant' : role,
      isStreaming = m.status === 'streaming',
      visibleText = useStreamingText(m.text, isStreaming),
      reasoningParts = getReasoningParts(m),
      toolParts = m.parts.filter(p => 'toolName' in p || p.type.includes('tool')) as ToolPart[],
      hasToolOutput = toolParts.some(p => p.output),
      isCompleted = m.status === 'success',
      showRegenerate = displayRole === 'assistant' && isCompleted && !isStreaming,
      handleRegenerate = async () => {
        setIsRegenerating(true)
        try {
          await regenerate({ messageOrder: m.order, threadId })
        } finally {
          setIsRegenerating(false)
        }
      }

    if (displayRole === 'assistant' && !m.text && !hasToolOutput && toolParts.length === 0) return null

    const messageNode = (
      <Message data-status={m.status} data-testid='message' from={displayRole as 'assistant' | 'user'} key={m.key}>
        <MessageContent>
          <ReasoningList isStreaming={isStreaming} parts={reasoningParts} />
          {m.text ? (
            <>
              <MessageResponse
                className={m.status === 'failed' ? 'text-destructive' : m.status === 'pending' ? 'opacity-70' : ''}>
                {visibleText}
              </MessageResponse>
              {isStreaming ? <span className='animate-pulse'>▊</span> : null}
            </>
          ) : null}
          {toolParts.map((part, i) => {
            if (part.output)
              return (
                <Tool defaultOpen key={`${m.key}-tool-${i}`}>
                  <ToolHeader
                    state={part.state as 'output-available'}
                    title={part.toolName === 'getWeather' ? 'Weather' : part.toolName}
                    type='tool-invocation'
                  />
                  <ToolContent>
                    {part.input ? <ToolInput input={part.input} /> : null}
                    <ToolResultDisplay errorText={part.errorText} output={part.output} />
                  </ToolContent>
                </Tool>
              )

            if (part.state === 'input-available' || part.state === 'input-streaming')
              return (
                <Tool key={`${m.key}-tool-${i}`}>
                  <ToolHeader
                    state={part.state}
                    title={part.toolName === 'getWeather' ? 'Weather' : part.toolName}
                    type='tool-invocation'
                  />
                  <ToolContent>{part.input ? <ToolInput input={part.input} /> : null}</ToolContent>
                </Tool>
              )

            return null
          })}
        </MessageContent>
        {showRegenerate ? (
          <Button
            className='mt-2'
            data-testid='regenerate-button'
            disabled={isRegenerating}
            onClick={() => {
              handleRegenerate()
            }}
            size='sm'
            variant='ghost'>
            <RefreshCw className={`mr-1 size-3 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        ) : null}
      </Message>
    )

    if (displayRole === 'assistant')
      return (
        <Tooltip>
          <TooltipTrigger asChild>{messageNode}</TooltipTrigger>
          <TooltipContent>
            <span className='text-xs'>
              {usage && usage.totalTokens > 0
                ? `Input: ${usage.inputTokens} | Output: ${usage.outputTokens} tokens`
                : 'Usage tracking enabled'}
            </span>
          </TooltipContent>
        </Tooltip>
      )

    return messageNode
  },
  Client = ({ threadId }: { threadId: string }) => {
    const [chatError, setChatError] = useState<Error | null>(null),
      lastTextRef = useRef(''),
      sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate((store, args) => {
        optimisticallySendMessage(api.chat.listMessages)(store, {
          prompt: args.content,
          threadId: args.threadId
        })
      }),
      abort = useMutation(api.chat.abort),
      { results: rawMessages, status } = useUIMessages(
        api.chat.listMessages,
        { threadId },
        { initialNumItems: 50, stream: true }
      ),
      pendingApprovals = useQuery(api.chat.getPendingApprovals, { threadId }),
      usage = useQuery(api.chat.getUsage, { threadId }),
      isLoading = status === 'LoadingFirstPage',
      messages = useMemo(() => {
        const finalized = new Set<string>()
        let maxOrder = -1
        for (const m of rawMessages)
          if (m.status !== 'streaming' && m.status !== 'pending') {
            finalized.add(`${m.order}-${m.stepOrder}`)
            maxOrder = Math.max(maxOrder, m.order)
          }
        return rawMessages.filter(m => {
          if (m.status !== 'streaming' && m.status !== 'pending') return true
          const isDupe = finalized.has(`${m.order}-${m.stepOrder}`)
          return !(isDupe || (m.order <= maxOrder && m.text && m.text.length < 50))
        })
      }, [rawMessages]),
      isStreaming = useMemo(() => {
        const active = messages.filter(m => m.status === 'streaming' || m.status === 'pending')
        return active.some(m => m.text || m.parts.some(p => 'toolName' in p))
      }, [messages]),
      showThinking = useMemo(() => {
        const pending = messages.filter(m => m.status === 'streaming' || m.status === 'pending')
        if (pending.length === 0) return false
        const assistantPending = pending.filter(m => m.role === 'assistant')
        return assistantPending.length === 0 || !assistantPending.some(m => m.text)
      }, [messages]),
      clearError = () => setChatError(null),
      handleRetry = () => {
        clearError()
        const inputEl = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]')
        if (inputEl && lastTextRef.current) {
          inputEl.value = lastTextRef.current
          inputEl.dispatchEvent(new Event('input', { bubbles: true }))
        }
      },
      handleSubmit = async (text: string) => {
        clearError()
        try {
          await sendMessage({ content: text, threadId })
        } catch (error) {
          setChatError(error instanceof Error ? error : new Error(String(error)))
          const inputEl = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]')
          if (inputEl) lastTextRef.current = inputEl.value
        }
      },
      handleAbort = () => {
        const streamingMsg = messages.find(m => m.status === 'streaming')
        if (streamingMsg) abort({ order: streamingMsg.order, threadId })
      }

    return (
      <div className='flex flex-1 flex-col overflow-hidden'>
        <Conversation className='flex-1'>
          <ConversationContent className='mx-auto max-w-3xl'>
            {messages.length === 0 && !isLoading ? (
              <ConversationEmptyState
                data-testid='empty-state'
                description='Send a message to start a conversation'
                icon={<MessageSquareIcon className='size-8' />}
                title='Start a conversation'
              />
            ) : (
              messages.map(m => <MessageItem key={m.key} m={m} threadId={threadId} usage={usage} />)
            )}
            <ThinkingIndicator isActive={showThinking} />
            {pendingApprovals?.map(approval => (
              <ToolApprovalCard approval={approval} key={approval._id} />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
          <NewMessageIndicator messageCount={messages.length} />
        </Conversation>
        <div className='space-y-4 border-t p-4'>
          <ErrorAlert error={chatError} onDismiss={clearError} onRetry={handleRetry} />
          <ChatInput isBusy={isStreaming} onAbort={handleAbort} onSubmit={handleSubmit} />
        </div>
      </div>
    )
  }

export default Client
