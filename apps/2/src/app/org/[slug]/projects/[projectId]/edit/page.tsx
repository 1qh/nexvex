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

const EditProjectForm = ({ projectId, taskCount }: { projectId: Id<'project'>; taskCount: number }) => {
    const router = useRouter(),
      { org } = useOrg(),
      project = useOrgQuery(api.project.read, { id: projectId }),
      remove = useOrgMutation(api.project.rm),
      form = useFormMutation({
        mutation: api.project.update,
        onSuccess: () => {
          toast.success('Project updated')
          router.push(`/org/${org.slug}/projects/${projectId}`)
        },
        resetOnSuccess: true,
        schema: orgScoped.project,
        transform: d => ({ ...d, id: projectId, orgId: org._id }),
        values: project ? pickValues(orgScoped.project, project) : undefined
      }),
      handleDelete = () => {
        const msg =
          taskCount > 0
            ? `Delete this project and ${taskCount} task${taskCount === 1 ? '' : 's'}?`
            : 'Delete this project?'
        /** biome-ignore lint/suspicious/noAlert: demo page uses native confirm */
        if (!confirm(msg)) return
        remove({ id: projectId })
          .then(() => {
            toast.success('Project deleted')
            router.push(`/org/${org.slug}/projects`)
          })
          .catch(fail)
      }

    if (!project) return <Skeleton className='h-40' />

    return (
      <Form
        className='space-y-4'
        form={form}
        render={({ Choose, Submit, Text }) => (
          <>
            <FieldGroup>
              <Text label='Name' name='name' placeholder='Project name' />
              <Text label='Description' multiline name='description' />
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
  EditProjectPage = () => {
    const params = useParams(),
      { isAdmin, org } = useOrg(),
      me = useQuery(api.user.me, {}),
      projectId = params.projectId as Id<'project'>,
      project = useOrgQuery(api.project.read, { id: projectId }),
      tasks = useOrgQuery(api.task.byProject, { projectId }),
      editorsList = useOrgQuery(api.project.editors, { projectId })

    if (!(project && tasks !== undefined && me && editorsList)) return <Skeleton className='h-40' />

    const isCreator = project.userId === me._id,
      isEditor = editorsList.some(e => e.userId === me._id),
      canEditProject = isAdmin || isCreator || isEditor

    return (
      <PermissionGuard
        backHref={`/org/${org.slug}/projects/${projectId}`}
        backLabel='project'
        canAccess={canEditProject}
        resource='project'>
        <div className='flex justify-center'>
          <Card className='w-full max-w-md'>
            <CardHeader>
              <CardTitle>Edit project</CardTitle>
            </CardHeader>
            <CardContent>
              <EditProjectForm projectId={projectId} taskCount={tasks.length} />
            </CardContent>
          </Card>
        </div>
      </PermissionGuard>
    )
  }

export default EditProjectPage
