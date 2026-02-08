'use client'

import type { api } from '@a/cv'
import type { Id } from '@a/cv/model'
import type { Preloaded } from 'convex/react'

import { Input } from '@a/ui/input'
import { usePreloadedQuery } from 'convex/react'
import { Search } from 'lucide-react'
import { useCallback, useDeferredValue, useState } from 'react'

import { Create, List } from '../common'

const Client = ({ preloaded }: { preloaded: Preloaded<typeof api.blog.all> }) => {
  const serverBlogs = usePreloadedQuery(preloaded),
    [removedIds, setRemovedIds] = useState<Set<Id<'blog'>>>(new Set()),
    [query, setQuery] = useState(''),
    deferredQuery = useDeferredValue(query.toLowerCase()),
    filtered = serverBlogs.filter(b => {
      if (removedIds.has(b._id)) return false
      if (!deferredQuery) return true
      return (
        b.title.toLowerCase().includes(deferredQuery) ||
        b.content.toLowerCase().includes(deferredQuery) ||
        b.tags?.some(t => t.toLowerCase().includes(deferredQuery))
      )
    }),
    handleRemove = useCallback((id: Id<'blog'>) => {
      setRemovedIds(prev => new Set(prev).add(id))
    }, [])
  return (
    <div data-testid='crud-dynamic-page'>
      <Create />
      <div className='relative mb-4'>
        <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          className='pl-9'
          data-testid='blog-search-input'
          onChange={e => setQuery(e.target.value)}
          placeholder='Search blogs...'
          type='search'
          value={query}
        />
      </div>
      <List blogs={filtered} onRemove={handleRemove} />
    </div>
  )
}

export default Client
