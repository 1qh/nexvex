'use client'

import { api } from '@a/cv'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@a/ui/card'
import { FieldGroup } from '@a/ui/field'
import slugify from '@sindresorhus/slugify'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { Form, useForm } from '~/form'
import { orgTeam } from '~/schema'

const NewOrgPage = () => {
  const router = useRouter(),
    create = useMutation(api.org.create),
    form = useForm({
      onSubmit: async d => {
        await create({ data: d })
        toast.success('Organization created')
        router.push(`/org/${d.slug}`)
        return d
      },
      resetOnSuccess: true,
      schema: orgTeam
    }),
    name = form.watch('name'),
    slug = form.watch('slug'),
    autoSlug = useRef(true)

  useEffect(() => {
    if (autoSlug.current) form.instance.setFieldValue('slug', slugify(name))
  }, [name, form.instance])

  return (
    <div className='container flex justify-center py-8'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>Start collaborating with your team</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            className='space-y-4'
            form={form}
            render={({ Submit, Text }) => (
              <>
                <FieldGroup>
                  <Text label='Name' name='name' placeholder='Acme Inc' />
                  <Text label='URL slug' name='slug' placeholder='acme-inc' />
                </FieldGroup>
                <p className='text-xs text-muted-foreground'>/org/{slug || 'your-slug'}</p>
                <Submit className='w-full'>Create organization</Submit>
              </>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default NewOrgPage
