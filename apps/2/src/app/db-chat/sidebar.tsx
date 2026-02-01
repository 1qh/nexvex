'use client'

import { api } from '@a/cv'
import { useMutation, useQuery } from 'convex/react'

import ChatSidebar from '~/components/chat/sidebar'

const Sb = () => {
  const chats = useQuery(api.dbchat.listChats) ?? [],
    deleteChat = useMutation(api.dbchat.deleteChat),
    handleDelete = async (chatId: string) => {
      await deleteChat({ id: chatId as Parameters<typeof deleteChat>[0]['id'] })
    }

  return <ChatSidebar basePath='/db-chat' onDelete={handleDelete} threads={chats} />
}

export default Sb
