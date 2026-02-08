'use client'

import { api } from '@a/cv'
import { Spinner } from '@a/ui/spinner'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

import ChatSidebar from './chat-sidebar'

const Sb = () => {
  const { inView, ref } = useInView(),
    { loadMore, results, status } = usePaginatedQuery(api.chat.list, { where: { own: true } }, { initialNumItems: 20 }),
    deleteChat = useMutation(api.chat.rm),
    handleDelete = async (chatId: string) => {
      await deleteChat({ id: chatId as Parameters<typeof deleteChat>[0]['id'] })
    }

  useEffect(() => {
    if (inView && status === 'CanLoadMore') loadMore(20)
  }, [inView, loadMore, status])

  return (
    <>
      <ChatSidebar basePath='/chat' onDelete={handleDelete} threads={results} />
      <div className='flex justify-center p-2'>
        {status === 'LoadingMore' ? (
          <Spinner />
        ) : status === 'CanLoadMore' ? (
          <p className='h-4' ref={ref} />
        ) : status === 'Exhausted' && results.length > 20 ? (
          <Check className='animate-[fadeOut_2s_forwards] text-green-500' />
        ) : null}
      </div>
    </>
  )
}

export default Sb
