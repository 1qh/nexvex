import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const upload = mutation({ handler: async c => c.storage.generateUploadUrl() }),
  info = query({
    args: { id: v.id('_storage') },
    handler: async (c, { id }) => {
      const [meta, url] = await Promise.all([c.db.system.get(id), c.storage.getUrl(id)])
      return meta ? { ...meta, url } : null
    }
  })

export { info, upload }
