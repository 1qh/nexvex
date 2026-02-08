'use client'

import type { Doc, Id } from '@a/cv/model'

import { api } from '@a/cv'
import { useQuery } from 'convex/react'
import { useCallback, useState } from 'react'

const ACTIVE_ORG_REGEX = /activeOrgId=(?<id>[^;]+)/u,
  getActiveOrgIdFromCookie = (): Id<'org'> | null => {
    if (typeof document === 'undefined') return null
    const match = ACTIVE_ORG_REGEX.exec(document.cookie)
    return match?.groups?.id ? (match.groups.id as Id<'org'>) : null
  },
  setActiveOrgCookieClient = (orgId: Id<'org'>, slug: string) => {
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `activeOrgId=${orgId}; path=/; max-age=${maxAge}`
    document.cookie = `activeOrgSlug=${slug}; path=/; max-age=${maxAge}`
  },
  useActiveOrg = () => {
    const [activeOrgId, setActiveOrgId] = useState<Id<'org'> | null>(getActiveOrgIdFromCookie),
      activeOrg = useQuery(api.org.get, activeOrgId ? { orgId: activeOrgId } : 'skip'),
      setActiveOrg = useCallback((org: Doc<'org'>) => {
        setActiveOrgCookieClient(org._id, org.slug)
        setActiveOrgId(org._id)
      }, []),
      clearActiveOrg = useCallback(() => {
        document.cookie = 'activeOrgId=; path=/; max-age=0'
        document.cookie = 'activeOrgSlug=; path=/; max-age=0'
        setActiveOrgId(null)
      }, [])

    return {
      activeOrg: activeOrg ?? null,
      activeOrgId,
      clearActiveOrg,
      isLoading: activeOrgId ? activeOrg === undefined : false,
      setActiveOrg
    }
  }

export { setActiveOrgCookieClient, useActiveOrg }
