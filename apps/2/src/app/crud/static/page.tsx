import { api } from '@a/cv'
import { fetchQuery } from 'convex/nextjs'
import { connection } from 'next/server'

import { getToken } from '~/auth'
import sp from '~/components/suspense-wrap'

import { Create, List } from '../common'

const Page = async () => {
  await connection()
  const blogs = await fetchQuery(
    api.blog.all,
    { where: { or: [{ published: true }, { own: true }] } },
    { token: await getToken() }
  )
  return (
    <>
      <Create />
      <List blogs={blogs} />
    </>
  )
}

export default sp(Page)
