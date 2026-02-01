import { api } from '@a/cv'
import { convexAuthNextjsToken as tok } from '@convex-dev/auth/nextjs/server'
import { fetchQuery } from 'convex/nextjs'

import sp from '~/components/suspense-wrap'

import { Create, List } from '../common'

const Page = async () => {
  const blogs = await fetchQuery(
    api.blog.all,
    { where: { or: [{ published: true }, { own: true }] } },
    { token: await tok() }
  )
  return (
    <>
      <Create />
      <List blogs={blogs} />
    </>
  )
}

export default sp(Page)
