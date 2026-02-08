import type { ZodObject, ZodRawShape } from 'zod/v4'

import { zid } from 'convex-helpers/server/zod4'
import { array, boolean, number, object, string, union, enum as zenum } from 'zod/v4'

const cvFile = () => zid('_storage').meta({ cv: 'file' as const }),
  cvFiles = () => array(cvFile()).meta({ cv: 'files' as const }),
  file = cvFile(),
  files = cvFiles(),
  messagePart = union([
    object({ text: string(), type: zenum(['text']) }),
    object({ image: file, type: zenum(['image']) }),
    object({ file, name: string(), type: zenum(['file']) })
  ]),
  owned = {
    blog: object({
      attachments: files.max(5).optional(),
      category: zenum(['tech', 'life', 'tutorial'], { error: 'Select a category' }),
      content: string().min(3, 'At least 3 characters'),
      coverImage: file.nullable().optional(),
      published: boolean(),
      tags: array(string()).max(5, 'Max 5 tags').optional(),
      title: string().min(1, 'Required')
    }),
    chat: object({
      title: string().min(1)
    })
  } as const,
  child = <const P extends OwnedTable, const S extends ZodRawShape, const FK extends keyof S & string>(config: {
    foreignKey: FK
    index?: string
    parent: P
    schema: ZodObject<S>
  }): {
    foreignKey: FK
    index: string
    parent: P
    schema: ZodObject<S>
  } => ({
    ...config,
    index: config.index ?? `by_${config.parent}`
  }),
  children = {
    message: child({
      foreignKey: 'chatId',
      parent: 'chat',
      schema: object({
        chatId: zid('chat'),
        parts: array(messagePart),
        role: zenum(['user', 'assistant', 'system'])
      })
    })
  },
  base = {
    movie: object({
      backdrop_path: string().nullable(),
      budget: number().nullable(),
      genres: array(object({ id: number(), name: string() })),
      original_title: string(),
      overview: string(),
      poster_path: string().nullable(),
      release_date: string(),
      revenue: number().nullable(),
      runtime: number().nullable(),
      tagline: string().nullable(),
      title: string(),
      tmdb_id: number(),
      vote_average: number(),
      vote_count: number()
    })
  },
  org = {
    team: object({
      avatarId: zid('_storage').nullable().optional(),
      name: string().min(1),
      slug: string()
        .min(1)
        .regex(/^[a-z0-9-]+$/u)
    })
  },
  orgScoped = {
    project: object({
      description: string().optional(),
      editors: array(zid('users')).max(100).optional(),
      name: string().min(1),
      status: zenum(['active', 'archived', 'completed']).optional()
    }),
    task: object({
      assigneeId: zid('users').nullable().optional(),
      completed: boolean().optional(),
      priority: zenum(['low', 'medium', 'high']).optional(),
      projectId: zid('project'),
      title: string().min(1)
    }),
    wiki: object({
      content: string().optional(),
      editors: array(zid('users')).max(100).optional(),
      slug: string()
        .min(1)
        .regex(/^[a-z0-9-]+$/u),
      status: zenum(['draft', 'published']),
      title: string().min(1)
    })
  }

type OrgScopedTable = keyof typeof orgScoped
type OwnedTable = keyof typeof owned

export type { OrgScopedTable, OwnedTable }
export { base, children, cvFile, cvFiles, org, orgScoped, owned }
