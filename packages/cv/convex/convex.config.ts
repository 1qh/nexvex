import agent from '@convex-dev/agent/convex.config'
import persistentTextStreaming from '@convex-dev/persistent-text-streaming/convex.config'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import workpool from '@convex-dev/workpool/convex.config'
import durableAgents from 'convex-durable-agents/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(agent, { name: 'a1' })
app.use(durableAgents, { name: 'durable' })
app.use(persistentTextStreaming, { name: 'streaming' })
app.use(rateLimiter, { name: 'ratelimiter' })
app.use(workpool, { name: 'workpool' })

export default app
