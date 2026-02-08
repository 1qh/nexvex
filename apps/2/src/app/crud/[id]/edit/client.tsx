'use client'

import type { Doc, Id } from '@a/cv/model'
import type { Preloaded } from 'convex/react'
import type { ComponentProps } from 'react'

import { api } from '@a/cv'
import { cn } from '@a/ui'
import { FieldGroup } from '@a/ui/field'
import { Label } from '@a/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@a/ui/popover'
import { Spinner } from '@a/ui/spinner'
import { Switch } from '@a/ui/switch'
import { useMutation, usePreloadedQuery } from 'convex/react'
import { Save, Settings } from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Form, useForm } from '~/form'
import { editBlog } from '~/schema'

const Publish = ({
    className,
    id,
    published,
    ...props
  }: ComponentProps<'div'> & { id: Id<'blog'>; published: boolean }) => {
    const update = useMutation(api.blog.update),
      [pending, go] = useTransition()
    return (
      <div className={cn('flex items-center gap-2', className)} data-testid='publish-toggle' {...props}>
        <Label htmlFor='publish'>{pending ? <Spinner /> : published ? 'Published' : 'Draft'}</Label>
        <Switch
          checked={published}
          data-testid='publish-switch'
          disabled={pending}
          id='publish'
          onCheckedChange={() =>
            go(async () => {
              await update({ id, published: !published })
              toast.success(published ? 'Unpublished' : 'Published')
            })
          }
          size='default'
        />
      </div>
    )
  },
  Edit = ({ blog }: { blog: Doc<'blog'> }) => {
    const update = useMutation(api.blog.update),
      form = useForm({
        onSubmit: async d => {
          await update({ id: blog._id, ...d })
          return d
        },
        onSuccess: () => {
          toast.success('Saved')
        },
        schema: editBlog,
        values: {
          attachments: blog.attachments ?? [],
          content: blog.content,
          coverImage: blog.coverImage ?? null,
          tags: blog.tags,
          title: blog.title
        }
      })
    return (
      <Form
        className='flex flex-col gap-3'
        data-testid='edit-blog-form'
        form={form}
        render={({ Arr, Err, File, Files, Submit, Text }) => (
          <>
            <Err error={form.error} />
            <FieldGroup className='gap-5'>
              <Text data-testid='edit-title' label='Title' name='title' />
              <Text className='min-h-64' data-testid='edit-content' label='Content' multiline name='content' />
              <File
                accept='image/*'
                data-testid='edit-cover-image'
                label='Cover Image'
                maxSize={5 * 1024 * 1024}
                name='coverImage'
              />
              <Files
                accept='image/*,application/pdf'
                data-testid='edit-attachments'
                label='Attachments'
                maxSize={10 * 1024 * 1024}
                name='attachments'
              />
              <Arr
                data-testid='edit-tags'
                label='Tags'
                name='tags'
                placeholder='Add tag...'
                transform={s => s.toLowerCase()}
              />
            </FieldGroup>
            <Submit className='ml-auto' data-testid='edit-save' Icon={Save}>
              {form.isPending ? 'Saving...' : 'Save'}
            </Submit>
          </>
        )}
      />
    )
  },
  Setting = ({ blog }: { blog: Doc<'blog'> }) => {
    const update = useMutation(api.blog.update),
      form = useForm({
        onError: () => {
          toast.error('Failed')
        },
        onSubmit: async d => {
          await update({ id: blog._id, ...d })
          return d
        },
        onSuccess: () => {
          toast.success('Saved')
        },
        schema: editBlog,
        values: { category: blog.category, published: blog.published }
      })
    return (
      <Form
        className='flex flex-col gap-4'
        form={form}
        render={({ Choose, Submit, Toggle }) => (
          <>
            <FieldGroup className='gap-5'>
              <Choose label='Category' name='category' />
              <Toggle falseLabel='Draft' name='published' trueLabel='Published' />
            </FieldGroup>
            <Submit>Save</Submit>
          </>
        )}
      />
    )
  },
  Client = ({ preloaded }: { preloaded: Preloaded<typeof api.blog.read> }) => {
    const b = usePreloadedQuery(preloaded)
    if (!b?.own)
      return (
        <p className='text-muted-foreground' data-testid='blog-not-found'>
          Blog not found
        </p>
      )
    return (
      <div data-testid='edit-blog-page'>
        <div className='mb-3 flex justify-between'>
          <Link className='rounded-lg px-3 py-2 hover:bg-muted' data-testid='back-link' href={`/crud/${b._id}`}>
            &larr; Back
          </Link>
          <Popover>
            <PopoverTrigger asChild>
              <Settings
                className='size-8 rounded-lg stroke-1 p-1.5 group-hover:block hover:bg-muted'
                data-testid='settings-trigger'
              />
            </PopoverTrigger>
            <PopoverContent data-testid='settings-popover'>
              <Setting blog={b} key={b._id} />
            </PopoverContent>
          </Popover>
        </div>
        <Edit blog={b} key={b._id} />
      </div>
    )
  }

export { Client, Publish }
