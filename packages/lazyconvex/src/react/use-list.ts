'use client'

import type { PaginatedQueryArgs, PaginatedQueryReference } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { usePaginatedQuery } from 'convex/react'

type ListItems<F extends PaginatedQueryReference> = FunctionReturnType<F>['page']
type ListRest<F extends PaginatedQueryReference> =
  PaginatedQueryArgs<F> extends Record<string, never> ? [args?: PaginatedQueryArgs<F>] : [args: PaginatedQueryArgs<F>]
const PAGE_SIZE = 50,
  useList = <F extends PaginatedQueryReference>(query: F, ...rest: ListRest<F>) => {
    const queryArgs = (rest[0] ?? {}) as unknown as PaginatedQueryArgs<F>,
      { loadMore, results, status } = usePaginatedQuery(query, queryArgs, { initialNumItems: PAGE_SIZE })
    return {
      isDone: status === 'Exhausted',
      items: results as ListItems<F>,
      loadMore: (n?: number) => loadMore(n ?? PAGE_SIZE),
      status
    }
  }

export { useList }
