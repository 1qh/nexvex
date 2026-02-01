// biome-ignore-all lint/suspicious/noExplicitAny: x
'use client'
import type { Id } from '@a/cv/model'
import type { StandardSchemaV1 } from '@tanstack/form-core'
import type { ReactNode } from 'react'
import type { infer as zinfer, ZodObject, ZodRawShape } from 'zod/v4'

import { Button } from '@a/ui/button'
import { Dialog, DialogContent } from '@a/ui/dialog'
import { useForm as useTanStackForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'
import { ConvexError } from 'convex/values'
import { useNavigationGuard } from 'next-navigation-guard'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Api, FieldMetaMap } from './fields'

import { buildMeta, fields, FormContext } from './fields'

interface FormReturn<T extends Record<string, unknown>, S extends ZodObject<ZodRawShape>> {
  error: Error | null
  guard: ReturnType<typeof useNavigationGuard>
  instance: Api<T>
  isDirty: boolean
  isPending: boolean
  meta: FieldMetaMap
  reset: () => void
  schema: S
}
type Key<T, V> = string & { [K in keyof T]: T[K] extends V ? K : never }[keyof T]
type Props<K extends keyof typeof fields> = Parameters<(typeof fields)[K]>[0]

interface TypedFields<T> {
  Arr: (p: WithName<Props<'Arr'>, Key<T, readonly string[] | string[] | undefined>>) => ReactNode
  Choose: (p: WithName<Props<'Choose'>, Key<T, string | undefined>>) => ReactNode
  Err: typeof fields.Err
  File: (p: WithName<Props<'File'>, Key<T, Id<'_storage'> | null | undefined>>) => ReactNode
  Files: (p: WithName<Props<'Files'>, Key<T, Id<'_storage'>[] | readonly Id<'_storage'>[] | undefined>>) => ReactNode
  Num: (p: WithName<Props<'Num'>, Key<T, number | undefined>>) => ReactNode
  Submit: typeof fields.Submit
  Text: (p: WithName<Props<'Text'>, Key<T, string | undefined>>) => ReactNode
  Toggle: (p: { falseLabel?: string; name: Key<T, boolean | undefined>; trueLabel: string }) => ReactNode
}

type WithName<P, K> = Omit<P, 'name'> & { name: K }

const errMsgs: Record<string, string> = {
    INVALID_WHERE: 'Invalid filters',
    NOT_AUTHENTICATED: 'Please log in',
    NOT_FOUND: 'Not found',
    USER_NOT_FOUND: 'User not found'
  },
  isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object',
  submitError = (e: unknown): Error => {
    if (e instanceof ConvexError) {
      const { data } = e as { data?: unknown },
        { code, message } = isRecord(data) ? data : {},
        c = typeof code === 'string' ? code : undefined,
        m = typeof message === 'string' ? message : undefined
      return new Error(c && errMsgs[c] ? errMsgs[c] : (m ?? 'Request failed'), { cause: e })
    }
    return e instanceof Error ? e : new Error('Unknown error')
  },
  useForm = <S extends ZodObject<ZodRawShape>>({
    onError,
    onSubmit,
    onSuccess,
    schema,
    values
  }: {
    onError?: (e: unknown) => void
    onSubmit: (d: zinfer<S>) => unknown
    onSuccess?: () => void
    schema: S
    values: zinfer<S>
  }) => {
    const [er, setEr] = useState<Error | null>(null),
      vRef = useRef(values)
    // eslint-disable-next-line react-hooks/refs
    vRef.current = values
    if (Object.keys(values).some(k => !(k in schema.shape))) throw new Error('Form values include keys not in schema')
    const meta = useMemo(() => buildMeta(schema), [schema]),
      instance = useTanStackForm({
        defaultValues: values,
        onSubmit: async ({ value }) => {
          setEr(null)
          try {
            await onSubmit(value)
            instance.reset(value)
            onSuccess?.()
          } catch (error) {
            const err = submitError(error)
            setEr(err)
            onError?.(err)
          }
        },
        validators: { onSubmit: schema as unknown as StandardSchemaV1<zinfer<S>, unknown> }
      }) as unknown as Api<zinfer<S>>,
      { isDirty, isSubmitting } = useStore(instance.store, s => ({ isDirty: s.isDirty, isSubmitting: s.isSubmitting })),
      dirty = isDirty || isSubmitting,
      guard = useNavigationGuard({ enabled: dirty })
    useEffect(() => {
      if (!dirty) return
      const h = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        e.returnValue = ''
      }
      window.addEventListener('beforeunload', h)
      return () => window.removeEventListener('beforeunload', h)
    }, [dirty])
    return {
      error: er,
      guard,
      instance,
      isDirty,
      isPending: isSubmitting,
      meta,
      reset: () => {
        instance.reset(vRef.current)
        setEr(null)
      },
      schema
    } satisfies FormReturn<zinfer<S>, S>
  },
  Form = <T extends Record<string, unknown>, S extends ZodObject<ZodRawShape>>({
    className,
    form: { guard, instance, meta, schema },
    render
  }: {
    className?: string
    form: FormReturn<T, S>
    render: (f: TypedFields<T>) => ReactNode
  }) => (
    <FormContext value={{ form: instance as Api<Record<string, unknown>>, meta, schema }}>
      <form
        className={className}
        onSubmit={e => {
          e.preventDefault()
          instance.handleSubmit()
        }}>
        {render(fields as TypedFields<T>)}
      </form>
      <Dialog open={guard.active}>
        <DialogContent className='[&>button]:hidden' onEscapeKeyDown={guard.reject} onInteractOutside={guard.reject}>
          <p>You have unsaved changes. Are you sure you want to leave?</p>
          <div className='flex justify-end gap-2'>
            <Button onClick={guard.reject} variant='outline'>
              Cancel
            </Button>
            <Button onClick={guard.accept} variant='destructive'>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FormContext>
  )

export { Form, useForm }
