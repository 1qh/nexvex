'use client'

import { api } from '@a/cv'
import { useMutation, useQuery } from 'convex/react'

import ChatSidebar from '~/components/chat/sidebar'

interface DurableThread {
  _id: string
  status: string
  title?: string
}

const Sb = () => {
  const threads = useQuery(api.durableapi.listThreads, {}) ?? [],
    rm = useMutation(api.durableapi.deleteThread),
    handleDelete = async (threadId: string) => {
      await rm({ threadId })
    }

  return (
    <ChatSidebar<DurableThread>
      basePath='/durable-chat'
      getTitle={t => t.status}
      onDelete={handleDelete}
      threads={threads}
    />
  )
}

export default Sb
