import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { convexAuthNextjsToken as tok } from '@convex-dev/auth/nextjs/server'
import { preloadQuery } from 'convex/nextjs'
import { notFound } from 'next/navigation'

import { isId } from '~/utils'

import { Client } from './client'

const Page = async ({ params }: { params: Promise<{ id: Id<'blog'> }> }) => {
  const { id: raw } = await params,
    id = isId<'blog'>(raw) ? raw : null
  if (!id) return notFound()
  const preloaded = await preloadQuery(api.blog.read, { id }, { token: await tok() })
  return <Client preloaded={preloaded} />
}

export default Page
