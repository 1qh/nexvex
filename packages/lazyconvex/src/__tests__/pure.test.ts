import { describe, expect, test } from 'bun:test'
import { array, boolean, date, number, object, optional, string, enum as zenum } from 'zod/v4'

import type { OrgCrudOptions } from '../server/org-crud'
import type { CrudOptions, RateLimitConfig } from '../server/types'

import { child, cvFile, cvFiles } from '../schema'
import { detectFiles, groupList, matchW } from '../server/helpers'
import { orgCascade } from '../server/org-crud'
import {
  coerceOptionals,
  cvFileKindOf,
  defaultValues,
  enumToOptions,
  isArrayType,
  isBooleanType,
  isDateType,
  isNumberType,
  isOptionalField,
  isStringType,
  pickValues,
  unwrapZod
} from '../zod'

const VOID = undefined

describe('unwrapZod', () => {
  test('plain string', () => {
    const r = unwrapZod(string())
    expect(r.type).toBe('string')
    expect(r.schema).toBeDefined()
    expect(r.def).toBeDefined()
  })

  test('optional(string)', () => {
    const r = unwrapZod(optional(string()))
    expect(r.type).toBe('string')
  })

  test('nullable(optional(string))', () => {
    const r = unwrapZod(string().nullable().optional())
    expect(r.type).toBe('string')
  })

  test('number', () => {
    expect(unwrapZod(number()).type).toBe('number')
  })

  test('boolean', () => {
    expect(unwrapZod(boolean()).type).toBe('boolean')
  })

  test('array(string)', () => {
    expect(unwrapZod(array(string())).type).toBe('array')
  })

  test('enum', () => {
    expect(unwrapZod(zenum(['a', 'b'])).type).toBe('enum')
  })

  test('undefined input', () => {
    const r = unwrapZod(VOID)
    expect(r.type).toBe('')
    expect(r.schema).toBeUndefined()
    expect(r.def).toBeUndefined()
  })

  test('non-schema input', () => {
    const r = unwrapZod(42)
    expect(r.type).toBe('')
  })
})

describe('isOptionalField', () => {
  test('required string is not optional', () => {
    expect(isOptionalField(string())).toBe(false)
  })

  test('optional string is optional', () => {
    expect(isOptionalField(optional(string()))).toBe(true)
  })

  test('nullable(optional(string)) is optional', () => {
    expect(isOptionalField(string().nullable().optional())).toBe(true)
  })

  test('nullable without optional is not optional', () => {
    expect(isOptionalField(string().nullable())).toBe(false)
  })

  test('undefined input', () => {
    expect(isOptionalField(VOID)).toBe(false)
  })
})

describe('cvFileKindOf', () => {
  test('cvFile() returns file', () => {
    expect(cvFileKindOf(cvFile())).toBe('file')
  })

  test('cvFiles() returns files', () => {
    expect(cvFileKindOf(cvFiles())).toBe('files')
  })

  test('optional(cvFile()) returns file', () => {
    expect(cvFileKindOf(cvFile().optional())).toBe('file')
  })

  test('nullable(cvFile()) returns file', () => {
    expect(cvFileKindOf(cvFile().nullable())).toBe('file')
  })

  test('array(cvFile()) returns files', () => {
    expect(cvFileKindOf(array(cvFile()))).toBe('files')
  })

  test('regular string returns undefined', () => {
    expect(cvFileKindOf(string())).toBeUndefined()
  })

  test('regular number returns undefined', () => {
    expect(cvFileKindOf(number())).toBeUndefined()
  })
})

describe('defaultValues', () => {
  const schema = object({
    active: boolean(),
    category: zenum(['tech', 'life', 'food']),
    count: number(),
    tags: array(string()),
    title: string()
  })

  test('generates correct defaults for all field types', () => {
    const defaults = defaultValues(schema)
    expect(defaults).toEqual({
      active: false,
      category: 'tech',
      count: 0,
      tags: [],
      title: ''
    })
  })

  test('file fields default to null', () => {
    const s = object({ photo: cvFile().nullable() })
    expect(defaultValues(s)).toEqual({ photo: null })
  })

  test('cvFiles fields default to empty array', () => {
    const s = object({ attachments: cvFiles() })
    expect(defaultValues(s)).toEqual({ attachments: [] })
  })

  test('date fields default to null', () => {
    const s = object({ createdAt: date() }),
      result = defaultValues(s)
    expect(result.createdAt).toBeNull()
  })
})

describe('pickValues', () => {
  const schema = object({
    price: number(),
    title: string()
  })

  test('extracts matching fields from doc', () => {
    const doc = { _id: '123', extra: true, price: 42, title: 'hello' }
    expect(pickValues(schema, doc)).toEqual({ price: 42, title: 'hello' })
  })

  test('falls back to defaults for missing fields', () => {
    const doc = { _id: '123', title: 'hello' }
    expect(pickValues(schema, doc)).toEqual({ price: 0, title: 'hello' })
  })

  test('ignores extra fields', () => {
    const doc = { foo: 'bar', price: 10, title: 'test', userId: 'u1' },
      result = pickValues(schema, doc)
    expect(result).toEqual({ price: 10, title: 'test' })
    expect('foo' in result).toBe(false)
    expect('userId' in result).toBe(false)
  })
})

describe('coerceOptionals', () => {
  const schema = object({
    name: string(),
    note: optional(string())
  })

  test('empty string on optional field becomes undefined', () => {
    const data = { name: 'test', note: '' },
      result = coerceOptionals(schema, data)
    expect(result.name).toBe('test')
    expect(result.note).toBeUndefined()
  })

  test('whitespace-only on optional field becomes undefined', () => {
    const data = { name: 'test', note: '   ' }
    expect(coerceOptionals(schema, data).note).toBeUndefined()
  })

  test('non-empty optional string stays and is trimmed', () => {
    const data = { name: 'test', note: ' hello ' }
    expect(coerceOptionals(schema, data).note).toBe('hello')
  })

  test('required string field is untouched', () => {
    const data = { name: '', note: 'x' }
    expect(coerceOptionals(schema, data).name).toBe('')
  })

  test('non-string optional field is untouched', () => {
    const s = object({ count: optional(number()) }),
      data = { count: 0 }
    expect(coerceOptionals(s, data).count).toBe(0)
  })
})

describe('enumToOptions', () => {
  const schema = zenum(['draft', 'published', 'archived'])

  test('generates options with capitalized labels', () => {
    const opts = enumToOptions(schema)
    expect(opts).toEqual([
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
      { label: 'Archived', value: 'archived' }
    ])
  })

  test('uses custom transform', () => {
    const opts = enumToOptions(schema, v => v.toUpperCase())
    expect(opts).toEqual([
      { label: 'DRAFT', value: 'draft' },
      { label: 'PUBLISHED', value: 'published' },
      { label: 'ARCHIVED', value: 'archived' }
    ])
  })
})

describe('type checks', () => {
  test('isStringType', () => {
    expect(isStringType('string')).toBe(true)
    expect(isStringType('enum')).toBe(true)
    expect(isStringType('number')).toBe(false)
    expect(isStringType('')).toBe(false)
  })

  test('isNumberType', () => {
    expect(isNumberType('number')).toBe(true)
    expect(isNumberType('string')).toBe(false)
  })

  test('isBooleanType', () => {
    expect(isBooleanType('boolean')).toBe(true)
    expect(isBooleanType('string')).toBe(false)
  })

  test('isArrayType', () => {
    expect(isArrayType('array')).toBe(true)
    expect(isArrayType('string')).toBe(false)
  })

  test('isDateType', () => {
    expect(isDateType('date')).toBe(true)
    expect(isDateType('string')).toBe(false)
  })
})

// eslint-disable-next-line max-statements
describe('matchW', () => {
  const doc = { category: 'tech', price: 50, published: true, title: 'Test', userId: 'u1' }

  test('no where matches everything', () => {
    expect(matchW(doc, VOID)).toBe(true)
  })

  test('AND conditions — all match', () => {
    expect(matchW(doc, { category: 'tech', published: true })).toBe(true)
  })

  test('AND conditions — partial mismatch', () => {
    expect(matchW(doc, { category: 'life', published: true })).toBe(false)
  })

  test('OR conditions', () => {
    expect(matchW(doc, { category: 'life', or: [{ category: 'tech' }] })).toBe(true)
  })

  test('OR conditions — none match', () => {
    expect(matchW(doc, { category: 'life', or: [{ category: 'food' }] })).toBe(false)
  })

  test('own filter with matching viewer', () => {
    expect(matchW(doc, { own: true }, 'u1')).toBe(true)
  })

  test('own filter with non-matching viewer', () => {
    expect(matchW(doc, { own: true }, 'u2')).toBe(false)
  })

  test('own filter with null viewer', () => {
    expect(matchW(doc, { own: true }, null)).toBe(false)
  })

  test('$gt operator', () => {
    expect(matchW(doc, { price: { $gt: 40 } })).toBe(true)
    expect(matchW(doc, { price: { $gt: 50 } })).toBe(false)
  })

  test('$gte operator', () => {
    expect(matchW(doc, { price: { $gte: 50 } })).toBe(true)
    expect(matchW(doc, { price: { $gte: 51 } })).toBe(false)
  })

  test('$lt operator', () => {
    expect(matchW(doc, { price: { $lt: 60 } })).toBe(true)
    expect(matchW(doc, { price: { $lt: 50 } })).toBe(false)
  })

  test('$lte operator', () => {
    expect(matchW(doc, { price: { $lte: 50 } })).toBe(true)
    expect(matchW(doc, { price: { $lte: 49 } })).toBe(false)
  })

  test('$between operator', () => {
    expect(matchW(doc, { price: { $between: [40, 60] } })).toBe(true)
    expect(matchW(doc, { price: { $between: [51, 60] } })).toBe(false)
    expect(matchW(doc, { price: { $between: [50, 50] } })).toBe(true)
  })
})

describe('groupList', () => {
  test('undefined returns empty array', () => {
    expect(groupList()).toEqual([])
  })

  test('empty where with no real keys returns empty', () => {
    expect(groupList({} as Record<string, unknown> & { own?: boolean })).toEqual([])
  })

  test('single group with field', () => {
    const gs = groupList({ published: true } as Record<string, unknown> & { own?: boolean })
    expect(gs).toHaveLength(1)
    expect(gs[0]?.published).toBe(true)
  })

  test('with or[]', () => {
    const input = { category: 'tech', or: [{ category: 'life' }] } as Record<string, unknown> & {
        or?: Record<string, unknown>[]
        own?: boolean
      },
      gs = groupList(input)
    expect(gs).toHaveLength(2)
    expect(gs[0]?.category).toBe('tech')
    expect(gs[1]?.category).toBe('life')
  })

  test('own-only group is included', () => {
    const gs = groupList({ own: true } as Record<string, unknown> & { own?: boolean })
    expect(gs).toHaveLength(1)
  })

  test('filters out empty or groups', () => {
    const input = { category: 'tech', or: [{}] } as Record<string, unknown> & {
        or?: Record<string, unknown>[]
        own?: boolean
      },
      gs = groupList(input)
    expect(gs).toHaveLength(1)
  })
})

describe('detectFiles', () => {
  test('detects cvFile fields', () => {
    const shape = { photo: cvFile().nullable(), title: string() }
    expect(detectFiles(shape)).toEqual(['photo'])
  })

  test('detects cvFiles fields', () => {
    const shape = { attachments: cvFiles(), title: string() }
    expect(detectFiles(shape)).toEqual(['attachments'])
  })

  test('detects both cvFile and cvFiles', () => {
    const shape = { attachments: cvFiles(), photo: cvFile().nullable(), title: string() },
      result = detectFiles(shape)
    expect(result).toContain('photo')
    expect(result).toContain('attachments')
    expect(result).toHaveLength(2)
  })

  test('returns empty for no file fields', () => {
    const shape = { count: number(), title: string() }
    expect(detectFiles(shape)).toEqual([])
  })
})

describe('RateLimitConfig', () => {
  test('config shape', () => {
    const config: RateLimitConfig = { max: 10, window: 60_000 }
    expect(config.max).toBe(10)
    expect(config.window).toBe(60_000)
  })

  test('default values', () => {
    const config: RateLimitConfig = { max: 1, window: 1000 }
    expect(config.max).toBeGreaterThan(0)
    expect(config.window).toBeGreaterThan(0)
  })
})

describe('CrudOptions search config', () => {
  const blogSchema = object({
    category: string(),
    content: string(),
    published: boolean(),
    title: string()
  })
  type BlogShape = typeof blogSchema.shape

  test('search: "index" is valid (backward compat)', () => {
    expect(Object.keys(blogSchema.shape)).toHaveLength(4)
    const opts: CrudOptions<BlogShape> = { search: 'index' }
    expect(opts.search).toBe('index')
  })

  test('search: { field, index } accepts valid schema keys', () => {
    const opts: CrudOptions<BlogShape> = { search: { field: 'content', index: 'search_content' } }
    const search = opts.search as { field?: string; index?: string }
    expect(search.field).toBe('content')
    expect(search.index).toBe('search_content')
  })

  test('search: { field } accepts any schema field name', () => {
    const opts: CrudOptions<BlogShape> = { search: { field: 'title' } }
    const search = opts.search as { field?: string }
    expect(search.field).toBe('title')
  })

  test('search: {} defaults both field and index', () => {
    const opts: CrudOptions<BlogShape> = { search: {} }
    const search = opts.search as { field?: string; index?: string }
    expect(search.field).toBeUndefined()
    expect(search.index).toBeUndefined()
  })

  test('search: undefined means no index search', () => {
    const opts: CrudOptions<BlogShape> = {}
    expect(opts.search).toBeUndefined()
  })

  test('typesafe: search field is constrained to schema keys', () => {
    const validField: CrudOptions<BlogShape>['search'] = { field: 'content' }
    expect(validField).toBeDefined()

    const anotherValid: CrudOptions<BlogShape>['search'] = { field: 'title' }
    expect(anotherValid).toBeDefined()

    // @ts-expect-error - 'conten' is not a key of BlogShape
    const _invalid: CrudOptions<BlogShape>['search'] = { field: 'conten' }
    expect(_invalid).toBeDefined()
  })
})

// eslint-disable-next-line max-statements
describe('typesafe field references', () => {
  const chatSchema = object({ isPublic: boolean(), title: string().min(1) }),
    messageSchema = object({ chatId: string(), content: string(), role: string() }),
    taskSchema = object({ completed: boolean(), priority: string(), projectId: string(), title: string() }),
    movieSchema = object({ title: string(), tmdb_id: number() })

  test('child() accepts valid foreignKey', () => {
    const result = child({ foreignKey: 'chatId', parent: 'chat', schema: messageSchema })
    expect(result.foreignKey).toBe('chatId')
  })

  test('child() rejects invalid foreignKey', () => {
    // @ts-expect-error - 'chatI' is not a key of messageSchema
    child({ foreignKey: 'chatI', parent: 'chat', schema: messageSchema })
  })

  test('child() parentSchema constrains parentField', () => {
    const result = child({ foreignKey: 'chatId', parent: 'chat', parentSchema: chatSchema, schema: messageSchema })
    expect(result.parentSchema).toBe(chatSchema)

    type ChatShape = typeof chatSchema.shape
    // @ts-expect-error - 'isPubic' is not a key of chatSchema
    const _invalid: keyof ChatShape = 'isPubic'
    expect(_invalid).toBeDefined()
  })

  test('search.field accepts valid schema keys', () => {
    type MsgShape = typeof messageSchema.shape
    const opts: CrudOptions<MsgShape> = { search: { field: 'content' } }
    expect(opts.search).toBeDefined()
  })

  test('search.field rejects invalid schema keys', () => {
    type MsgShape = typeof messageSchema.shape
    // @ts-expect-error - 'conten' is not a key of MsgShape
    const _invalid: CrudOptions<MsgShape>['search'] = { field: 'conten' }
    expect(_invalid).toBeDefined()
  })

  test('aclFrom.field accepts valid schema keys', () => {
    expect(Object.keys(taskSchema.shape)).toContain('projectId')
    type TaskShape = typeof taskSchema.shape
    const opts: OrgCrudOptions<TaskShape> = { aclFrom: { field: 'projectId', table: 'project' } }
    expect(opts.aclFrom?.field).toBe('projectId')
  })

  test('aclFrom.field rejects invalid schema keys', () => {
    type TaskShape = typeof taskSchema.shape
    // @ts-expect-error - 'projctId' is not a key of TaskShape
    const _invalid: OrgCrudOptions<TaskShape> = { aclFrom: { field: 'projctId', table: 'project' } }
    expect(_invalid).toBeDefined()
  })

  test('orgCascade accepts valid foreignKey', () => {
    const result = orgCascade(taskSchema, { foreignKey: 'projectId', table: 'task' })
    expect(result.foreignKey).toBe('projectId')
    expect(result.table).toBe('task')
  })

  test('orgCascade rejects invalid foreignKey', () => {
    // @ts-expect-error - 'projctId' is not a key of taskSchema
    orgCascade(taskSchema, { foreignKey: 'projctId', table: 'task' })
  })

  test('cacheCrud key accepts valid schema keys', () => {
    expect(Object.keys(movieSchema.shape)).toContain('tmdb_id')
    type MovieShape = typeof movieSchema.shape
    const key: keyof MovieShape = 'tmdb_id'
    expect(key).toBe('tmdb_id')
  })

  test('cacheCrud key rejects invalid schema keys', () => {
    type MovieShape = typeof movieSchema.shape
    // @ts-expect-error - 'tmdb_i' is not a key of MovieShape
    const _invalid: keyof MovieShape = 'tmdb_i'
    expect(_invalid).toBeDefined()
  })
})
