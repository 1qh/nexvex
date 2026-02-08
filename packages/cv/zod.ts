/** @file
 * Zod schema introspection utilities for Convex integration.
 *
 * VERSION PINNING: This file imports from 'zod/v4' to maintain compatibility with
 * convex-helpers/server/zod4 which requires Zod v4 APIs. The v4 export path ensures
 * stable internal structure (_def, _zod.def) even if the default export changes.
 *
 * DO NOT change imports to 'zod' - the internal schema structure differs between
 * Zod v3 and v4, breaking unwrapZod() and related introspection functions.
 */
import type { infer as zinfer, ZodObject, ZodRawShape } from 'zod/v4'

type CvMeta = 'file' | 'files'

interface ZodInternal {
  _def?: ZodInternalDef
  _zod?: { def?: ZodInternalDef }
  def?: ZodInternalDef
  element?: unknown
  meta?: () => unknown
  shape?: Record<string, unknown>
  unwrap?: () => unknown
}

interface ZodInternalDef {
  checks?: unknown
  element?: unknown
  elementType?: unknown
  inner?: unknown
  innerType?: unknown
  type?: string
  typeName?: string
}

const wrappers = new Set([
    'catch',
    'default',
    'nullable',
    'optional',
    'prefault',
    'ZodCatch',
    'ZodDefault',
    'ZodNullable',
    'ZodOptional'
  ]),
  arrays = new Set(['array', 'ZodArray']),
  booleans = new Set(['boolean', 'ZodBoolean']),
  dates = new Set(['date', 'ZodDate']),
  numbers = new Set(['number', 'ZodNumber']),
  strings = new Set(['enum', 'string', 'ZodEnum', 'ZodString']),
  asZod = (s: unknown): undefined | ZodInternal => (s && typeof s === 'object' ? (s as ZodInternal) : undefined),
  getDef = (s?: ZodInternal): undefined | ZodInternalDef => s?._zod?.def ?? s?._def ?? s?.def,
  getType = (d?: ZodInternalDef) => d?.type ?? d?.typeName ?? '',
  unwrapZod = (
    schema: unknown
  ): {
    def?: ZodInternalDef
    schema?: ZodInternal
    type: string
  } => {
    let cur = asZod(schema)
    while (cur) {
      const def = getDef(cur),
        type = getType(def)
      if (!wrappers.has(type)) return { def, schema: cur, type }
      cur = asZod(def?.inner ?? def?.innerType ?? (typeof cur.unwrap === 'function' ? cur.unwrap() : undefined))
    }
    return { type: '' }
  },
  optionals = new Set(['optional', 'ZodOptional']),
  isOptionalField = (schema: unknown): boolean => {
    let cur = asZod(schema)
    while (cur) {
      const def = getDef(cur),
        type = getType(def)
      if (optionals.has(type)) return true
      if (!wrappers.has(type)) return false
      cur = asZod(def?.inner ?? def?.innerType ?? (typeof cur.unwrap === 'function' ? cur.unwrap() : undefined))
    }
    return false
  },
  elementOf = (s?: ZodInternal, d?: ZodInternalDef): unknown => d?.element ?? d?.elementType ?? s?.element,
  cvMetaOf = (schema: unknown): CvMeta | undefined => {
    const m = unwrapZod(schema).schema?.meta?.()
    if (m && typeof m === 'object') {
      const { cv } = m as { cv?: unknown }
      if (cv === 'file' || cv === 'files') return cv
    }
  },
  isArrayType = (t: string) => arrays.has(t),
  isBooleanType = (t: string) => booleans.has(t),
  isDateType = (t: string) => dates.has(t),
  isNumberType = (t: string) => numbers.has(t),
  isStringType = (t: string) => strings.has(t),
  cvFileKindOf = (schema: unknown): CvMeta | undefined => {
    const { def, schema: s, type } = unwrapZod(schema),
      cv = cvMetaOf(s)
    if (cv) return cv
    if (isArrayType(type) && cvMetaOf(elementOf(s, def)) === 'file') return 'files'
  },
  enumToOptions = <T extends string>(
    schema: { options: readonly T[] },
    transform?: (v: T) => string
  ): {
    label: string
    value: T
  }[] =>
    schema.options.map(v => ({
      label: transform?.(v) ?? v.charAt(0).toUpperCase() + v.slice(1),
      value: v
    })),
  requiredPartial = <S extends ZodObject<ZodRawShape>>(
    schema: S,
    requiredKeys: (keyof S['shape'])[]
  ): ZodObject<ZodRawShape> => {
    const partial = schema.partial(),
      required = Object.fromEntries(requiredKeys.map(k => [k, true])) as Record<string, true>
    return partial.required(required) as ZodObject<ZodRawShape>
  },
  // eslint-disable-next-line max-statements
  defaultValue = (schema: unknown): unknown => {
    const { def, schema: base, type } = unwrapZod(schema),
      fk = cvFileKindOf(schema)
    if (fk === 'file') return null
    if (fk === 'files') return []
    if (isArrayType(type)) return []
    if (isBooleanType(type)) return false
    if (isNumberType(type)) return 0
    if (isStringType(type)) {
      if (base && 'options' in base) {
        const opts = (base as { options: readonly string[] }).options
        if (opts.length) return opts[0]
      }
      return ''
    }
    if (isDateType(type)) return null
    const inner = def?.inner ?? def?.innerType
    if (inner) return defaultValue(inner)
  },
  defaultValues = <S extends ZodObject<ZodRawShape>>(schema: S): zinfer<S> => {
    const result: Record<string, unknown> = {}
    // biome-ignore lint/nursery/noForIn: iterating shape keys with hasOwn guard
    for (const k in schema.shape) if (Object.hasOwn(schema.shape, k)) result[k] = defaultValue(schema.shape[k])
    return result as zinfer<S>
  },
  pickValues = <S extends ZodObject<ZodRawShape>>(schema: S, doc: object): zinfer<S> => {
    const d = doc as Record<string, unknown>,
      result: Record<string, unknown> = {}
    // biome-ignore lint/nursery/noForIn: iterating shape keys with hasOwn guard
    for (const k in schema.shape) if (Object.hasOwn(schema.shape, k)) result[k] = d[k] ?? defaultValue(schema.shape[k])
    return result as zinfer<S>
  }

export type { ZodInternalDef }
export {
  cvFileKindOf,
  defaultValues,
  elementOf,
  enumToOptions,
  isArrayType,
  isBooleanType,
  isDateType,
  isNumberType,
  isOptionalField,
  isStringType,
  pickValues,
  requiredPartial,
  unwrapZod
}
