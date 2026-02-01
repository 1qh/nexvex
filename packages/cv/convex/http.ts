import { httpRouter } from 'convex/server'

import { auth } from './auth'
import { streamHttpAction } from './httpstream'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  handler: streamHttpAction,
  method: 'POST',
  path: '/stream'
})

export default http
