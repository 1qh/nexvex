// oxlint-disable promise/prefer-await-to-then
/* eslint-disable max-statements, @typescript-eslint/no-unsafe-assignment, no-await-in-loop, complexity */
// biome-ignore-all lint/performance/noImgElement: x
// biome-ignore-all lint/performance/noAwaitInLoops: x
// biome-ignore-all lint/nursery/noContinue: x
// biome-ignore-all lint/suspicious/noExplicitAny: x
'use client'
import type { Id } from '@a/cv/model'
import type { ZodInternalDef } from '@a/cv/zod'
import type { FormValidateOrFn } from '@tanstack/form-core'
import type { AnyFieldApi, ReactFormExtendedApi } from '@tanstack/react-form'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import type { ZodObject, ZodRawShape } from 'zod/v4'

import { api } from '@a/cv'
import { cvFileKindOf, elementOf, isArrayType, isBooleanType, isNumberType, isStringType, unwrapZod } from '@a/cv/zod'
import { cn } from '@a/ui'
import { Button } from '@a/ui/button'
import { Field, FieldError, FieldLabel } from '@a/ui/field'
import { Input } from '@a/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@a/ui/select'
import { Spinner } from '@a/ui/spinner'
import { Switch } from '@a/ui/switch'
import { Textarea } from '@a/ui/textarea'
import imageCompression from 'browser-image-compression'
import { useQuery } from 'convex/react'
import { FileIcon, ImageIcon, Upload, X } from 'lucide-react'
import { createContext, use, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import useUpload from './use-upload'

type Api<T extends Record<string, unknown>> = ReactFormExtendedApi<
  T,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  FormValidateOrFn<T>,
  undefined,
  undefined,
  undefined,
  undefined,
  unknown
>
type FieldKind = 'boolean' | 'file' | 'files' | 'number' | 'string' | 'stringArray' | 'unknown'
interface FieldMeta {
  kind: FieldKind
  max?: number
}
type FieldMetaMap = Record<string, FieldMeta>
interface ZodCheck {
  _zod?: { def?: { check?: string; maximum?: number } }
}

const getMax = (d?: ZodInternalDef): number | undefined => {
    const checks = d?.checks as (undefined | ZodCheck)[] | undefined
    if (checks)
      for (const c of checks)
        if (c?._zod?.def?.check === 'max_length' && c._zod.def.maximum !== undefined) return c._zod.def.maximum
  },
  getMeta = (s: unknown): FieldMeta => {
    const { def, schema: base, type } = unwrapZod(s),
      fk = cvFileKindOf(s)
    if (fk === 'file') return { kind: 'file' }
    if (fk === 'files') return { kind: 'files', max: getMax(def) }
    if (isArrayType(type)) {
      const el = unwrapZod(elementOf(base, def))
      return { kind: isStringType(el.type) ? 'stringArray' : 'unknown', max: getMax(def) }
    }
    if (isStringType(type)) return { kind: 'string' }
    if (isNumberType(type)) return { kind: 'number' }
    if (isBooleanType(type)) return { kind: 'boolean' }
    return { kind: 'unknown' }
  },
  buildMeta = (s: ZodObject<ZodRawShape>): FieldMetaMap => {
    const m: FieldMetaMap = {}
    // biome-ignore lint/nursery/noForIn: x
    for (const k in s.shape) if (Object.hasOwn(s.shape, k)) m[k] = getMeta(s.shape[k])
    return m
  },
  FormContext = createContext<null | {
    form: Api<Record<string, unknown>>
    meta: FieldMetaMap
    schema: ZodObject<ZodRawShape>
  }>(null),
  useFCtx = () => {
    const c = use(FormContext)
    if (!c) throw new Error('Field must be inside <Form>')
    return c
  },
  fmt = (n: number) =>
    n < 1024 ? `${n} B` : n < 1_048_576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1_048_576).toFixed(1)} MB`,
  isImg = (t: string) => t.startsWith('image/'),
  parseAccept = (a?: string): Record<string, string[]> | undefined =>
    a ? Object.fromEntries(a.split(',').map(t => [t.trim(), []])) : undefined,
  compress = async (f: File, on: boolean) =>
    on && f.type.startsWith('image/')
      ? imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }).catch(() => f)
      : f,
  Preview = ({ id, onRemove }: { id: Id<'_storage'>; onRemove?: () => void }) => {
    const d = useQuery(api.file.info, { id })
    if (!d) return <p className='size-16 animate-pulse rounded-lg bg-muted' />
    return (
      <div className='relative'>
        {d.contentType && isImg(d.contentType) && d.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt='' className='size-16 rounded-lg object-cover' height={64} src={d.url} width={64} />
        ) : (
          <div className='flex size-16 flex-col items-center justify-center rounded-lg bg-muted text-xs'>
            <FileIcon className='size-6 text-muted-foreground' />
            <span className='mt-1'>{fmt(d.size)}</span>
          </div>
        )}
        {onRemove ? (
          <button
            className='absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white transition-transform hover:scale-110'
            onClick={onRemove}
            type='button'>
            <X className='size-3' />
          </button>
        ) : null}
      </div>
    )
  },
  Progress = ({ v }: { v: number }) => (
    <div className='flex flex-col items-center'>
      <div className='mb-2 h-2 w-32 overflow-hidden rounded-full bg-muted'>
        <div className='h-full bg-primary transition-all' style={{ width: `${v}%` }} />
      </div>
      <span className='text-sm text-muted-foreground'>{v}%</span>
    </div>
  ),
  FileField = ({
    accept,
    className,
    compressImg = true,
    disabled,
    field: f,
    label,
    max,
    maxSize,
    multiple
  }: {
    accept?: string
    className?: string
    compressImg?: boolean
    disabled?: boolean
    field: AnyFieldApi
    label?: string
    max?: number
    maxSize?: number
    multiple?: boolean
  }) => {
    const raw = f.state.value,
      vals = multiple ? ((raw ?? []) as Id<'_storage'>[]) : raw ? [raw as Id<'_storage'>] : [],
      inv = f.state.meta.isTouched && !f.state.meta.isValid,
      canAdd = multiple ? !max || vals.length < max : !vals.length,
      { isUploading, progress, reset, upload } = useUpload(),
      onDrop = useCallback(
        async (accepted: File[]) => {
          if (multiple && max && vals.length + accepted.length > max) return toast.error(`Max ${max}`)
          const ids: Id<'_storage'>[] = []
          for (const file of accepted) {
            const res = await upload(await compress(file, compressImg))
            if (res.ok) ids.push(res.storageId)
            else if (res.code === 'HTTP') toast.error(`${file.name}: Upload failed (${res.status})`)
            else if (res.code === 'ABORTED') toast.error(`${file.name}: Upload canceled`)
            else if (res.code === 'NETWORK') toast.error(`${file.name}: Network error`)
            else if (res.code === 'INVALID_RESPONSE') toast.error(`${file.name}: Invalid response`)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            else if (res.code === 'URL') toast.error(`${file.name}: Failed to start upload`)
          }
          if (multiple) f.handleChange([...vals, ...ids])
          else if (ids[0]) f.handleChange(ids[0])
        },
        [compressImg, f, max, multiple, upload, vals]
      ),
      { getInputProps, getRootProps, isDragActive } = useDropzone({
        accept: parseAccept(accept),
        disabled: disabled ?? (isUploading || !canAdd),
        maxSize,
        multiple: Boolean(multiple),
        // eslint-disable-next-line @typescript-eslint/strict-void-return, @typescript-eslint/no-misused-promises
        onDrop,
        onDropRejected: r => {
          const code = r[0]?.errors[0]?.code
          if (code === 'file-too-large' && maxSize) toast.error(`Max ${fmt(maxSize)}`)
          else if (code === 'file-invalid-type') toast.error('Invalid type')
          else if (code === 'too-many-files' && max) toast.error(`Max ${max}`)
        }
      }),
      dropCls = cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
        multiple ? 'size-16' : 'p-6',
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
        (disabled ?? isUploading) && 'cursor-not-allowed opacity-50',
        className
      )
    return (
      <Field data-invalid={inv}>
        {label ? (
          <FieldLabel htmlFor={f.name}>
            {label}
            {multiple && max ? (
              <span className='text-muted-foreground'>
                {' '}
                ({vals.length}/{max})
              </span>
            ) : null}
          </FieldLabel>
        ) : null}
        {multiple ? (
          <div className='flex flex-wrap gap-2'>
            {vals.map((id, i) => (
              <Preview id={id} key={id} onRemove={() => f.handleChange(vals.filter((_, j) => j !== i))} />
            ))}
            {canAdd ? (
              <div {...getRootProps()} className={dropCls}>
                <input {...getInputProps()} />
                {isUploading ? (
                  <span className='text-xs'>{progress}%</span>
                ) : (
                  <Upload className='size-5 text-muted-foreground' />
                )}
              </div>
            ) : null}
          </div>
        ) : vals[0] ? (
          <Preview
            id={vals[0]}
            onRemove={() => {
              f.handleChange(null)
              reset()
            }}
          />
        ) : (
          <div {...getRootProps()} className={dropCls}>
            <input {...getInputProps()} />
            {isUploading ? (
              <Progress v={progress} />
            ) : (
              <>
                {accept?.includes('image') ? (
                  <ImageIcon className='mb-2 size-8 text-muted-foreground' />
                ) : (
                  <Upload className='mb-2 size-8 text-muted-foreground' />
                )}
                <span className='text-sm text-muted-foreground'>Click or drag</span>
                {maxSize ? <span className='mt-1 text-xs text-muted-foreground'>Max {fmt(maxSize)}</span> : null}
              </>
            )}
          </div>
        )}
        {inv ? <FieldError errors={f.state.meta.errors} /> : null}
      </Field>
    )
  },
  useField = (name: string, kind: FieldKind) => {
    const { form, meta } = useFCtx(),
      info = meta[name]
    if (!info) throw new Error(`Unknown field: ${name}`)
    if (info.kind !== kind) throw new Error(`Field ${name} is not ${kind}`)
    return { form, info }
  },
  fields = {
    Arr: ({
      className,
      disabled,
      inputClassName,
      label,
      name,
      placeholder,
      tagClassName,
      transform
    }: {
      className?: string
      disabled?: boolean
      inputClassName?: string
      label?: string
      name: string
      placeholder?: string
      tagClassName?: string
      transform?: (v: string) => string
    }) => {
      const { form, info } = useField(name, 'stringArray')
      return (
        <form.Field mode='array' name={name}>
          {(f: AnyFieldApi) => {
            const tags = (f.state.value ?? []) as string[],
              inv = f.state.meta.isTouched && !f.state.meta.isValid,
              mx = info.max
            return (
              <Field data-invalid={inv}>
                {label ? <FieldLabel htmlFor={f.name}>{label}</FieldLabel> : null}
                <div
                  className={cn(
                    'relative flex min-h-10 w-full flex-wrap items-center gap-0.75 rounded-md border border-input bg-transparent p-1 text-sm transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50 dark:bg-background',
                    className
                  )}>
                  {tags.map((t, i) => (
                    <p
                      className={cn(
                        'flex h-7 items-center gap-0.5 rounded-full bg-muted pr-1.5 pl-3 transition-all duration-300 hover:bg-input',
                        tagClassName,
                        disabled && 'cursor-not-allowed opacity-50 *:cursor-not-allowed'
                      )}
                      key={t}>
                      <span className='mb-px'>{t}</span>
                      <X
                        className='size-4 cursor-pointer rounded-full stroke-1 p-0.5 text-muted-foreground transition-all duration-300 hover:scale-110 hover:bg-background hover:stroke-2 hover:text-destructive active:scale-75'
                        onClick={() => {
                          if (!disabled) f.removeValue(i)
                        }}
                      />
                    </p>
                  ))}
                  <input
                    aria-invalid={inv}
                    className={cn(
                      'peer ml-1 w-0 flex-1 outline-none placeholder:text-muted-foreground placeholder:capitalize',
                      tags.length ? 'placeholder:opacity-0' : 'pl-1',
                      inputClassName
                    )}
                    disabled={disabled}
                    id={f.name}
                    name={f.name}
                    onBlur={f.handleBlur}
                    onKeyDown={e => {
                      const { value } = e.currentTarget
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (!value.trim()) return
                        const v = transform ? transform(value) : value
                        if (tags.includes(v)) {
                          toast.error('Item duplicated')
                          return
                        }
                        if (mx && tags.length + 1 > mx) {
                          toast.error(`Max ${mx}`)
                          return
                        }
                        // eslint-disable-next-line perfectionist/sort-sets
                        f.handleChange([...new Set([...tags, v])])
                        e.currentTarget.value = ''
                      } else if (e.key === 'Backspace' && tags.length && !value.trim()) {
                        e.preventDefault()
                        f.removeValue(tags.length - 1)
                      }
                    }}
                    placeholder={tags.length ? undefined : placeholder}
                  />
                </div>
                {inv ? <FieldError errors={f.state.meta.errors} /> : null}
              </Field>
            )
          }}
        </form.Field>
      )
    },
    Choose: ({
      label,
      name,
      options,
      placeholder
    }: {
      label?: string
      name: string
      options: readonly { label: string; value: string }[]
      placeholder?: string
    }) => {
      const { form } = useField(name, 'string')
      return (
        <form.Field name={name}>
          {(f: AnyFieldApi) => {
            const inv = f.state.meta.isTouched && !f.state.meta.isValid
            return (
              <Field data-invalid={inv}>
                {label ? <FieldLabel htmlFor={f.name}>{label}</FieldLabel> : null}
                <Select name={f.name} onValueChange={v => f.handleChange(v)} value={f.state.value ?? ''}>
                  <SelectTrigger aria-invalid={inv} id={f.name} onBlur={f.handleBlur}>
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {inv ? <FieldError errors={f.state.meta.errors} /> : null}
              </Field>
            )
          }}
        </form.Field>
      )
    },
    Err: ({ error }: { error: Error | null }) =>
      error ? <p className='rounded-lg bg-destructive/10 p-3 text-sm text-destructive'>{error.message}</p> : null,
    File: ({
      accept,
      className,
      compressImg,
      disabled,
      label,
      maxSize,
      name
    }: {
      accept?: string
      className?: string
      compressImg?: boolean
      disabled?: boolean
      label?: string
      maxSize?: number
      name: string
    }) => {
      const { form } = useField(name, 'file')
      return (
        <form.Field name={name}>
          {(f: AnyFieldApi) => (
            <FileField
              accept={accept}
              className={className}
              compressImg={compressImg}
              disabled={disabled}
              field={f}
              label={label}
              maxSize={maxSize}
            />
          )}
        </form.Field>
      )
    },
    Files: ({
      accept,
      className,
      compressImg,
      disabled,
      label,
      max,
      maxSize,
      name
    }: {
      accept?: string
      className?: string
      compressImg?: boolean
      disabled?: boolean
      label?: string
      max?: number
      maxSize?: number
      name: string
    }) => {
      const { form, info } = useField(name, 'files')
      return (
        <form.Field mode='array' name={name}>
          {(f: AnyFieldApi) => (
            <FileField
              accept={accept}
              className={className}
              compressImg={compressImg}
              disabled={disabled}
              field={f}
              label={label}
              max={max ?? info.max}
              maxSize={maxSize}
              multiple
            />
          )}
        </form.Field>
      )
    },
    Num: ({
      label,
      name,
      ...props
    }: Omit<ComponentProps<'input'>, 'form' | 'id' | 'name' | 'onBlur' | 'onChange' | 'type' | 'value'> & {
      label?: string
      name: string
    }) => {
      const { form } = useField(name, 'number')
      return (
        <form.Field name={name}>
          {(f: AnyFieldApi) => {
            const inv = f.state.meta.isTouched && !f.state.meta.isValid
            return (
              <Field data-invalid={inv}>
                {label ? <FieldLabel htmlFor={f.name}>{label}</FieldLabel> : null}
                <Input
                  aria-invalid={inv}
                  id={f.name}
                  name={f.name}
                  onBlur={f.handleBlur}
                  onChange={e => {
                    const { value, valueAsNumber } = e.currentTarget
                    f.handleChange(value === '' || Number.isNaN(valueAsNumber) ? undefined : valueAsNumber)
                  }}
                  type='number'
                  value={f.state.value ?? ''}
                  {...props}
                />
                {inv ? <FieldError errors={f.state.meta.errors} /> : null}
              </Field>
            )
          }}
        </form.Field>
      )
    },
    Submit: ({
      children,
      disabled,
      Icon,
      ...props
    }: Omit<ComponentProps<typeof Button>, 'type'> & { children: ReactNode; Icon?: LucideIcon }) => {
      const { form } = useFCtx()
      return (
        <form.Subscribe selector={s => ({ dirty: s.isDirty, pending: s.isSubmitting })}>
          {({ dirty, pending }) => (
            <Button disabled={disabled ?? !(dirty || pending)} type='submit' {...props}>
              {pending ? <Spinner /> : Icon ? <Icon /> : null}
              {children}
            </Button>
          )}
        </form.Subscribe>
      )
    },
    Text: ({
      label,
      maxLength,
      multiline,
      name,
      ...props
    }: Omit<
      ComponentProps<'input'> & ComponentProps<'textarea'>,
      'form' | 'id' | 'maxLength' | 'name' | 'onBlur' | 'onChange' | 'value'
    > & { label?: string; maxLength?: number; multiline?: boolean; name: string }) => {
      const { form } = useField(name, 'string')
      return (
        <form.Field name={name}>
          {(f: AnyFieldApi) => {
            const inv = f.state.meta.isTouched && !f.state.meta.isValid,
              C = multiline ? Textarea : Input,
              val = f.state.value ?? ''
            return (
              <Field data-invalid={inv}>
                <div className='flex items-center justify-between'>
                  {label ? <FieldLabel htmlFor={f.name}>{label}</FieldLabel> : null}
                  {maxLength ? (
                    <span className='text-xs text-muted-foreground'>
                      {String(val).length}/{maxLength}
                    </span>
                  ) : null}
                </div>
                <C
                  aria-invalid={inv}
                  id={f.name}
                  maxLength={maxLength}
                  name={f.name}
                  onBlur={f.handleBlur}
                  onChange={e => f.handleChange(e.target.value)}
                  value={val}
                  {...props}
                />
                {inv ? <FieldError errors={f.state.meta.errors} /> : null}
              </Field>
            )
          }}
        </form.Field>
      )
    },
    Toggle: ({ falseLabel, name, trueLabel }: { falseLabel?: string; name: string; trueLabel: string }) => {
      const { form } = useField(name, 'boolean')
      return (
        <form.Field name={name}>
          {(f: AnyFieldApi) => {
            const inv = f.state.meta.isTouched && !f.state.meta.isValid
            return (
              <Field data-invalid={inv}>
                <div className='flex items-center gap-2'>
                  <Switch
                    aria-invalid={inv}
                    checked={f.state.value ?? false}
                    id={f.name}
                    name={f.name}
                    onBlur={f.handleBlur}
                    onCheckedChange={v => f.handleChange(v)}
                  />
                  <FieldLabel htmlFor={f.name}>{f.state.value ? trueLabel : (falseLabel ?? trueLabel)}</FieldLabel>
                </div>
                {inv ? <FieldError errors={f.state.meta.errors} /> : null}
              </Field>
            )
          }}
        </form.Field>
      )
    }
  }

export type { Api, FieldMetaMap }
export { buildMeta, fields, FormContext }
