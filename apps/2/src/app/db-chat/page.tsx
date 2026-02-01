'use client'

import { api } from '@a/cv'
import { Conversation, ConversationContent, ConversationEmptyState } from '@a/ui/ai-elements/conversation'
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from '@a/ui/ai-elements/prompt-input'
import { useMutation } from 'convex/react'
import { SparklesIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const suggestions = [
  { icon: '🌤️', label: "What's the weather in San Francisco?" },
  { icon: '🗽', label: 'Check the temperature in New York' },
  { icon: '🌧️', label: 'Is it raining in London?' }
]

const Page = () => {
  const router = useRouter(),
    createChat = useMutation(api.dbchat.createChat),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isPending, startTransition] = useTransition(),
    handleSubmit = async ({ text }: { text: string }) => {
      if (!text.trim() || isSubmitting) return
      setIsSubmitting(true)
      try {
        const chatId = await createChat({ title: text.slice(0, 50), visibility: 'private' })
        startTransition(() => router.push(`/db-chat/${chatId}?query=${encodeURIComponent(text)}`))
      } finally {
        setIsSubmitting(false)
      }
    },
    handleSuggestionClick = (text: string) => {
      handleSubmit({ text })
    }

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <Conversation className='flex-1'>
        <ConversationContent className='mx-auto flex max-w-3xl flex-col items-center justify-center'>
          <ConversationEmptyState
            description='Ask me about the weather anywhere in the world'
            icon={<SparklesIcon className='size-8' />}
            title='How can I help you today?'
          />
          <div className='mt-6 flex flex-wrap justify-center gap-2'>
            {suggestions.map(s => (
              <button
                className='flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:bg-muted'
                disabled={isSubmitting || isPending}
                key={s.label}
                onClick={() => handleSuggestionClick(s.label)}
                type='button'>
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </ConversationContent>
      </Conversation>
      <div className='border-t p-4'>
        <PromptInput className='mx-auto max-w-3xl' onSubmit={handleSubmit}>
          <PromptInputTextarea disabled={isSubmitting || isPending} placeholder='Send a message...' />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit status={isSubmitting || isPending ? 'submitted' : 'ready'} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export default Page
