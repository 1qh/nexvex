// biome-ignore-all lint/performance/noImgElement: x
'use client'

import type { FunctionReturnType } from 'convex/server'

import { api } from '@a/cv'
import { Input } from '@a/ui/input'
import { useAction } from 'convex/react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

type SearchResult = FunctionReturnType<typeof api.movie.search>[number]

const TMDB_IMG = 'https://image.tmdb.org/t/p/w200',
  MovieCard = ({ movie }: { movie: SearchResult }) => (
    <div className='flex gap-3 rounded-lg border p-3'>
      {movie.poster_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={movie.title}
          className='h-32 w-20 shrink-0 rounded-sm object-cover'
          src={`${TMDB_IMG}${movie.poster_path}`}
        />
      ) : (
        <div className='flex h-32 w-20 shrink-0 items-center justify-center rounded-sm bg-muted text-xs text-muted-foreground'>
          No image
        </div>
      )}
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <p className='font-medium'>{movie.title}</p>
        <p className='text-xs text-muted-foreground'>
          {movie.release_date.slice(0, 4)} • {movie.vote_average.toFixed(1)} • ID: {movie.tmdb_id}
        </p>
        <p className='line-clamp-2 text-sm text-muted-foreground'>{movie.overview}</p>
      </div>
    </div>
  ),
  Page = () => {
    const search = useAction(api.movie.search),
      [query, setQuery] = useState(''),
      [results, setResults] = useState<SearchResult[]>([]),
      [pending, go] = useTransition()

    return (
      <div className='mx-auto flex max-w-2xl flex-col gap-4 p-4'>
        <div className='flex items-center justify-between'>
          <h1 className='text-xl font-semibold'>Movie Search</h1>
          <Link className='text-sm text-muted-foreground hover:text-foreground' href='/movies/fetch'>
            Fetch by ID →
          </Link>
        </div>
        <form
          className='flex gap-2'
          onSubmit={e => {
            e.preventDefault()
            if (!query.trim()) return
            go(async () => setResults(await search({ query: query.trim() })))
          }}>
          <Input
            onChange={e => setQuery(e.target.value)}
            placeholder={pending ? 'Searching...' : 'Search movies...'}
            value={query}
          />
        </form>
        {results.length ? results.map(m => <MovieCard key={m.tmdb_id} movie={m} />) : null}
      </div>
    )
  }

export default Page
