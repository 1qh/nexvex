'use client'

import type { ReactNode } from 'react'

import { ConvexAuthNextjsProvider as P } from '@convex-dev/auth/nextjs'
import { ConvexReactClient as Client } from 'convex/react'

import env from '~/env'

const client = new Client(env.NEXT_PUBLIC_CONVEX_URL, { verbose: true }),
  ConvexProvider = ({ children }: { children: ReactNode }) => <P client={client}>{children}</P>

export default ConvexProvider
