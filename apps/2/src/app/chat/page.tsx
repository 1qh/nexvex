'use client'

import { api } from '@a/cv'
import { Conversation, ConversationContent, ConversationEmptyState } from '@a/ui/ai-elements/conversation'
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from '@a/ui/ai-elements/prompt-input'
import { useMutation } from 'convex/react'
import { SparklesIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const Page = () => {
  const router = useRouter(),
    createChat = useMutation(api.chat.create),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isPending, startTransition] = useTransition(),
    handleSubmit = async ({ text }: { text: string }) => {
      if (!text.trim() || isSubmitting) return
      setIsSubmitting(true)
      try {
        const chatId = await createChat({ title: text })
        startTransition(() => router.push(`/chat/${chatId}?query=${encodeURIComponent(text)}`))
      } finally {
        setIsSubmitting(false)
      }
    }
  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <Conversation>
        <ConversationContent className='mx-auto flex max-w-3xl flex-col items-center justify-center'>
          <ConversationEmptyState
            data-testid='empty-state'
            description='Ask me about the weather anywhere in the world'
            icon={<SparklesIcon className='size-8' />}
            title='How can I help you today?'
          />
        </ConversationContent>
      </Conversation>
      <PromptInput className='mx-auto max-w-3xl' onSubmit={handleSubmit}>
        <PromptInputTextarea
          data-testid='chat-input'
          disabled={isSubmitting || isPending}
          placeholder='Send a message...'
        />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit
            data-testid={isSubmitting || isPending ? 'stop-button' : 'send-button'}
            status={isSubmitting || isPending ? 'submitted' : 'ready'}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

export default Page
