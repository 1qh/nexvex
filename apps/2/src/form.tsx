/* eslint-disable react-hooks/rules-of-hooks */
// biome-ignore-all lint/suspicious/noExplicitAny: x
// biome-ignore-all lint/correctness/useHookAtTopLevel: watch hook is called inside component render context
'use client'
import type { Id } from '@a/cv/model'
import type { StandardSchemaV1 } from '@tanstack/form-core'
import type { FunctionReference } from 'convex/server'
import type { ReactNode } from 'react'
import type { infer as zinfer, ZodObject, ZodRawShape } from 'zod/v4'

import { ERROR_MESSAGES } from '@a/cv/f'
import { defaultValues as dv, isOptionalField, isStringType, unwrapZod } from '@a/cv/zod'
import { Button } from '@a/ui/button'
import { Dialog, DialogContent } from '@a/ui/dialog'
import { useForm as useTanStackForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useNavigationGuard } from 'next-navigation-guard'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Api, FieldMetaMap } from './fields'

import { buildMeta, fields, FormContext } from './fields'

const ConflictDialog = ({
  conflict,
  onResolve
}: {
  conflict: ConflictData | null
  onResolve: (action: 'cancel' | 'overwrite' | 'reload') => void
}) => (
  <Dialog open={Boolean(conflict)}>
    <DialogContent
      className='[&>button]:hidden'
      onEscapeKeyDown={() => onResolve('cancel')}
      onInteractOutside={() => onResolve('cancel')}>
      <h2 className='text-lg font-semibold'>Conflict Detected</h2>
      <p className='text-sm text-muted-foreground'>
        This record was modified by someone else. Choose how to resolve the conflict.
      </p>
      {conflict?.current || conflict?.incoming ? (
        <div className='space-y-3'>
          {conflict.current ? (
            <div className='rounded-lg bg-muted p-3'>
              <p className='mb-1 text-xs font-medium text-muted-foreground'>Server version:</p>
              <pre className='text-xs'>{JSON.stringify(conflict.current, null, 2)}</pre>
            </div>
          ) : null}
          {conflict.incoming ? (
            <div className='rounded-lg bg-muted p-3'>
              <p className='mb-1 text-xs font-medium text-muted-foreground'>Your version:</p>
              <pre className='text-xs'>{JSON.stringify(conflict.incoming, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className='flex justify-end gap-2'>
        <Button onClick={() => onResolve('cancel')} variant='outline'>
          Cancel
        </Button>
        <Button onClick={() => onResolve('reload')} variant='outline'>
          Reload
        </Button>
        <Button onClick={() => onResolve('overwrite')} variant='destructive'>
          Overwrite
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)

interface ConflictData {
  code: string
  current?: unknown
  incoming?: unknown
}

interface FormReturn<T extends Record<string, unknown>, S extends ZodObject<ZodRawShape>> {
  conflict: ConflictData | null
  error: Error | null
  guard: ReturnType<typeof useNavigationGuard>
  instance: Api<T>
  isDirty: boolean
  isPending: boolean
  lastSaved: null | number
  meta: FieldMetaMap
  reset: (values?: T) => void
  resolveConflict: (action: 'cancel' | 'overwrite' | 'reload') => void
  schema: S
  watch: <K extends keyof T>(name: K) => T[K]
}
type Key<T, V> = string & { [K in keyof T]: T[K] extends V ? K : never }[keyof T]
type Props<K extends keyof typeof fields> = Parameters<(typeof fields)[K]>[0]

interface TypedFields<T> {
  Arr: (p: WithName<Props<'Arr'>, Key<T, readonly string[] | string[] | undefined>>) => ReactNode
  Choose: (p: WithName<Props<'Choose'>, Key<T, string | undefined>>) => ReactNode
  Colorpick: (p: WithName<Props<'Colorpick'>, Key<T, string | undefined>>) => ReactNode
  Combobox: (p: WithName<Props<'Combobox'>, Key<T, string | undefined>>) => ReactNode
  Datepick: (p: WithName<Props<'Datepick'>, Key<T, null | number | undefined>>) => ReactNode
  Err: typeof fields.Err
  File: (p: WithName<Props<'File'>, Key<T, Id<'_storage'> | null | undefined>>) => ReactNode
  Files: (p: WithName<Props<'Files'>, Key<T, Id<'_storage'>[] | readonly Id<'_storage'>[] | undefined>>) => ReactNode
  MultiSelect: (p: WithName<Props<'MultiSelect'>, Key<T, readonly string[] | string[] | undefined>>) => ReactNode
  Num: (p: WithName<Props<'Num'>, Key<T, number | undefined>>) => ReactNode
  Rating: (p: WithName<Props<'Rating'>, Key<T, number | undefined>>) => ReactNode
  Slider: (p: WithName<Props<'Slider'>, Key<T, number | undefined>>) => ReactNode
  Submit: typeof fields.Submit
  Text: (
    p: WithName<Props<'Text'>, Key<T, string | undefined>> & {
      asyncDebounceMs?: number
      asyncValidate?: (value: string) => Promise<string | undefined>
    }
  ) => ReactNode
  Timepick: (p: WithName<Props<'Timepick'>, Key<T, string | undefined>>) => ReactNode
  Toggle: (p: { falseLabel?: string; name: Key<T, boolean | undefined>; trueLabel: string }) => ReactNode
}

type WithName<P, K> = Omit<P, 'name'> & { name: K }

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object',
  submitError = (e: unknown): Error => {
    if (e instanceof ConvexError) {
      const { data } = e as { data?: unknown },
        { code, message } = isRecord(data) ? data : {},
        c = typeof code === 'string' ? code : undefined,
        m = typeof message === 'string' ? message : undefined,
        msg = c && c in ERROR_MESSAGES ? ERROR_MESSAGES[c as keyof typeof ERROR_MESSAGES] : (m ?? 'Request failed')
      return new Error(msg, { cause: e })
    }
    return e instanceof Error ? e : new Error('Unknown error')
  },
  handleConflict = (error: unknown): ConflictData | null => {
    if (!(error instanceof ConvexError)) return null
    const { data } = error as { data?: unknown }
    if (!isRecord(data) || data.code !== 'CONFLICT') return null
    return {
      code: 'CONFLICT',
      current: data.current,
      incoming: data.incoming
    }
  },
  coerceOptionals = <S extends ZodObject<ZodRawShape>>(schema: S, data: zinfer<S>): zinfer<S> => {
    const result: Record<string, unknown> = { ...data }
    for (const k of Object.keys(result))
      if (isOptionalField(schema.shape[k]) && isStringType(unwrapZod(schema.shape[k]).type)) {
        const v = result[k]
        if (typeof v === 'string') {
          const trimmed = v.trim()
          result[k] = trimmed.length > 0 ? trimmed : undefined
        }
      }
    return result as zinfer<S>
  },
  useForm = <S extends ZodObject<ZodRawShape>>({
    autoSave,
    onConflict,
    onError,
    onSubmit,
    onSuccess,
    resetOnSuccess,
    schema,
    values
  }: {
    autoSave?: { debounceMs: number; enabled: boolean }
    onConflict?: (data: ConflictData) => void
    onError?: (e: unknown) => void
    onSubmit: (d: zinfer<S>, force?: boolean) => Promise<undefined | zinfer<S>> | undefined | zinfer<S>
    onSuccess?: () => void
    resetOnSuccess?: boolean
    schema: S
    values?: zinfer<S>
  }) => {
    const resolved = values ?? dv(schema),
      [conflict, setConflict] = useState<ConflictData | null>(null),
      [er, setEr] = useState<Error | null>(null),
      [forceSubmit, setForceSubmit] = useState(false),
      [lastSaved, setLastSaved] = useState<null | number>(null),
      vRef = useRef(resolved),
      autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

    vRef.current = resolved
    if (Object.keys(resolved).some(k => !(k in schema.shape))) throw new Error('Form values include keys not in schema')
    const meta = useMemo(() => buildMeta(schema), [schema]),
      instance = useTanStackForm({
        defaultValues: resolved,
        // eslint-disable-next-line max-statements
        onSubmit: async ({ value }) => {
          setEr(null)
          try {
            const coerced = coerceOptionals(schema, value),
              result = await onSubmit(coerced, forceSubmit),
              newValues = resetOnSuccess && isRecord(result) ? result : value
            instance.reset(newValues)
            if (resetOnSuccess && isRecord(result)) vRef.current = result
            setForceSubmit(false)
            setLastSaved(Date.now())
            onSuccess?.()
          } catch (error) {
            const conflictData = handleConflict(error)
            if (conflictData) {
              setConflict(conflictData)
              onConflict?.(conflictData)
              return
            }
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
    useEffect(() => {
      if (!(autoSave?.enabled && isDirty)) return
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        instance.handleSubmit()
      }, autoSave.debounceMs)
      return () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      }
    }, [autoSave?.enabled, autoSave?.debounceMs, isDirty, instance])
    return {
      conflict,
      error: er,
      guard,
      instance,
      isDirty,
      isPending: isSubmitting,
      lastSaved,
      meta,
      reset: (vals?: zinfer<S>) => {
        const resetVals = vals ?? vRef.current
        instance.reset(resetVals)
        if (vals) vRef.current = vals
        setEr(null)
        setLastSaved(null)
      },
      resolveConflict: (action: 'cancel' | 'overwrite' | 'reload') => {
        if (action === 'overwrite') {
          setConflict(null)
          setForceSubmit(true)
          instance.handleSubmit()
        } else if (action === 'reload') {
          setConflict(null)
          instance.reset(vRef.current)
        } else setConflict(null)
      },
      schema,
      watch: <K extends keyof zinfer<S>>(name: K) =>
        useStore(instance.store, s => s.values[name as string]) as zinfer<S>[K]
    } satisfies FormReturn<zinfer<S>, S>
  },
  useFormMutation = <S extends ZodObject<ZodRawShape>>({
    mutation: mutationRef,
    onConflict,
    onError,
    onSuccess,
    resetOnSuccess = true,
    schema,
    transform,
    values
  }: {
    mutation: FunctionReference<'mutation'>
    onConflict?: (data: ConflictData) => void
    onError?: (e: unknown) => void
    onSuccess?: () => void
    resetOnSuccess?: boolean
    schema: S
    transform?: (d: zinfer<S>) => Record<string, unknown>
    values?: zinfer<S>
  }) => {
    const mutate = useMutation(mutationRef)
    return useForm({
      onConflict,
      onError,
      onSubmit: async (d: zinfer<S>) => {
        const args = transform ? transform(d) : d
        await mutate(args)
        return d
      },
      onSuccess,
      resetOnSuccess,
      schema,
      values
    })
  },
  Form = <T extends Record<string, unknown>, S extends ZodObject<ZodRawShape>>({
    className,
    form: { conflict, error, guard, instance, meta, resolveConflict, schema },
    render,
    showError = true
  }: {
    className?: string
    form: FormReturn<T, S>
    render: (f: TypedFields<T>) => ReactNode
    showError?: boolean
  }) => (
    <FormContext value={{ form: instance as Api<Record<string, unknown>>, meta, schema }}>
      <form
        className={className}
        onSubmit={e => {
          e.preventDefault()
          instance.handleSubmit()
        }}>
        {showError && error ? (
          <p className='mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive' role='alert'>
            {error.message}
          </p>
        ) : null}
        {render(fields as TypedFields<T>)}
      </form>
      <ConflictDialog conflict={conflict} onResolve={resolveConflict} />
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
  ),
  AutoSaveIndicator = ({ lastSaved }: { lastSaved: null | number }) => {
    const [, forceUpdate] = useState(0)

    useEffect(() => {
      if (!lastSaved) return
      const id = setInterval(() => forceUpdate(n => n + 1), 10_000)
      return () => clearInterval(id)
    }, [lastSaved])

    if (!lastSaved) return null
    const ago = Math.round((Date.now() - lastSaved) / 1000)
    return <span className='text-xs text-muted-foreground'>{ago < 5 ? 'Saved' : `Saved ${ago}s ago`}</span>
  }

export { AutoSaveIndicator, Form, useForm, useFormMutation }
