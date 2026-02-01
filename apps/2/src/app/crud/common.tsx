// biome-ignore-all lint/performance/noImgElement: x
'use client'

import type { FunctionReturnType } from 'convex/server'
import type { ComponentProps } from 'react'

import { api } from '@a/cv'
import t from '@a/cv/t'
import { cn } from '@a/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@a/ui/alert-dialog'
import { Dialog, DialogContent, DialogTrigger } from '@a/ui/dialog'
import { FieldGroup } from '@a/ui/field'
import { Spinner } from '@a/ui/spinner'
import slugify from '@sindresorhus/slugify'
import { useMutation } from 'convex/react'
import { format, formatDistance } from 'date-fns'
import { Pencil, Plus, Send, Trash, UserRound } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Form, useForm } from '~/form'

import { categories, Publish } from './[id]/edit/client'

type Blog = FunctionReturnType<typeof api.blog.all>[number]

const Delete = ({ id }: { id: Blog['_id'] }) => {
    const rm = useMutation(api.blog.rm),
      [pending, go] = useTransition()
    return pending ? (
      <Spinner className='size-8' />
    ) : (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Trash className='size-8 rounded-lg stroke-1 p-1.5 group-hover:block hover:bg-destructive/10 hover:text-destructive' />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>Delete blog?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this blog, this action cannot be undone?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                go(async () => {
                  await rm({ id }).catch(() => toast.error('Failed'))
                })
              }>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  },
  Create = () => {
    const [open, setOpen] = useState(false),
      create = useMutation(api.blog.create),
      form = useForm({
        onError: () => {
          toast.error('Failed')
        },
        onSubmit: async d => {
          await create({ ...d, published: false, slug: slugify(d.title) })
        },
        onSuccess: () => {
          form.reset()
          setOpen(false)
          toast.success('Created')
        },
        schema: t.blog.omit({ published: true, slug: true }),
        values: { attachments: [], category: 'tech', content: '', coverImage: null, tags: [], title: '' }
      })
    return (
      <Dialog
        onOpenChange={v => {
          if (!form.isPending) setOpen(v)
        }}
        open={open}>
        <DialogTrigger asChild>
          <Plus className='fixed top-2 right-2 size-10 rounded-full bg-muted p-2 transition-all duration-300 hover:scale-110 hover:bg-border active:scale-75' />
        </DialogTrigger>
        <DialogContent
          className='max-h-[90%] max-w-lg overflow-auto'
          onInteractOutside={e => {
            if (form.isPending) e.preventDefault()
          }}>
          <Form
            className='flex flex-col gap-4'
            form={form}
            render={({ Arr, Choose, File, Files, Submit, Text }) => (
              <>
                <FieldGroup>
                  <Text label='Title' name='title' placeholder='My awesome post' />
                  <Choose label='Category' name='category' options={categories} placeholder='Select' />
                  <Text className='min-h-32' label='Content' multiline name='content' placeholder='Write...' />
                  <File accept='image/*' label='Cover Image' maxSize={5 * 1024 * 1024} name='coverImage' />
                  <Files
                    accept='image/*,application/pdf'
                    label='Attachments'
                    maxSize={10 * 1024 * 1024}
                    name='attachments'
                  />
                  <Arr label='Tags' name='tags' placeholder='Add tag...' transform={s => s.toLowerCase()} />
                </FieldGroup>
                <Submit className='ml-auto' Icon={Send}>
                  Create
                </Submit>
              </>
            )}
          />
        </DialogContent>
      </Dialog>
    )
  },
  Author = ({ _id: id, author, category, className, own, published, tags, updatedAt }: Blog & ComponentProps<'div'>) => (
    <div className={cn('flex items-center', className)}>
      {author?.image ? (
        <Image alt='' className='rounded-full' height={32} src={author.image} width={32} />
      ) : (
        <UserRound className='size-8 shrink-0 rounded-full bg-border stroke-1 pt-0.5 text-background' />
      )}
      <div className='mx-2'>
        <p className='text-sm'>{author?.name ?? author?.email}</p>
        <div className='flex items-center gap-1 text-xs text-muted-foreground' title={format(updatedAt, 'PPPPpp')}>
          {formatDistance(updatedAt, new Date(), { addSuffix: true })}
          <p>•</p>
          <p className='rounded-full bg-muted-foreground px-1.5 text-background capitalize'>{category}</p>
          {tags?.length ? (
            <>
              <p>•</p>
              <p>{tags.map(tag => `#${tag} `)}</p>
            </>
          ) : null}
        </div>
      </div>
      {own ? (
        <>
          <Publish className='mr-2 ml-auto' id={id} published={published} />
          <Link href={`/crud/${id}/edit`}>
            <Pencil className='size-8 rounded-lg stroke-1 p-1.5 group-hover:block hover:bg-muted' />
          </Link>
          <Delete id={id} />
        </>
      ) : null}
    </div>
  ),
  Card = ({ _id, content, coverImageUrl, title, ...rest }: Blog) => (
    <div className='group -mt-0.5 w-full rounded-xs border-2 border-transparent px-2.5 pt-2 transition-all duration-300 hover:rounded-3xl hover:border-border'>
      <Author _id={_id} content={content} coverImageUrl={coverImageUrl} title={title} {...rest} />
      <Link className='mt-1 block' href={`/crud/${_id}`}>
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={title}
            className='my-1 w-full rounded-lg object-cover'
            height={1000}
            src={coverImageUrl}
            width={1000}
          />
        ) : null}
        <p className='text-xl font-medium'>{title}</p>
        <p className='line-clamp-3 text-xs text-muted-foreground'>{content}</p>
      </Link>
      <hr className='mx-3 mt-2.5 translate-y-px transition-all duration-500 group-hover:opacity-0' />
    </div>
  ),
  List = ({ blogs }: { blogs: Blog[] }) =>
    blogs.length ? blogs.map(b => <Card key={b._id} {...b} />) : <p className='text-muted-foreground'>No posts yet</p>

export { Author, Create, List }
