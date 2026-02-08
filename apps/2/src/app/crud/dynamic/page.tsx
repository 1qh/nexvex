import { api } from '@a/cv'
import { preloadQuery } from 'convex/nextjs'
import { connection } from 'next/server'

import { getToken } from '~/auth'
import sp from '~/components/suspense-wrap'

import Client from './client'

const Page = async () => {
  await connection()
  const preloaded = await preloadQuery(
    api.blog.all,
    { where: { or: [{ published: true }, { own: true }] } },
    { token: await getToken() }
  )
  return <Client preloaded={preloaded} />
}

export default sp(Page)
