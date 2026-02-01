'use client'

import { api } from '@a/cv'
import { Conversation, ConversationContent, ConversationEmptyState } from '@a/ui/ai-elements/conversation'
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from '@a/ui/ai-elements/prompt-input'
import { useMutation } from 'convex/react'
import { MessageSquareIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const Page = () => {
  const router = useRouter(),
    createThread = useMutation(api.chat.create),
    sendMessage = useMutation(api.chat.sendMessage),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isPending, startTransition] = useTransition(),
    handleSubmit = async ({ text }: { text: string }) => {
      if (!text.trim() || isSubmitting) return
      setIsSubmitting(true)
      try {
        const threadId = await createThread({})
        await sendMessage({ content: text, threadId })
        startTransition(() => router.push(`/chat/${threadId}`))
      } finally {
        setIsSubmitting(false)
      }
    }

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <Conversation className='flex-1'>
        <ConversationContent className='mx-auto max-w-3xl'>
          <ConversationEmptyState
            data-testid='empty-state'
            description='Send a message to start a conversation'
            icon={<MessageSquareIcon className='size-8' />}
            title='Start a conversation'
          />
        </ConversationContent>
      </Conversation>
      <div className='border-t p-4'>
        <PromptInput className='mx-auto max-w-3xl' onSubmit={handleSubmit}>
          <PromptInputTextarea
            data-testid='chat-input'
            disabled={isSubmitting || isPending}
            placeholder='Type a message...'
          />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit data-testid='send-button' status={isSubmitting || isPending ? 'submitted' : 'ready'} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export default Page
