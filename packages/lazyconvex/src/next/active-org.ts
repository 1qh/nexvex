'use server'
import type { FunctionReference } from 'convex/server'

import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { fetchQuery } from 'convex/nextjs'
import { cookies } from 'next/headers'

/* eslint-disable no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing */
const isTestMode = () =>
  Boolean(
    process.env.PLAYWRIGHT || process.env.NEXT_PUBLIC_PLAYWRIGHT || process.env.TEST_MODE || process.env.CONVEX_TEST_MODE
  )
/* eslint-enable no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing */

const directQuery = async (query: FunctionReference<'query'>, args: Record<string, unknown>) => {
    // eslint-disable-next-line no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing
    const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL
    if (!url) return null
    const client = new ConvexHttpClient(url)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await client.query(query, args)
    } catch {
      return null
    }
  },
  getToken = async (): Promise<string | undefined> => {
    if (isTestMode()) return
    // oxlint-disable-next-line promise/prefer-await-to-then
    const t = await convexAuthNextjsToken().catch(() => null)
    return t ?? undefined
  },
  isAuthenticated = async () => {
    if (isTestMode()) return true
    try {
      return Boolean(await convexAuthNextjsToken())
    } catch {
      return false
    }
  },
  setActiveOrgCookie = async ({ orgId, slug }: { orgId: string; slug: string }) => {
    const cookieStore = await cookies(),
      opts = { httpOnly: false, maxAge: 60 * 60 * 24 * 365, path: '/' } as const
    cookieStore.set('activeOrgId', orgId, opts)
    cookieStore.set('activeOrgSlug', slug, opts)
  },
  clearActiveOrgCookie = async () => {
    const cookieStore = await cookies()
    cookieStore.delete('activeOrgId')
    cookieStore.delete('activeOrgSlug')
  },
  getActiveOrg = async ({ query, token }: { query: FunctionReference<'query'>; token: null | string }) => {
    const cookieStore = await cookies(),
      orgId = cookieStore.get('activeOrgId')?.value
    if (!orgId) return null
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      if (token) return await fetchQuery(query, { orgId }, { token })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await directQuery(query, { orgId })
    } catch {
      cookieStore.delete('activeOrgId')
      cookieStore.delete('activeOrgSlug')
      return null
    }
  }

export { clearActiveOrgCookie, getActiveOrg, getToken, isAuthenticated, setActiveOrgCookie }
