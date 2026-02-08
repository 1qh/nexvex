'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { cn } from '@a/ui'
import { Button } from '@a/ui/button'
import { Checkbox } from '@a/ui/checkbox'
import { FieldGroup } from '@a/ui/field'
import { Input } from '@a/ui/input'
import { Spinner } from '@a/ui/spinner'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Form, useForm } from '~/form'
import { createBlog } from '~/schema'

const TestPage = () => {
  const [storageId, setStorageId] = useState(''),
    fileInfo = useQuery(api.file.info, storageId && storageId.length > 10 ? { id: storageId as Id<'_storage'> } : 'skip'),
    myBlogs = useQuery(api.blog.all, { where: { own: true } }),
    myCount = useQuery(api.blog.count, { where: { own: true } }),
    totalCount = useQuery(api.blog.count, {}),
    publishedCount = useQuery(api.blog.count, { where: { published: true } }),
    [selected, setSelected] = useState<Set<Id<'blog'>>>(new Set()),
    bulkUpdate = useMutation(api.blog.bulkUpdate),
    bulkRm = useMutation(api.blog.bulkRm),
    create = useMutation(api.blog.create),
    [bulkPending, setBulkPending] = useState(false),
    handleBulkPublish = async (published: boolean) => {
      if (selected.size === 0) return
      setBulkPending(true)
      try {
        await bulkUpdate({ data: { published }, ids: [...selected] })
        setSelected(new Set())
        toast.success(`${published ? 'Published' : 'Unpublished'} ${selected.size} blogs`)
      } catch {
        toast.error('Bulk update failed')
      }
      setBulkPending(false)
    },
    handleBulkDelete = async () => {
      if (selected.size === 0) return
      setBulkPending(true)
      try {
        await bulkRm({ ids: [...selected] })
        setSelected(new Set())
        toast.success(`Deleted ${selected.size} blogs`)
      } catch {
        toast.error('Bulk delete failed')
      }
      setBulkPending(false)
    },
    toggleSelect = (id: Id<'blog'>) => {
      const newSet = new Set(selected)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      setSelected(newSet)
    },
    selectAll = () => {
      if (!myBlogs) return
      if (selected.size === myBlogs.length) setSelected(new Set())
      else setSelected(new Set(myBlogs.map(b => b._id)))
    },
    copyId = async (id: string) => {
      try {
        await navigator.clipboard.writeText(id)
        toast.success('ID copied')
      } catch {
        toast.error('Failed to copy')
      }
    },
    form = useForm({
      onError: () => {
        toast.error('Failed')
      },
      onSubmit: async d => {
        await create({ ...d, published: false })
        return d
      },
      onSuccess: () => {
        form.reset()
        toast.success('Created')
      },
      schema: createBlog
    })

  return (
    <div className='mx-auto flex max-w-4xl flex-col gap-6 p-4' data-testid='crud-test-page'>
      <h1 className='text-2xl font-bold'>CRUD Test Page</h1>

      <section className='rounded-lg border p-4' data-testid='counts-section'>
        <h2 className='mb-3 text-lg font-semibold'>Counts</h2>
        <div className='grid grid-cols-3 gap-4'>
          <div className='rounded-lg bg-muted p-3 text-center'>
            <p className='text-2xl font-bold' data-testid='my-count'>
              {myCount ?? <Spinner className='mx-auto' />}
            </p>
            <p className='text-sm text-muted-foreground'>My Blogs</p>
          </div>
          <div className='rounded-lg bg-muted p-3 text-center'>
            <p className='text-2xl font-bold' data-testid='total-count'>
              {totalCount ?? <Spinner className='mx-auto' />}
            </p>
            <p className='text-sm text-muted-foreground'>Total Blogs</p>
          </div>
          <div className='rounded-lg bg-muted p-3 text-center'>
            <p className='text-2xl font-bold' data-testid='published-count'>
              {publishedCount ?? <Spinner className='mx-auto' />}
            </p>
            <p className='text-sm text-muted-foreground'>Published</p>
          </div>
        </div>
      </section>

      <section className='rounded-lg border p-4' data-testid='bulk-section'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>Bulk Operations</h2>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground' data-testid='selected-count'>
              {selected.size} selected
            </span>
            <Button
              data-testid='bulk-publish'
              disabled={selected.size === 0 || bulkPending}
              // eslint-disable-next-line @typescript-eslint/strict-void-return
              onClick={async () => handleBulkPublish(true)}
              size='sm'
              variant='outline'>
              Publish
            </Button>
            <Button
              data-testid='bulk-unpublish'
              disabled={selected.size === 0 || bulkPending}
              // eslint-disable-next-line @typescript-eslint/strict-void-return
              onClick={async () => handleBulkPublish(false)}
              size='sm'
              variant='outline'>
              Unpublish
            </Button>
            <Button
              data-testid='bulk-delete'
              disabled={selected.size === 0 || bulkPending}
              // eslint-disable-next-line @typescript-eslint/strict-void-return
              onClick={async () => handleBulkDelete()}
              size='sm'
              variant='destructive'>
              Delete
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-2 border-b pb-2'>
          <Checkbox
            checked={myBlogs?.length ? selected.size === myBlogs.length : false}
            data-testid='select-all'
            onCheckedChange={selectAll}
          />
          <span className='text-sm font-medium'>Select All</span>
        </div>

        <div className='divide-y' data-testid='my-blogs-list'>
          {myBlogs === undefined ? (
            <Spinner className='m-4' />
          ) : myBlogs.length === 0 ? (
            <p className='py-4 text-muted-foreground' data-testid='no-blogs'>
              No blogs yet
            </p>
          ) : (
            myBlogs.map(b => (
              <div
                className={cn('flex items-center gap-3 py-2', selected.has(b._id) && 'bg-muted/50')}
                data-testid='my-blog-item'
                key={b._id}>
                <Checkbox
                  checked={selected.has(b._id)}
                  data-testid={`select-${b._id}`}
                  onCheckedChange={() => toggleSelect(b._id)}
                />
                <div className='min-w-0 flex-1'>
                  <p className='truncate font-medium' data-testid='blog-item-title'>
                    {b.title}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {b.published ? (
                      <span className='text-green-600' data-testid='blog-item-status'>
                        Published
                      </span>
                    ) : (
                      <span className='text-yellow-600' data-testid='blog-item-status'>
                        Draft
                      </span>
                    )}
                    <span> • </span>
                    {b.category}
                  </p>
                  <button
                    className='mt-0.5 cursor-pointer text-xs text-blue-500 hover:underline'
                    data-testid='blog-item-id'
                    // eslint-disable-next-line @typescript-eslint/strict-void-return
                    onClick={async () => copyId(b._id)}
                    type='button'>
                    {b._id}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className='rounded-lg border p-4' data-testid='file-info-section'>
        <h2 className='mb-3 text-lg font-semibold'>File Info</h2>
        <div className='mb-3 flex gap-2'>
          <Input
            data-testid='file-storage-id-input'
            onChange={e => setStorageId(e.target.value)}
            placeholder='Enter storage ID (e.g. from coverImage)'
            value={storageId}
          />
          <Button data-testid='file-storage-id-clear' onClick={() => setStorageId('')} size='sm' variant='outline'>
            Clear
          </Button>
        </div>
        {storageId && storageId.length > 10 ? (
          fileInfo === undefined ? (
            <Spinner data-testid='file-info-loading' />
          ) : fileInfo ? (
            <div className='rounded-lg bg-muted p-3' data-testid='file-info-result'>
              <p className='font-medium' data-testid='file-info-type'>
                Content Type: {fileInfo.contentType ?? 'unknown'}
              </p>
              <p className='text-sm text-muted-foreground' data-testid='file-info-size'>
                Size: {fileInfo.size ? `${Math.round(fileInfo.size / 1024)} KB` : 'unknown'}
              </p>
              {fileInfo.url ? (
                <a
                  className='mt-1 block text-sm text-blue-500 hover:underline'
                  data-testid='file-info-url'
                  href={fileInfo.url}
                  rel='noopener noreferrer'
                  target='_blank'>
                  View File
                </a>
              ) : null}
              <p className='mt-1 text-xs text-muted-foreground' data-testid='file-info-id'>
                Storage ID: {fileInfo._id}
              </p>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground' data-testid='file-info-not-found'>
              File not found
            </p>
          )
        ) : (
          <p className='text-sm text-muted-foreground' data-testid='file-info-empty'>
            Enter a valid storage ID above (upload a file first, then copy its ID)
          </p>
        )}
      </section>

      <section className='rounded-lg border p-4' data-testid='create-section'>
        <h2 className='mb-3 text-lg font-semibold'>Create Blog (with files)</h2>
        <Form
          className='flex flex-col gap-4'
          data-testid='create-form'
          form={form}
          render={({ Arr, Choose, File, Files, Submit, Text }) => (
            <>
              <FieldGroup>
                <Text data-testid='test-title' label='Title' name='title' placeholder='Test post title' />
                <Choose data-testid='test-category' label='Category' name='category' />
                <Text
                  className='min-h-20'
                  data-testid='test-content'
                  label='Content'
                  multiline
                  name='content'
                  placeholder='Content...'
                />
                <File
                  accept='image/*'
                  data-testid='test-cover-image'
                  label='Cover Image'
                  maxSize={5 * 1024 * 1024}
                  name='coverImage'
                />
                <Files
                  accept='image/*,application/pdf'
                  data-testid='test-attachments'
                  label='Attachments'
                  max={3}
                  maxSize={10 * 1024 * 1024}
                  name='attachments'
                />
                <Arr data-testid='test-tags' label='Tags' name='tags' placeholder='Add tag...' />
              </FieldGroup>
              <Submit className='ml-auto' data-testid='test-submit'>
                Create
              </Submit>
            </>
          )}
        />
      </section>
    </div>
  )
}

export default TestPage
