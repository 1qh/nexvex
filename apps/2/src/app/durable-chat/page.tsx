'use client'

import { api } from '@a/cv'
import { Conversation, ConversationContent, ConversationEmptyState } from '@a/ui/ai-elements/conversation'
import { useMutation } from 'convex/react'
import { MessageSquareIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import ChatInput from '~/components/chat/input'

const Page = () => {
  const router = useRouter(),
    createThread = useMutation(api.durableapi.createThread),
    sendMessage = useMutation(api.durableapi.sendMessage),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isPending, startTransition] = useTransition(),
    handleSubmit = async (text: string) => {
      if (!text.trim() || isSubmitting) return
      setIsSubmitting(true)
      try {
        const threadId = await createThread({})
        await sendMessage({ prompt: text, threadId })
        startTransition(() => router.push(`/durable-chat/${threadId}`))
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
            description='Durable chat with async tools and workpool retries'
            icon={<MessageSquareIcon className='size-8' />}
            title='Start a durable conversation'
          />
        </ConversationContent>
      </Conversation>
      <div className='border-t p-4'>
        <ChatInput isBusy={isSubmitting || isPending} onSubmit={handleSubmit} />
      </div>
    </div>
  )
}

export default Page
