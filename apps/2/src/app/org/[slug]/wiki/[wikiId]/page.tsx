/* oxlint-disable promise/prefer-await-to-then */

'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { Badge } from '@a/ui/badge'
import { Button } from '@a/ui/button'
import { Skeleton } from '@a/ui/skeleton'
import { useQuery } from 'convex/react'
import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import EditorsSection from '~/components/editors-section'
import { useOrg, useOrgMutation, useOrgQuery } from '~/hook/use-org'
import { fail } from '~/utils'

const WikiDetailPage = () => {
  const params = useParams(),
    { isAdmin, org } = useOrg(),
    me = useQuery(api.user.me, {}),
    wikiId = params.wikiId as Id<'wiki'>,
    wiki = useOrgQuery(api.wiki.read, { id: wikiId }),
    members = useOrgQuery(api.org.members),
    editorsList = useOrgQuery(api.wiki.editors, { wikiId }),
    addEditorMut = useOrgMutation(api.wiki.addEditor),
    removeEditorMut = useOrgMutation(api.wiki.removeEditor)

  if (!(wiki && me && members && editorsList)) return <Skeleton className='h-40' />

  const isCreator = wiki.userId === me._id,
    isEditor = editorsList.some(e => e.userId === me._id),
    canEditWiki = isAdmin || isCreator || isEditor,
    handleAddEditor = (userId: Id<'users'>) => {
      addEditorMut({ editorId: userId, wikiId })
        .then(() => toast.success('Editor added'))
        .catch(fail)
    },
    handleRemoveEditor = (userId: Id<'users'>) => {
      removeEditorMut({ editorId: userId, wikiId })
        .then(() => toast.success('Editor removed'))
        .catch(fail)
    }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h1 className='text-2xl font-bold'>{wiki.title}</h1>
          {canEditWiki ? null : <Badge variant='secondary'>View only</Badge>}
        </div>
        {canEditWiki ? (
          <Button asChild variant='outline'>
            <Link href={`/org/${org.slug}/wiki/${wikiId}/edit`}>
              <Pencil className='mr-2 size-4' />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>
      <div className='flex items-center gap-2'>
        <span className='text-sm text-muted-foreground'>{wiki.slug}</span>
        <Badge variant={wiki.status === 'published' ? 'default' : 'secondary'}>{wiki.status}</Badge>
      </div>
      {wiki.content ? <p className='text-muted-foreground'>{wiki.content}</p> : null}

      {isAdmin ? (
        <EditorsSection
          editorsList={editorsList}
          members={members}
          onAdd={handleAddEditor}
          onRemove={handleRemoveEditor}
        />
      ) : null}
    </div>
  )
}

export default WikiDetailPage
