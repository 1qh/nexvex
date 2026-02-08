'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { Button } from '@a/ui/button'
import { Input } from '@a/ui/input'
import { Spinner } from '@a/ui/spinner'
import { useMutation, useQuery } from 'convex/react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const TestPage = () => {
  const [chatId, setChatId] = useState(''),
    [messageId, setMessageId] = useState(''),
    [editText, setEditText] = useState(''),
    messages = useQuery(api.message.list, chatId && chatId.length > 10 ? { chatId: chatId as Id<'chat'> } : 'skip'),
    updateMessage = useMutation(api.message.update),
    createChat = useMutation(api.chat.create),
    createMessage = useMutation(api.message.create),
    [pending, go] = useTransition(),
    handleCreateTestChat = () => {
      go(async () => {
        try {
          const newChatId = await createChat({ title: `Test Chat ${Date.now()}` })
          setChatId(newChatId)
          const msgId = await createMessage({
            chatId: newChatId,
            parts: [{ text: 'Original message text', type: 'text' }],
            role: 'user'
          })
          setMessageId(msgId)
          toast.success('Test chat and message created')
        } catch {
          toast.error('Failed to create test chat')
        }
      })
    },
    handleUpdateMessage = () => {
      if (!messageId || messageId.length <= 10) {
        toast.error('Enter a valid message ID')
        return
      }
      if (!editText.trim()) {
        toast.error('Enter new message text')
        return
      }
      go(async () => {
        try {
          await updateMessage({
            id: messageId as Id<'message'>,
            parts: [{ text: editText.trim(), type: 'text' }]
          })
          setEditText('')
          toast.success('Message updated')
        } catch {
          toast.error('Failed to update message')
        }
      })
    },
    copyId = async (id: string) => {
      try {
        await navigator.clipboard.writeText(id)
        toast.success('ID copied')
      } catch {
        toast.error('Failed to copy')
      }
    }

  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-6 p-4' data-testid='chat-test-page'>
      <h1 className='text-2xl font-bold'>Chat Test Page</h1>

      <section className='rounded-lg border p-4' data-testid='create-test-chat-section'>
        <h2 className='mb-3 text-lg font-semibold'>Create Test Chat</h2>
        <Button data-testid='create-test-chat' disabled={pending} onClick={handleCreateTestChat}>
          {pending ? <Spinner /> : 'Create Test Chat + Message'}
        </Button>
        {chatId ? (
          <div className='mt-3 rounded-lg bg-muted p-3'>
            <p className='text-sm'>
              Chat ID:{' '}
              <button
                className='cursor-pointer text-blue-500 hover:underline'
                data-testid='created-chat-id'
                // eslint-disable-next-line @typescript-eslint/strict-void-return, @typescript-eslint/no-misused-promises
                onClick={async () => copyId(chatId)}
                type='button'>
                {chatId}
              </button>
            </p>
            {messageId ? (
              <p className='text-sm'>
                Message ID:{' '}
                <button
                  className='cursor-pointer text-blue-500 hover:underline'
                  data-testid='created-message-id'
                  // eslint-disable-next-line @typescript-eslint/strict-void-return, @typescript-eslint/no-misused-promises
                  onClick={async () => copyId(messageId)}
                  type='button'>
                  {messageId}
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className='rounded-lg border p-4' data-testid='message-update-section'>
        <h2 className='mb-3 text-lg font-semibold'>Update Message</h2>

        <div className='mb-4 flex gap-2'>
          <Input
            data-testid='chat-id-input'
            onChange={e => setChatId(e.target.value)}
            placeholder='Chat ID'
            value={chatId}
          />
          <Button data-testid='chat-id-clear' onClick={() => setChatId('')} size='sm' variant='outline'>
            Clear
          </Button>
        </div>

        <div className='mb-4 flex gap-2'>
          <Input
            data-testid='message-id-input'
            onChange={e => setMessageId(e.target.value)}
            placeholder='Message ID to edit'
            value={messageId}
          />
          <Button data-testid='message-id-clear' onClick={() => setMessageId('')} size='sm' variant='outline'>
            Clear
          </Button>
        </div>

        <div className='mb-4 flex gap-2'>
          <Input
            data-testid='message-edit-input'
            onChange={e => setEditText(e.target.value)}
            placeholder='New message text'
            value={editText}
          />
        </div>

        <Button
          data-testid='message-update-submit'
          disabled={pending || !messageId || messageId.length <= 10 || !editText.trim()}
          onClick={handleUpdateMessage}>
          {pending ? <Spinner /> : 'Update Message'}
        </Button>
      </section>

      <section className='rounded-lg border p-4' data-testid='messages-list-section'>
        <h2 className='mb-3 text-lg font-semibold'>Messages in Chat</h2>
        {!chatId || chatId.length <= 10 ? (
          <p className='text-sm text-muted-foreground' data-testid='no-chat-selected'>
            Enter a chat ID above to see messages
          </p>
        ) : messages === undefined ? (
          <Spinner data-testid='messages-loading' />
        ) : messages.length === 0 ? (
          <p className='text-sm text-muted-foreground' data-testid='no-messages'>
            No messages in this chat
          </p>
        ) : (
          <div className='divide-y' data-testid='messages-list'>
            {messages.map(m => {
              const textPart = (m.parts as { text?: string; type: string }[]).find(p => p.type === 'text')
              return (
                <div className='py-2' data-testid='message-item' key={m._id}>
                  <p className='text-xs font-medium text-muted-foreground' data-testid='message-role'>
                    {m.role}
                  </p>
                  <p className='font-medium' data-testid='message-text'>
                    {textPart?.text ?? '(no text)'}
                  </p>
                  <button
                    className='cursor-pointer text-xs text-blue-500 hover:underline'
                    data-testid='message-item-id'
                    // eslint-disable-next-line @typescript-eslint/strict-void-return, @typescript-eslint/no-misused-promises
                    onClick={async () => copyId(m._id)}
                    type='button'>
                    {m._id}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default TestPage
