import type { FunctionReference } from 'convex/server'

import { anyApi } from 'convex/server'

type Api = NonNullable<typeof anyApi>

const blog = anyApi.blog as NonNullable<Api['blog']>,
  chat = anyApi.chat as NonNullable<Api['chat']>,
  message = anyApi.message as NonNullable<Api['message']>,
  testauth = anyApi.testauth as NonNullable<Api['testauth']>

const testApi = {
  blog: {
    all: blog.all as FunctionReference<'query'>,
    bulkRm: blog.bulkRm as FunctionReference<'mutation'>,
    bulkUpdate: blog.bulkUpdate as FunctionReference<'mutation'>,
    count: blog.count as FunctionReference<'query'>,
    create: blog.create as FunctionReference<'mutation'>,
    rm: blog.rm as FunctionReference<'mutation'>,
    search: blog.search as FunctionReference<'query'>,
    update: blog.update as FunctionReference<'mutation'>
  },
  chat: {
    all: chat.all as FunctionReference<'query'>,
    create: chat.create as FunctionReference<'mutation'>,
    list: chat.list as FunctionReference<'query'>,
    read: chat.read as FunctionReference<'query'>,
    rm: chat.rm as FunctionReference<'mutation'>
  },
  message: {
    create: message.create as FunctionReference<'mutation'>,
    list: message.list as FunctionReference<'query'>
  },
  testauth: {
    cleanupTestData: testauth.cleanupTestData as FunctionReference<'mutation'>,
    ensureTestUser: testauth.ensureTestUser as FunctionReference<'mutation'>,
    getTestUser: testauth.getTestUser as FunctionReference<'query'>
  }
} as const

export default testApi
