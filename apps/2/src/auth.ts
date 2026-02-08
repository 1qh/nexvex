import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'

// eslint-disable-next-line no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing
const isTest = Boolean(process.env.PLAYWRIGHT || process.env.TEST_MODE),
  getToken = async () => (isTest ? undefined : convexAuthNextjsToken()),
  isAuthenticated = async () => isTest || Boolean(await convexAuthNextjsToken())

export { getToken, isAuthenticated }
