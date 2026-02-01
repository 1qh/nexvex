import t from './t'
import { elementOf, isArrayType, unwrapZod } from './zod'

interface Output {
  path: string
  zodType: string
}

const unsupportedTypes = new Set([
    'coerce',
    'effects',
    'pipe',
    'preprocess',
    'transform',
    'ZodCoerce',
    'ZodEffects',
    'ZodPipeline',
    'ZodPreprocess',
    'ZodTransform'
  ]),
  asRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object',
  scan = (schema: unknown, path: string, out: Output[]) => {
    const base = unwrapZod(schema)
    if (base.type && unsupportedTypes.has(base.type)) out.push({ path, zodType: base.type })
    if (isArrayType(base.type)) return scan(elementOf(base.schema, base.def), `${path}[]`, out)
    if ((base.type === 'object' || base.type === 'ZodObject') && asRecord(base.schema?.shape))
      for (const [k, v] of Object.entries(base.schema.shape)) scan(v, path ? `${path}.${k}` : k, out)
  },
  res: Output[] = []
for (const [table, schema] of Object.entries(t)) scan(schema, table, res)
if (res.length) {
  for (const f of res) process.stderr.write(`${f.path}: unsupported zod type "${f.zodType}"\n`)
  process.exitCode = 1
}
