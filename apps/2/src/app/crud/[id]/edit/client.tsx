'use client'

import type { Doc, Id } from '@a/cv/model'
import type { Preloaded } from 'convex/react'
import type { ComponentProps } from 'react'

import { api } from '@a/cv'
import t from '@a/cv/t'
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

const categories = t.blog.shape.category.options.map(c => ({ label: c.charAt(0).toUpperCase() + c.slice(1), value: c })),
  Publish = ({ className, id, published, ...props }: ComponentProps<'div'> & { id: Id<'blog'>; published: boolean }) => {
    const update = useMutation(api.blog.update),
      [pending, go] = useTransition()
    return (
      <div className={cn('flex items-center gap-2', className)} {...props}>
        <Label htmlFor='publish'>{pending ? <Spinner /> : published ? 'Published' : 'Draft'}</Label>
        <Switch
          checked={published}
          disabled={pending}
          id='publish'
          onCheckedChange={() =>
            go(async () => {
              await update({ id, published: !published })
            })
          }
        />
      </div>
    )
  },
  Edit = ({ blog }: { blog: Doc<'blog'> }) => {
    const update = useMutation(api.blog.update),
      form = useForm({
        onSubmit: async d => {
          await update({ id: blog._id, ...d })
        },
        onSuccess: () => {
          toast.success('Saved')
        },
        schema: t.blog.partial(),
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
        form={form}
        render={({ Arr, Err, File, Files, Submit, Text }) => (
          <>
            <Err error={form.error} />
            <FieldGroup className='gap-5'>
              <Text label='Title' name='title' />
              <Text className='min-h-64' label='Content' multiline name='content' />
              <File accept='image/*' label='Cover Image' maxSize={5 * 1024 * 1024} name='coverImage' />
              <Files accept='image/*,application/pdf' label='Attachments' maxSize={10 * 1024 * 1024} name='attachments' />
              <Arr label='Tags' name='tags' placeholder='Add tag...' transform={s => s.toLowerCase()} />
            </FieldGroup>
            <Submit className='ml-auto' Icon={Save}>
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
        },
        onSuccess: () => {
          toast.success('Saved')
        },
        schema: t.blog.partial(),
        values: { category: blog.category, published: blog.published, slug: blog.slug }
      })
    return (
      <Form
        className='flex flex-col gap-4'
        form={form}
        render={({ Choose, Submit, Text, Toggle }) => (
          <>
            <FieldGroup className='gap-5'>
              <Choose label='Category' name='category' options={categories} />
              <Text label='Slug' name='slug' />
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
    if (!b?.own) return <p className='text-muted-foreground'>Blog not found</p>
    return (
      <>
        <div className='mb-3 flex justify-between'>
          <Link className='rounded-lg px-3 py-2 hover:bg-muted' href={`/crud/${b._id}`}>
            &larr; Back
          </Link>
          <Popover>
            <PopoverTrigger asChild>
              <Settings className='size-8 rounded-lg stroke-1 p-1.5 group-hover:block hover:bg-muted' />
            </PopoverTrigger>
            <PopoverContent>
              <Setting blog={b} key={b._id} />
            </PopoverContent>
          </Popover>
        </div>
        <Edit blog={b} key={b._id} />
      </>
    )
  }

export { categories, Client, Publish }
