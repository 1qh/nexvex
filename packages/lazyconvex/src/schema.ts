import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zid } from 'convex-helpers/server/zod4'
import { array, object, string } from 'zod/v4'

const cvFile = () => zid('_storage').meta({ cv: 'file' as const }),
  cvFiles = () => array(cvFile()).meta({ cv: 'files' as const }),
  child = <
    const P extends string,
    const S extends ZodRawShape,
    const FK extends keyof S & string,
    PS extends ZodRawShape = ZodRawShape
  >(config: {
    foreignKey: FK
    index?: string
    parent: P
    parentSchema?: ZodObject<PS>
    schema: ZodObject<S>
  }): {
    foreignKey: FK
    index: string
    parent: P
    parentSchema?: ZodObject<PS>
    schema: ZodObject<S>
  } => ({
    ...config,
    index: config.index ?? `by_${config.parent}`
  }),
  orgSchema = object({
    avatarId: zid('_storage').nullable().optional(),
    name: string().min(1),
    slug: string()
      .min(1)
      .regex(/^[a-z0-9-]+$/u)
  })

export { child, cvFile, cvFiles, orgSchema }
