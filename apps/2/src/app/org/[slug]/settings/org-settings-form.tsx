'use client'

import type { Doc } from '@a/cv/model'

import { api } from '@a/cv'
import { pickValues } from '@a/cv/zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@a/ui/card'
import { FieldGroup } from '@a/ui/field'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Form, useForm } from '~/form'
import { orgTeam } from '~/schema'

interface OrgSettingsFormProps {
  org: Doc<'org'>
}

const OrgSettingsForm = ({ org: o }: OrgSettingsFormProps) => {
  const router = useRouter(),
    update = useMutation(api.org.update),
    form = useForm({
      onSubmit: async d => {
        await update({ data: d, orgId: o._id })
        toast.success('Settings updated')
        if (d.slug !== o.slug) router.push(`/org/${d.slug}/settings`)
        return d
      },
      schema: orgTeam,
      values: pickValues(orgTeam, o)
    }),
    slug = form.watch('slug')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization settings</CardTitle>
        <CardDescription>Update your organization details</CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          className='space-y-4'
          form={form}
          render={({ Submit, Text }) => (
            <>
              <FieldGroup>
                <Text label='Name' name='name' />
                <Text label='Slug' name='slug' />
              </FieldGroup>
              <p className='text-xs text-muted-foreground'>URL: /org/{slug}</p>
              <Submit>Save changes</Submit>
            </>
          )}
        />
      </CardContent>
    </Card>
  )
}

export default OrgSettingsForm
