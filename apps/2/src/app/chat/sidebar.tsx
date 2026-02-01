'use client'

import { api } from '@a/cv'
import { useAction, useQuery } from 'convex/react'

import ChatSidebar from '~/components/chat/sidebar'

const Sb = () => {
  const threads = useQuery(api.chat.listThreads) ?? [],
    rm = useAction(api.chat.rm),
    handleDelete = async (threadId: string) => {
      await rm({ threadId })
    }

  return <ChatSidebar basePath='/chat' onDelete={handleDelete} threads={threads} />
}

export default Sb
