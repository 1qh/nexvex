/* oxlint-disable promise/prefer-await-to-then, promise/always-return */
/* eslint-disable no-alert */
'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { orgScoped } from '@a/cv/t'
import { pickValues } from '@a/cv/zod'
import { Button } from '@a/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@a/ui/card'
import { FieldGroup } from '@a/ui/field'
import { Skeleton } from '@a/ui/skeleton'
import { useQuery } from 'convex/react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import PermissionGuard from '~/components/permission-guard'
import { Form, useFormMutation } from '~/form'
import { useOrg, useOrgMutation, useOrgQuery } from '~/hook/use-org'
import { fail } from '~/utils'

const EditWikiForm = ({ wikiId }: { wikiId: Id<'wiki'> }) => {
    const router = useRouter(),
      { org } = useOrg(),
      wiki = useOrgQuery(api.wiki.read, { id: wikiId }),
      remove = useOrgMutation(api.wiki.rm),
      form = useFormMutation({
        mutation: api.wiki.update,
        onSuccess: () => {
          toast.success('Wiki page updated')
          router.push(`/org/${org.slug}/wiki`)
        },
        resetOnSuccess: true,
        schema: orgScoped.wiki,
        transform: d => ({ ...d, id: wikiId, orgId: org._id }),
        values: wiki ? pickValues(orgScoped.wiki, wiki) : undefined
      }),
      handleDelete = () => {
        /** biome-ignore lint/suspicious/noAlert: demo page uses native confirm */
        if (!confirm('Delete this wiki page?')) return
        remove({ id: wikiId })
          .then(() => {
            toast.success('Wiki page deleted')
            router.push(`/org/${org.slug}/wiki`)
          })
          .catch(fail)
      }

    if (!wiki) return <Skeleton className='h-40' />

    return (
      <Form
        className='space-y-4'
        form={form}
        render={({ Choose, Submit, Text }) => (
          <>
            <FieldGroup>
              <Text label='Title' name='title' placeholder='Page title' />
              <Text label='Slug' name='slug' placeholder='my-wiki-page' />
              <Text label='Content' multiline name='content' />
              <Choose label='Status' name='status' />
            </FieldGroup>
            <div className='flex gap-2'>
              <Submit className='flex-1'>Save changes</Submit>
              <Button onClick={handleDelete} type='button' variant='destructive'>
                Delete
              </Button>
            </div>
          </>
        )}
      />
    )
  },
  EditWikiPage = () => {
    const params = useParams(),
      { isAdmin, org } = useOrg(),
      me = useQuery(api.user.me, {}),
      wikiId = params.wikiId as Id<'wiki'>,
      wiki = useOrgQuery(api.wiki.read, { id: wikiId }),
      editorsList = useOrgQuery(api.wiki.editors, { wikiId })

    if (!(wiki && me && editorsList)) return <Skeleton className='h-40' />

    const isCreator = wiki.userId === me._id,
      isEditor = editorsList.some(e => e.userId === me._id),
      canEditWiki = isAdmin || isCreator || isEditor

    return (
      <PermissionGuard
        backHref={`/org/${org.slug}/wiki/${wikiId}`}
        backLabel='wiki page'
        canAccess={canEditWiki}
        resource='wiki page'>
        <div className='flex justify-center'>
          <Card className='w-full max-w-md'>
            <CardHeader>
              <CardTitle>Edit wiki page</CardTitle>
            </CardHeader>
            <CardContent>
              <EditWikiForm wikiId={wikiId} />
            </CardContent>
          </Card>
        </div>
      </PermissionGuard>
    )
  }

export default EditWikiPage
