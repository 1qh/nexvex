import type { output } from 'zod/v4'

import { v } from 'convex/values'
import ky from 'ky'

import env from '../env'
import { cache } from '../f'
import t from '../t'
import { action } from './_generated/server'

type TmdbMovie = Omit<output<typeof t.movie>, 'tmdb_id'> & { id: number }

const apiKey = env.TMDB_KEY,
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  tmdb = (path: string, params: Record<string, unknown>) =>
    ky.get(`https://api.themoviedb.org/3${path}`, { searchParams: { api_key: apiKey, ...params } }),
  c = cache({
    fetcher: async (_, tmdbId) => {
      const { id, ...rest } = await tmdb(`/movie/${tmdbId}`, {}).json<TmdbMovie>()
      return { ...rest, tmdb_id: id }
    },
    key: 'tmdb_id',
    schema: t.movie,
    table: 'movie'
  }),
  search = action({
    args: { query: v.string() },
    handler: async (_, { query }) => {
      const res = await tmdb('/search/movie', { query }).json<{ results: TmdbMovie[] }>()
      return res.results.map(({ id, ...rest }) => ({ ...rest, tmdb_id: id }))
    }
  }),
  { all, create, get, getInternal, invalidate, list, load, purge, read, refresh, rm, set, update } = c

export { all, create, get, getInternal, invalidate, list, load, purge, read, refresh, rm, search, set, update }
