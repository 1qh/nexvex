'use client'

import type { Doc, Id } from '@a/cv/model'
import type { FunctionReturnType } from 'convex/server'

import { api } from '@a/cv'
import { Button } from '@a/ui/button'
import { Input } from '@a/ui/input'
import { Spinner } from '@a/ui/spinner'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Movie = FunctionReturnType<typeof api.movie.load>

// eslint-disable-next-line complexity
const TestPage = () => {
  const [tmdbId, setTmdbId] = useState('27205'),
    [movie, setMovie] = useState<Movie | null>(null),
    [cacheKey, setCacheKey] = useState<null | number>(null),
    [docId, setDocId] = useState(''),
    [updateTitle, setUpdateTitle] = useState(''),
    load = useAction(api.movie.load),
    refresh = useAction(api.movie.refresh),
    invalidate = useMutation(api.movie.invalidate),
    purge = useMutation(api.movie.purge),
    rm = useMutation(api.movie.rm),
    update = useMutation(api.movie.update),
    cachedMovie = useQuery(api.movie.get, cacheKey ? { tmdb_id: cacheKey } : 'skip'),
    readResult = useQuery(api.movie.read, docId && docId.length > 10 ? { id: docId as Id<'movie'> } : 'skip'),
    allCached = useQuery(api.movie.all, {}),
    [pending, go] = useTransition(),
    handleLoad = () => {
      const id = Number(tmdbId)
      if (!id || id < 1) {
        toast.error('Enter a valid TMDB ID')
        return
      }
      go(async () => {
        try {
          const res = await load({ tmdb_id: id })
          setMovie(res)
          setCacheKey(id)
          toast.success(res.cacheHit ? 'Loaded from cache' : 'Fetched from API')
        } catch {
          toast.error('Failed to load movie')
          setMovie(null)
        }
      })
    },
    handleRefresh = () => {
      const id = Number(tmdbId)
      if (!id || id < 1) return
      go(async () => {
        try {
          const res = (await refresh({ tmdb_id: id } as never)) as Movie
          setMovie(res)
          setCacheKey(id)
          toast.success('Refreshed from API')
        } catch {
          toast.error('Failed to refresh')
        }
      })
    },
    handleInvalidate = () => {
      const id = Number(tmdbId)
      if (!id || id < 1) return
      go(async () => {
        try {
          await invalidate({ tmdb_id: id })
          setCacheKey(null)
          setMovie(null)
          toast.success('Cache invalidated')
        } catch {
          toast.error('Failed to invalidate')
        }
      })
    },
    handlePurge = () => {
      go(async () => {
        try {
          await purge({})
          setCacheKey(null)
          setMovie(null)
          toast.success('All expired entries purged')
        } catch {
          toast.error('Failed to purge')
        }
      })
    },
    handleRm = () => {
      if (!docId || docId.length <= 10) {
        toast.error('Enter a valid document ID')
        return
      }
      go(async () => {
        try {
          await rm({ id: docId as Id<'movie'> })
          setDocId('')
          toast.success('Deleted from cache')
        } catch {
          toast.error('Failed to delete')
        }
      })
    },
    handleUpdate = () => {
      if (!docId || docId.length <= 10) {
        toast.error('Enter a valid document ID')
        return
      }
      if (!updateTitle.trim()) {
        toast.error('Enter a new title')
        return
      }
      go(async () => {
        try {
          await update({ id: docId as Id<'movie'>, title: updateTitle.trim() })
          setUpdateTitle('')
          toast.success('Updated cache entry')
        } catch {
          toast.error('Failed to update')
        }
      })
    },
    copyId = async (id: string) => {
      try {
        await navigator.clipboard.writeText(id)
        toast.success('ID copied')
      } catch {
        toast.error('Failed to copy')
      }
    }

  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-6 p-4' data-testid='movie-cache-test-page'>
      <h1 className='text-2xl font-bold'>Movie Cache Test Page</h1>

      <section className='rounded-lg border p-4' data-testid='cache-stats-section'>
        <h2 className='mb-3 text-lg font-semibold'>Cache Stats</h2>
        <div className='rounded-lg bg-muted p-3'>
          <p className='text-2xl font-bold' data-testid='cached-count'>
            {allCached === undefined ? <Spinner className='mx-auto' /> : allCached.length}
          </p>
          <p className='text-sm text-muted-foreground'>Cached Movies</p>
        </div>
      </section>

      <section className='rounded-lg border p-4' data-testid='cache-operations-section'>
        <h2 className='mb-3 text-lg font-semibold'>Cache Operations (by TMDB ID)</h2>

        <div className='mb-4 flex gap-2'>
          <Input
            data-testid='cache-tmdb-input'
            onChange={e => setTmdbId(e.target.value)}
            placeholder='TMDB ID (e.g. 27205)'
            value={tmdbId}
          />
        </div>

        <div className='mb-4 flex flex-wrap gap-2'>
          <Button data-testid='cache-load' disabled={pending} onClick={handleLoad}>
            {pending ? <Spinner /> : 'Load'}
          </Button>
          <Button data-testid='cache-refresh' disabled={pending} onClick={handleRefresh} variant='outline'>
            Refresh
          </Button>
          <Button data-testid='cache-invalidate' disabled={pending} onClick={handleInvalidate} variant='outline'>
            Invalidate
          </Button>
          <Button data-testid='cache-purge' disabled={pending} onClick={handlePurge} variant='destructive'>
            Purge All Expired
          </Button>
        </div>

        <p className='mb-2 text-xs text-muted-foreground'>
          Try: 27205 (Inception), 550 (Fight Club), 680 (Pulp Fiction), 155 (The Dark Knight)
        </p>

        {movie ? (
          <div className='rounded-lg bg-muted p-4' data-testid='cache-movie-result'>
            <div className='mb-2 flex items-center gap-2'>
              <span className={movie.cacheHit ? 'text-green-600' : 'text-yellow-600'} data-testid='cache-hit-indicator'>
                {movie.cacheHit ? 'Cache Hit' : 'Cache Miss'}
              </span>
            </div>
            <p className='font-medium' data-testid='cache-movie-title'>
              {movie.title}
            </p>
            <p className='text-sm text-muted-foreground' data-testid='cache-movie-id'>
              TMDB ID: {movie.tmdb_id}
            </p>
          </div>
        ) : null}

        {cachedMovie ? (
          <div className='mt-4 rounded-lg border p-3' data-testid='cached-movie-query'>
            <p className='text-sm font-medium'>Cached Query Result:</p>
            <p className='text-xs text-muted-foreground'>{cachedMovie.title}</p>
          </div>
        ) : cacheKey ? (
          <p className='mt-4 text-sm text-muted-foreground' data-testid='no-cached-movie'>
            No cached data for TMDB ID: {cacheKey}
          </p>
        ) : null}
      </section>

      <section className='rounded-lg border p-4' data-testid='doc-operations-section'>
        <h2 className='mb-3 text-lg font-semibold'>Document Operations (by Doc ID)</h2>

        <div className='mb-4 flex gap-2'>
          <Input
            data-testid='cache-doc-input'
            onChange={e => setDocId(e.target.value)}
            placeholder='Document ID (click ID below to copy)'
            value={docId}
          />
          <Button data-testid='cache-doc-clear' onClick={() => setDocId('')} size='sm' variant='outline'>
            Clear
          </Button>
        </div>

        {docId && docId.length > 10 ? (
          readResult === undefined ? (
            <Spinner data-testid='read-loading' />
          ) : readResult ? (
            <div className='mb-4 rounded-lg bg-muted p-3' data-testid='read-result'>
              <p className='text-sm font-medium'>Read Result:</p>
              <p className='font-medium' data-testid='read-title'>
                {readResult.title}
              </p>
              <p className='text-xs text-muted-foreground' data-testid='read-tmdb-id'>
                TMDB ID: {readResult.tmdb_id}
              </p>
              <p className='text-xs text-muted-foreground' data-testid='read-doc-id'>
                Doc ID: {readResult._id}
              </p>
            </div>
          ) : (
            <p className='mb-4 text-sm text-muted-foreground' data-testid='read-not-found'>
              Document not found
            </p>
          )
        ) : (
          <p className='mb-4 text-sm text-muted-foreground' data-testid='read-empty'>
            Enter a document ID above (click an ID below to copy)
          </p>
        )}

        <div className='mb-4 flex gap-2'>
          <Input
            data-testid='cache-update-title'
            onChange={e => setUpdateTitle(e.target.value)}
            placeholder='New title for update'
            value={updateTitle}
          />
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button
            data-testid='cache-doc-update'
            disabled={pending || !docId || docId.length <= 10 || !updateTitle.trim()}
            onClick={handleUpdate}
            variant='outline'>
            Update Title
          </Button>
          <Button
            data-testid='cache-doc-rm'
            disabled={pending || !docId || docId.length <= 10}
            onClick={handleRm}
            variant='destructive'>
            Delete
          </Button>
        </div>
      </section>

      <section className='rounded-lg border p-4' data-testid='cached-list-section'>
        <h2 className='mb-3 text-lg font-semibold'>All Cached Movies</h2>
        {allCached === undefined ? (
          <Spinner />
        ) : allCached.length === 0 ? (
          <p className='text-muted-foreground' data-testid='no-cached-movies'>
            No cached movies
          </p>
        ) : (
          <div className='divide-y' data-testid='cached-movies-list'>
            {allCached.map((m: Doc<'movie'>) => (
              <div className='py-2' data-testid='cached-movie-item' key={m._id}>
                <p className='font-medium' data-testid='cached-item-title'>
                  {m.title}
                </p>
                <p className='text-xs text-muted-foreground'>TMDB: {m.tmdb_id}</p>
                <button
                  className='cursor-pointer text-xs text-blue-500 hover:underline'
                  data-testid='cached-item-doc-id'
                  // eslint-disable-next-line @typescript-eslint/strict-void-return, @typescript-eslint/no-misused-promises
                  onClick={async () => copyId(m._id)}
                  type='button'>
                  {m._id}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default TestPage
