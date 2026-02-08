'use client'

import { posthog } from 'posthog-js'

const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return
    posthog.identify(userId, properties)
  },
  resetUser = () => {
    if (typeof window === 'undefined') return
    posthog.reset()
  }

export { identifyUser, resetUser }
