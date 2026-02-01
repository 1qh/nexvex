import { MINUTE, RateLimiter, SECOND } from '@convex-dev/rate-limiter'

import { components } from './_generated/api'

const limiter = new RateLimiter(components.ratelimiter, {
  chatMessage: { capacity: 5, kind: 'token bucket', period: MINUTE, rate: 20 },
  streamRequest: { capacity: 3, kind: 'token bucket', period: SECOND, rate: 2 },
  threadCreate: { kind: 'fixed window', period: MINUTE, rate: 10 }
})

export { limiter }
