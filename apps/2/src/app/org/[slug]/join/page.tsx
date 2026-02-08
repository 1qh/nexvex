'use client'

import { api } from '@a/cv'
import { Button } from '@a/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@a/ui/card'
import { Skeleton } from '@a/ui/skeleton'
import { useMutation, useQuery } from 'convex/react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import OrgAvatar from '~/components/org-avatar'
import { Form, useForm } from '~/form'
import { joinRequest } from '~/schema'
import { fail } from '~/utils'

const JoinPage = () => {
  const params = useParams(),
    router = useRouter(),
    slug = params.slug as string,
    org = useQuery(api.org.getPublic, { slug }),
    myRequest = useQuery(api.org.myJoinRequest, org ? { orgId: org._id } : 'skip'),
    membership = useQuery(api.org.membership, org ? { orgId: org._id } : 'skip'),
    cancelRequest = useMutation(api.org.cancelJoinRequest),
    requestJoin = useMutation(api.org.requestJoin),
    form = useForm({
      onSubmit: async d => {
        if (!org) return d
        await requestJoin({ message: d.message ?? undefined, orgId: org._id })
        toast.success('Join request sent')
        return d
      },
      resetOnSuccess: true,
      schema: joinRequest
    }),
    handleCancel = async () => {
      if (!myRequest) return
      try {
        await cancelRequest({ requestId: myRequest._id })
        toast.success('Request cancelled')
      } catch (error) {
        fail(error)
      }
    }

  if (org === undefined) return <Skeleton className='mx-auto h-64 max-w-md' />
  if (org === null) return <div className='text-center text-muted-foreground'>Organization not found</div>

  if (membership && !('code' in membership)) {
    router.push(`/org/${slug}`)
    return null
  }

  return (
    <div className='mx-auto max-w-md py-12'>
      <Card>
        <CardHeader className='items-center text-center'>
          <OrgAvatar org={org} size='lg' />
          <CardTitle className='mt-4'>{org.name}</CardTitle>
          <CardDescription>Request to join this organization</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {myRequest ? (
            <div className='space-y-4 text-center'>
              <p className='text-muted-foreground'>Your request is pending approval.</p>
              <Button
                onClick={() => {
                  handleCancel()
                }}
                variant='outline'>
                Cancel request
              </Button>
            </div>
          ) : (
            <Form
              className='space-y-4'
              form={form}
              render={({ Submit, Text }) => (
                <>
                  <Text multiline name='message' placeholder='Optional message to the admins...' rows={3} />
                  <Submit className='w-full'>Request to Join</Submit>
                </>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default JoinPage
