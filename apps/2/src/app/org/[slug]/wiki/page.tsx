/* oxlint-disable promise/prefer-await-to-then */
'use client'

import { api } from '@a/cv'
import { Badge } from '@a/ui/badge'
import { Button } from '@a/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@a/ui/card'
import { Checkbox } from '@a/ui/checkbox'
import { Skeleton } from '@a/ui/skeleton'
import { useMutation } from 'convex/react'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'

import { useBulkSelection } from '~/hook/use-bulk-selection'
import { useOrg, useOrgQuery } from '~/hook/use-org'

const WikiPage = () => {
  const { isAdmin, org } = useOrg(),
    wikis = useOrgQuery(api.wiki.list, { paginationOpts: { cursor: null, numItems: 100 } }),
    bulkRm = useMutation(api.wiki.bulkRm),
    { clear, handleBulkDelete, selected, toggleSelect, toggleSelectAll } = useBulkSelection({
      bulkRm,
      items: wikis?.page ?? [],
      label: 'wiki page(s)',
      orgId: org._id
    })

  if (!wikis) return <Skeleton className='h-40' />

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <h1 className='text-2xl font-bold'>Wiki</h1>
          {isAdmin && selected.size > 0 ? (
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted-foreground'>{selected.size} selected</span>
              <Button onClick={handleBulkDelete} size='sm' variant='destructive'>
                Delete
              </Button>
              <Button onClick={clear} size='sm' variant='ghost'>
                Clear
              </Button>
            </div>
          ) : null}
        </div>
        <Button asChild>
          <Link href={`/org/${org.slug}/wiki/new`}>
            <Plus className='mr-2 size-4' />
            New wiki
          </Link>
        </Button>
      </div>

      {wikis.page.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center py-8 text-center'>
            <FileText className='mb-2 size-12 text-muted-foreground' />
            <p className='text-muted-foreground'>No wiki pages yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {isAdmin && wikis.page.length > 0 ? (
            <div className='flex items-center gap-2'>
              <Checkbox
                aria-label='Select all wiki pages'
                checked={selected.size === wikis.page.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className='text-sm text-muted-foreground'>Select all</span>
            </div>
          ) : null}
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {wikis.page.map(w => (
              <div className='relative' key={w._id}>
                {isAdmin ? (
                  <Checkbox
                    aria-label={`Select ${w.title}`}
                    checked={selected.has(w._id)}
                    className='absolute top-2 left-2 z-10'
                    onCheckedChange={() => toggleSelect(w._id)}
                    onClick={e => e.stopPropagation()}
                  />
                ) : null}
                <Link href={`/org/${org.slug}/wiki/${w._id}`}>
                  <Card className='transition-colors hover:bg-muted'>
                    <CardHeader className={isAdmin ? 'pl-10' : ''}>
                      <CardTitle>{w.title}</CardTitle>
                    </CardHeader>
                    <CardContent className='flex items-center gap-2'>
                      <span className='text-sm text-muted-foreground'>{w.slug}</span>
                      <Badge variant={w.status === 'published' ? 'default' : 'secondary'}>{w.status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default WikiPage
