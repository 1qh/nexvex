import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { preloadQuery } from 'convex/nextjs'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'

import { getToken } from '~/auth'
import { isId } from '~/utils'

import { Client } from './client'

const Page = async ({ params }: { params: Promise<{ id: Id<'blog'> }> }) => {
  await connection()
  const { id: raw } = await params,
    id = isId<'blog'>(raw) ? raw : null
  if (!id) return notFound()
  const preloaded = await preloadQuery(api.blog.read, { id }, { token: await getToken() })
  return <Client preloaded={preloaded} />
}

export default Page
