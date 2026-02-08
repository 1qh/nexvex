'use client'
import type { ReactNode } from 'react'

import { usePathname, useSearchParams } from 'next/navigation'
import { posthog } from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
// eslint-disable-next-line no-restricted-properties
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY,
  // eslint-disable-next-line no-restricted-properties
  POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
if (typeof window !== 'undefined' && POSTHOG_KEY)
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageleave: true,
    capture_pageview: false,
    person_profiles: 'identified_only'
  })
const PostHogPageView = () => {
  const pathname = usePathname(),
    searchParams = useSearchParams()
  useEffect(() => {
    if (!(pathname && POSTHOG_KEY)) return
    let url = globalThis.origin + pathname
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const params = searchParams?.toString()
    if (params) url += `?${params}`
    posthog.capture('$pageview', {
      $current_url: url
    })
  }, [pathname, searchParams])
  return null
}
interface PostHogProviderProps {
  children: ReactNode
}
const PostHogProvider = ({ children }: PostHogProviderProps): ReactNode => {
  if (!POSTHOG_KEY) return children
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  )
}
export default PostHogProvider
