/* eslint-disable no-await-in-loop */
import type { Page } from '@playwright/test'

import type { FunctionReference } from 'convex/server'

import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

let testUserEnsured = false

const getClient = () => {
    const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
    if (!convexUrl) throw new Error('CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set')
    return new ConvexHttpClient(convexUrl)
  },
  ensureTestUser = async () => {
    if (testUserEnsured) return
    const client = getClient()
    await client.mutation(anyApi.testauth?.ensureTestUser as FunctionReference<'mutation'>, {})
    testUserEnsured = true
  },
  login = async (_page: Page) => {
    await ensureTestUser()
  },
  parseApiPath = (name: string) => {
    const [module, fn] = name.split(':')
    if (!(module && fn)) throw new Error(`Invalid API path: ${name}`)
    return { fn, module }
  },
  getApiRef = (module: string, fn: string) =>
    (anyApi as Record<string, Record<string, FunctionReference<'action' | 'mutation' | 'query'>>>)[module]?.[fn],
  testConvex = {
    action: async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      await ensureTestUser()
      const client = getClient(),
        { fn, module } = parseApiPath(name),
        ref = getApiRef(module, fn)
      if (!ref) throw new Error(`API not found: ${name}`)
      return client.action(ref as FunctionReference<'action'>, args)
    },
    mutation: async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      await ensureTestUser()
      const client = getClient(),
        { fn, module } = parseApiPath(name),
        ref = getApiRef(module, fn)
      if (!ref) throw new Error(`API not found: ${name}`)
      return client.mutation(ref as FunctionReference<'mutation'>, args)
    },
    query: async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      await ensureTestUser()
      const client = getClient(),
        { fn, module } = parseApiPath(name),
        ref = getApiRef(module, fn)
      if (!ref) throw new Error(`API not found: ${name}`)
      return client.query(ref as FunctionReference<'query'>, args)
    }
  },
  cleanupTestData = async () => {
    const client = getClient()
    await ensureTestUser()
    let result = (await client.mutation(anyApi.testauth?.cleanupTestData as FunctionReference<'mutation'>, {})) as {
      count: number
      done: boolean
    }
    while (!result.done) {
      result = (await client.mutation(anyApi.testauth?.cleanupTestData as FunctionReference<'mutation'>, {})) as {
        count: number
        done: boolean
      }
    }
  }

export { cleanupTestData, ensureTestUser, login, testConvex }
