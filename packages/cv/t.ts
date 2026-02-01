import { zid } from 'convex-helpers/server/zod4'
import { array, boolean, number, object, string, enum as zenum } from 'zod/v4'

const file = zid('_storage').meta({ cv: 'file' }),
  files = array(file).meta({ cv: 'files' })

export default {
  blog: object({
    attachments: files.max(5).optional(),
    category: zenum(['tech', 'life', 'tutorial'], { error: 'Select a category' }),
    content: string().min(3, 'At least 3 characters'),
    coverImage: file.nullable().optional(),
    published: boolean(),
    slug: string()
      .min(1, 'Required')
      .regex(/^[a-z0-9-]+$/u, 'Lowercase, numbers, hyphens only'),
    tags: array(string()).max(5, 'Max 5 tags').optional(),
    title: string().min(1, 'Required')
  }),
  dbChat: object({
    title: string().min(1),
    visibility: zenum(['public', 'private']).default('private')
  }),
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
}
