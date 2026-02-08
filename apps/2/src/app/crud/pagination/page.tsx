'use client'

import { api } from '@a/cv'
import { Spinner } from '@a/ui/spinner'
import { usePaginatedQuery } from 'convex/react'
import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

import { Create, List } from '../common'

const Page = () => {
  const { inView, ref } = useInView(),
    { loadMore, results, status } = usePaginatedQuery(
      api.blog.list,
      { where: { or: [{ published: true }, { own: true }] } },
      { initialNumItems: 5 }
    )
  useEffect(() => {
    if (inView) loadMore(5)
  }, [inView, loadMore])
  return (
    <div data-testid='crud-pagination-page'>
      <Create />
      <List blogs={results} />
      {status === 'LoadingMore' ? (
        <Spinner className='m-auto' data-testid='loading-more' />
      ) : status === 'CanLoadMore' ? (
        <p className='h-8' data-testid='load-more-trigger' ref={ref} />
      ) : status === 'Exhausted' ? (
        <Check className='m-auto animate-[fadeOut_2s_forwards] text-green-500' data-testid='pagination-exhausted' />
      ) : null}
    </div>
  )
}

export default Page
