import type { Id } from '@a/cv/model'
import type { UIMessage } from 'ai'

import { api } from '@a/cv'
import { convexAuthNextjsToken as tok } from '@convex-dev/auth/nextjs/server'
import { fetchQuery } from 'convex/nextjs'
import { redirect } from 'next/navigation'

import Client from './client'

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params,
    token = await tok()
  if (!token) redirect('/login')

  const chat = await fetchQuery(api.dbchat.getChat, { id: id as Id<'dbChat'> }, { token }),
    messages = chat ? await fetchQuery(api.dbchat.getMessages, { chatId: id as Id<'dbChat'> }, { token }) : []

  if (!chat) redirect('/db-chat')

  const initialMessages = messages.map((m: { _id: string; parts: unknown; role: 'assistant' | 'system' | 'user' }) => ({
    id: m._id,
    parts: m.parts as UIMessage['parts'],
    role: m.role
  }))

  return <Client chatId={id} initialMessages={initialMessages} />
}

export default Page
