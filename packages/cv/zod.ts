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
  numbers = new Set(['number', 'ZodNumber']),
  strings = new Set(['enum', 'string', 'ZodEnum', 'ZodString']),
  asZod = (s: unknown): undefined | ZodInternal => (s && typeof s === 'object' ? (s as ZodInternal) : undefined),
  getDef = (s?: ZodInternal): undefined | ZodInternalDef => s?._zod?.def ?? s?._def ?? s?.def,
  getType = (d?: ZodInternalDef) => d?.type ?? d?.typeName ?? '',
  unwrapZod = (schema: unknown): { def?: ZodInternalDef; schema?: ZodInternal; type: string } => {
    let cur = asZod(schema)
    while (cur) {
      const def = getDef(cur),
        type = getType(def)
      if (!wrappers.has(type)) return { def, schema: cur, type }
      cur = asZod(def?.inner ?? def?.innerType ?? (typeof cur.unwrap === 'function' ? cur.unwrap() : undefined))
    }
    return { type: '' }
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
  isNumberType = (t: string) => numbers.has(t),
  isStringType = (t: string) => strings.has(t),
  cvFileKindOf = (schema: unknown): CvMeta | undefined => {
    const { def, schema: s, type } = unwrapZod(schema),
      cv = cvMetaOf(s)
    if (cv) return cv
    if (isArrayType(type) && cvMetaOf(elementOf(s, def)) === 'file') return 'files'
  }

export type { ZodInternalDef }
export { cvFileKindOf, elementOf, isArrayType, isBooleanType, isNumberType, isStringType, unwrapZod }
