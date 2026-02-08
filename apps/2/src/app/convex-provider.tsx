'use client'

import type { ReactNode } from 'react'

import { ConvexAuthNextjsProvider as AuthProvider } from '@convex-dev/auth/nextjs'
import { ConvexProvider as BaseProvider, ConvexReactClient as Client, useConvexAuth } from 'convex/react'
import { useEffect, useRef } from 'react'

import { identifyUser, resetUser } from '~/analytics'
import env from '~/env'

const client = new Client(env.NEXT_PUBLIC_CONVEX_URL, { verbose: true }),
  isTest = env.NEXT_PUBLIC_PLAYWRIGHT === '1',
  AuthTracker = () => {
    const { isAuthenticated, isLoading } = useConvexAuth(),
      wasAuthenticated = useRef(false)
    useEffect(() => {
      if (isLoading) return
      if (isAuthenticated && !wasAuthenticated.current) {
        identifyUser(crypto.randomUUID())
        wasAuthenticated.current = true
      } else if (!isAuthenticated && wasAuthenticated.current) {
        resetUser()
        wasAuthenticated.current = false
      }
    }, [isAuthenticated, isLoading])
    return null
  },
  ConvexProvider = ({ children }: { children: ReactNode }) =>
    isTest ? (
      <BaseProvider client={client}>{children}</BaseProvider>
    ) : (
      <AuthProvider client={client}>
        <AuthTracker />
        {children}
      </AuthProvider>
    )

export default ConvexProvider
