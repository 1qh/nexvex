'use client'

import type { api } from '@a/cv'
import type { Preloaded } from 'convex/react'

import { usePreloadedQuery } from 'convex/react'

import { Create, List } from '../common'

const Client = ({ preloaded }: { preloaded: Preloaded<typeof api.blog.all> }) => {
  const blogs = usePreloadedQuery(preloaded)
  return (
    <>
      <Create />
      <List blogs={blogs} />
    </>
  )
}

export default Client
