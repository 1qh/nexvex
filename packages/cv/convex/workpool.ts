import { Workpool } from '@convex-dev/workpool'
import { createWorkpoolBridge } from 'convex-durable-agents'

import { components } from './_generated/api'

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const pool = new Workpool(components.workpool, {
    defaultRetryBehavior: {
      base: 2,
      initialBackoffMs: 1000,
      maxAttempts: 3
    },
    logLevel: 'INFO',
    maxParallelism: 5,
    retryActionsByDefault: true
  }),
  { enqueueWorkpoolAction } = createWorkpoolBridge(pool)

export { enqueueWorkpoolAction, pool }
