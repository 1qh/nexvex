// biome-ignore-all lint/performance/noImgElement: x
'use client'

import type { api } from '@a/cv'
import type { Preloaded } from 'convex/react'

import { usePreloadedQuery } from 'convex/react'
import Link from 'next/link'

import { Author } from '../common'

const Client = ({ preloaded }: { preloaded: Preloaded<typeof api.blog.read> }) => {
  const b = usePreloadedQuery(preloaded)
  if (!b) return <p className='text-muted-foreground'>Blog not found</p>
  if (!(b.own || b.published)) return <p className='text-muted-foreground'>Blog not published</p>
  return (
    <>
      <Author {...b} />
      {b.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt='' className='mt-3 w-full rounded-lg object-cover' height={1000} src={b.coverImageUrl} width={1000} />
      ) : null}
      <p className='mt-2 text-3xl font-bold'>{b.title}</p>
      <p className='whitespace-pre-line'>{b.content.trim()}</p>
      <div className='flex flex-col'>
        {b.attachmentsUrls?.map(
          url =>
            url && (
              <Link
                className='hover:text-blue-500 hover:underline'
                href={url}
                key={url}
                rel='noopener noreferrer'
                target='_blank'>
                {url}
              </Link>
            )
        )}
      </div>
    </>
  )
}

export default Client
