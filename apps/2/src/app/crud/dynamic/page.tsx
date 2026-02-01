import { api } from '@a/cv'
import { convexAuthNextjsToken as tok } from '@convex-dev/auth/nextjs/server'
import { preloadQuery } from 'convex/nextjs'

import sp from '~/components/suspense-wrap'

import Client from './client'

const Page = async () => {
  const preloaded = await preloadQuery(
    api.blog.all,
    { where: { or: [{ published: true }, { own: true }] } },
    { token: await tok() }
  )
  return <Client preloaded={preloaded} />
}

export default sp(Page)
