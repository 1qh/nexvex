import type { Id } from '@a/cv/model'
import type { UIMessage } from 'ai'

import { api } from '@a/cv'
import { fetchQuery } from 'convex/nextjs'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { getToken, isAuthenticated } from '~/auth'

import Client from './client'

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  await connection()
  const { id } = await params
  if (!(await isAuthenticated())) redirect('/login')

  const token = await getToken(),
    chat = await fetchQuery(api.chat.read, { id: id as Id<'chat'> }, { token }),
    messages = chat ? await fetchQuery(api.message.list, { chatId: id as Id<'chat'> }, { token }) : []

  if (!chat) redirect('/chat')

  const initialMessages = messages.map((m: { _id: string; parts: unknown; role: 'assistant' | 'system' | 'user' }) => ({
    id: m._id,
    parts: m.parts as UIMessage['parts'],
    role: m.role
  }))

  return <Client chatId={id} initialMessages={initialMessages} />
}

export default Page
