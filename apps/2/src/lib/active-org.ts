/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
'use server'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { fetchQuery } from 'convex/nextjs'
import { cookies } from 'next/headers'

const getActiveOrg = async (token: null | string) => {
  if (!token) return null

  const cookieStore = await cookies()
  const orgId = cookieStore.get('activeOrgId')?.value as Id<'org'> | undefined
  if (!orgId) return null

  try {
    return await fetchQuery(api.org.get, { orgId }, { token })
  } catch {
    cookieStore.delete('activeOrgId')
    cookieStore.delete('activeOrgSlug')
    return null
  }
}

const setActiveOrgCookie = async (orgId: Id<'org'>, slug: string) => {
  const cookieStore = await cookies()
  const opts = { httpOnly: false, maxAge: 60 * 60 * 24 * 365, path: '/' }
  cookieStore.set('activeOrgId', orgId, opts)
  cookieStore.set('activeOrgSlug', slug, opts)
}

const clearActiveOrgCookie = async () => {
  const cookieStore = await cookies()
  cookieStore.delete('activeOrgId')
  cookieStore.delete('activeOrgSlug')
}

export { clearActiveOrgCookie, getActiveOrg, setActiveOrgCookie }
