import { base, children, owned } from './t'
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
    const b = unwrapZod(schema)
    if (b.type && unsupportedTypes.has(b.type)) out.push({ path, zodType: b.type })
    if (isArrayType(b.type)) return scan(elementOf(b.schema, b.def), `${path}[]`, out)
    if ((b.type === 'object' || b.type === 'ZodObject') && asRecord(b.schema?.shape))
      for (const [k, v] of Object.entries(b.schema.shape)) scan(v, path ? `${path}.${k}` : k, out)
  },
  res: Output[] = []
for (const [table, schema] of Object.entries({ ...base, ...children, ...owned })) scan(schema, table, res)
if (res.length) {
  for (const f of res) process.stderr.write(`${f.path}: unsupported zod type "${f.zodType}"\n`)
  process.exitCode = 1
}
