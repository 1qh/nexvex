# Convex Fullstack Setup Documentation

This document explains the fullstack architecture, how data flows from backend to frontend, how file storage works, how the form factory is wired, and exactly where to edit or not edit when adapting this setup to real projects.

It is written for both developers and AI coding agents. It is intentionally explicit so the whole setup can be rebuilt or migrated with minimal trial and error.

## Goals and Philosophy

- Typesafe everywhere: schema defined once, reused across backend and frontend.
- Minimal backend setup: one table schema, one line in schema registry, one small CRUD module.
- Minimal frontend boilerplate: typed hooks and a form factory that accepts a Zod schema.
- No accidental wrappers or layout bloat: see Minimal DOM rules in `AGENTS.md`.
- Keep `f.ts` generic: never add table-specific logic there.

## Repo Layout Overview

- `packages/cv/` is the Convex backend package and the shared types source.
- `apps/2/` is the example Next app that consumes `@a/cv`.
- `packages/cv/convex/_generated/` is Convex output, never edit by hand.

### Key Files

- `packages/cv/t.ts` defines Zod schemas for tables and file field metadata.
- `packages/cv/convex/schema.ts` registers tables and indexes.
- `packages/cv/f.ts` is the CRUD factory and shared backend helpers.
- `packages/cv/convex/<table>.ts` exposes CRUD endpoints per table.
- `packages/cv/convex/file.ts` is the file storage API.
- `apps/2/src/form.tsx` wraps TanStack Form with schema validation and guards.
- `apps/2/src/fields.tsx` provides typed field components and file inputs.
- `apps/2/src/use-upload.ts` is the upload hook for storage IDs.
- `apps/2/src/app/crud/` contains the blog example pages.

## Architecture at a Glance

### Read flow

```text
UI (Next/React)
  -> api.<table>.<query>
     -> Convex function (pub/auth)
        -> f.ts applyWhere + query
        -> f.ts enrich
           -> author join (users table)
           -> storage.getUrl for file fields
  <- enriched docs (author, own, <file>Url/<file>Urls)
```

### Write flow

```text
UI Form (useForm + fields)
  -> api.<table>.create/update/rm
     -> f.ts mutation
        -> ownership check
        -> db.insert / db.patch / db.delete
        -> file cleanup for removed storage IDs
  <- updated doc or deletion result
```

### File upload flow

```text
File input (File / Files)
  -> useUpload()
     -> api.file.upload (generateUploadUrl)
     -> XMLHttpRequest upload to Convex storage
     -> storageId returned
  -> store storageId in document
  -> read queries hydrate Url fields
```

## Backend: Convex + Zod

### 1) Schema is the source of truth

All table fields are defined in `packages/cv/t.ts`.

```tsx
import { zid } from 'convex-helpers/server/zod4'
import { array, boolean, object, string, enum as zenum } from 'zod/v4'

const file = zid('_storage').meta({ cv: 'file' }),
  files = array(file).meta({ cv: 'files' })

const t = {
  blog: object({
    attachments: files.max(5).optional(),
    category: zenum(['tech', 'life', 'tutorial']),
    content: string().min(3),
    coverImage: file.nullable().optional(),
    published: boolean(),
    slug: string().regex(/^[a-z0-9-]+$/u),
    tags: array(string()).max(5).optional(),
    title: string().min(1)
  })
}

export default t
```

- File fields must use `meta({ cv: 'file' })` or `meta({ cv: 'files' })` to enable file URL hydration.
- Never add a real column named `own`. It is a reserved virtual filter key.
- Zod features that cannot map to Convex fields are blocked by `packages/cv/check-schema.ts` (currently `transform`, `preprocess`, `pipe`, `coerce`, and `effects`). If upstream adds support, update the `unsupportedTypes` list there. Upstream references: <https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/server/zod4.ts> and <https://stack.convex.dev/typescript-zod-function-validation> and <https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/README.md>
  - Update `unsupportedTypes` when `zodOutputToConvex` or `zodOutputToConvexFields` change behavior (see `Zod → Convex` section in `zod4.ts`) or when the Stack article’s “Can I use Zod to define my database types too?” section indicates new supported transformations.

### 2) Table registration

Tables are registered in `packages/cv/convex/schema.ts`.

```tsx
import { zodOutputToConvexFields } from 'convex-helpers/server/zod4'
import { defineSchema, defineTable } from 'convex/server'

import t from '../t'

const n = schema =>
  defineTable({
    ...zodOutputToConvexFields(schema.shape),
    updatedAt: v.number(),
    userId: v.id('users')
  })

export default defineSchema({
  ...authTables,
  ...({
    blog: n(t.blog).index('by_user', ['userId']).index('by_slug', ['slug']).index('by_published', ['published'])
  } satisfies Record<keyof typeof t, ReturnType<typeof n>>)
})
```

- `updatedAt` and `userId` are appended to every table with `n`.
- Every table is an owned table, and CRUD helpers assume `userId` exists.
- Do not edit `_generated` files.

### 3) CRUD factory

The generic CRUD helper is `packages/cv/f.ts`.

- `crud(table, schema)` which returns:
  - `create`, `update`, `rm` (auth required)
  - `my` (auth required)
  - `pub.all`, `pub.list`, `pub.read` (public queries with optional viewer)
  - `auth.all`, `auth.list`, `auth.read` (auth required)
- Automatic `updatedAt` updates on create and update.
- Ownership check on mutations and reads.
- Author join and `own` flag on read results.
- File URL hydration based on Zod field metadata.
- File cleanup when a doc is updated or deleted.

### Default `where` (per table)

You can provide default filters per table when calling `crud`. These defaults apply only if the caller does not pass a `where`.

Example:

```ts
const { create, my, pub, rm, update } = crud('blog', t.blog, {
  pub: { where: { or: [{ published: true }, { own: true }] } }
})
```

This ensures public reads only return published posts or the owner’s drafts, while still allowing explicit overrides by passing `where`.

#### `where` filters

The `all`, `list`, `read`, and `my` queries accept:

```tsx
type WhereGroup = Partial<Schema> & { own?: boolean }
type Where = WhereGroup & { or?: WhereGroup[] }
```

Semantics:

- A single group is `AND` across its fields.
- `or` is `OR` across multiple groups.
- `own: true` is allowed; `own: false` does nothing.
- Any value except `undefined` is treated as a condition. `false`, `0`, `''`, and `null` are valid filters.

```tsx
const allPublished = { where: { published: true } }
const publishedOrOwn = { where: { or: [{ published: true }, { own: true }] } }
const publishedByCategory = { where: { published: true, category: 'tech' } }
const mixed = { where: { category: 'tech', or: [{ published: true }, { own: true }] } }
```

If you need:

- ranges
- text search
- index-specific queries

Create a new Convex function in `packages/cv/convex/<table>.ts` rather than changing `f.ts`.

### 4) Cache factory

The cache factory is for external API data with TTL-based expiration. Unlike `crud`, cache tables do not have `userId` and are not user-owned.

```tsx
import { cache } from '../f'
import t from '../t'

const c = cache({
  table: 'movie',
  schema: t.movie,
  key: 'tmdb_id',
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  fetcher: async (ctx, tmdb_id) => {
    const { id, ...rest } = await ky.get(`/api/movie/${tmdb_id}`).json()
    return { ...rest, tmdb_id: id }
  }
})

export const { all, get, load, refresh, invalidate, purge, ... } = c
```

#### Cache options

| Option | Required | Description |
|--------|----------|-------------|
| `table` | yes | Table name (must have `expiresAt: number` in schema) |
| `schema` | yes | Zod schema for the cached data |
| `key` | yes | Unique key field name (e.g., `tmdb_id`) |
| `ttl` | no | Time-to-live in ms (default: 7 days) |
| `fetcher` | no | Async function to fetch data from source |

#### Generated APIs

| Export | Type | Description |
|--------|------|-------------|
| `get` | query | Get cached doc by key (null if expired/missing) |
| `getInternal` | internalQuery | Get cached doc (for internal use) |
| `read` | query | Get doc by `_id` |
| `all` | query | All cached docs (optional `includeExpired`) |
| `list` | query | Paginated list (optional `includeExpired`) |
| `load` | action | Get from cache or fetch if missing/expired |
| `refresh` | action | Force refresh from source |
| `create` | mutation | Manually create/update cache entry |
| `update` | mutation | Update cache entry |
| `set` | internalMutation | Upsert cache entry (internal) |
| `rm` | mutation | Delete cache entry |
| `invalidate` | mutation | Delete by key |
| `purge` | mutation | Delete all expired entries |

#### Schema-based field picking

The cache factory automatically picks only schema-defined fields from fetcher responses. This allows:

1. Spread all fields from external APIs without manual filtering
2. Define only the fields you use on the frontend in your schema
3. Get full type safety for defined fields

```tsx
// t.ts - Define only fields you need on frontend
movie: object({
  tmdb_id: number(),
  title: string(),
  overview: string(),
  poster_path: string().nullable(),
  // ... only fields used on frontend
  expiresAt: number()
})

// movie.ts - Spread all API fields, factory picks only schema fields
fetcher: async (_, tmdb_id) => {
  const { id, ...rest } = await ky.get(`/movie/${tmdb_id}`).json()
  return { ...rest, tmdb_id: id } // all fields accepted, only schema fields stored
}
```

The factory:

- Accepts any fields from the fetcher
- Picks only schema-defined fields before storing in database
- Returns only schema-defined fields from actions (plus `cacheHit`)

#### Cache hit indicator

`load` and `refresh` actions return `{ ...data, cacheHit: boolean }`:

- `cacheHit: true` - Data served from cache (not expired)
- `cacheHit: false` - Data fetched fresh from source

#### Table registration for cache

Use the `cache` helper in `schema.ts`:

```tsx
const cache = <T extends ZodRawShape>(schema: ZodObject<T>) =>
  defineTable({
    ...zodOutputToConvexFields(schema.shape),
    updatedAt: v.number()
  })

export default defineSchema({
  movie: cache(t.movie).index('by_tmdb_id', ['tmdb_id'])
})
```

Cache tables must:

- Have `expiresAt: number` in the Zod schema
- Have an index on the key field (e.g., `by_tmdb_id`)
- Not have `userId` (not user-owned)

### 5) File storage APIs

`packages/cv/convex/file.ts` exposes:

- `upload`: returns `storage.generateUploadUrl()`
- `info`: returns storage metadata plus a signed URL

The CRUD factory reads file fields and adds:

- `coverImageUrl` for `coverImage`
- `attachmentsUrls` for `attachments`
- `author` and `own` for owned tables

File IDs are stored in the table. URLs are computed at read time.

## Frontend: Data Fetching Patterns

The Convex API is exported as `@a/cv`. Types come from `@a/cv/model`.

### Pattern 1: Server-side fetch (static)

`apps/2/src/app/crud/static/page.tsx`

```tsx
const blogs = await fetchQuery(
  api.blog.all,
  { where: { or: [{ published: true }, { own: true }] } },
  { token: await convexAuthNextjsToken() }
)
```

Use `fetchQuery` for server components that do not need client reactivity.

### Pattern 2: Server preload + client consume (dynamic)

- `apps/2/src/app/crud/dynamic/page.tsx`

```tsx
const preloaded = await preloadQuery(api.blog.all, args, { token })
```

- `apps/2/src/app/crud/dynamic/client.tsx`

```tsx
const blogs = usePreloadedQuery(preloaded)
```

This keeps server latency low and provides client reactivity after hydration.

### Pattern 3: Infinite pagination

`apps/2/src/app/crud/pagination/page.tsx`

```tsx
const { loadMore, results, status } = usePaginatedQuery(
  api.blog.list,
  { where: { or: [{ published: true }, { own: true }] } },
  { initialNumItems: 5 }
)
```

The `list` query is powered by the CRUD factory and uses Convex pagination.

### Pattern 4: Single read with access gating

`apps/2/src/app/crud/[id]/page.tsx`

```tsx
const preloaded = await preloadQuery(api.blog.read, { id }, { token: await convexAuthNextjsToken() })
```

Passing a token allows `own` to resolve for the viewer. The read handler applies the same `where` matching rules, so you can gate by `published` or `own` if needed.

## Frontend: Blog Example Walkthrough

The blog example shows full CRUD + files:

- Create dialog in `apps/2/src/app/crud/common.tsx`
- Listing and cards in `apps/2/src/app/crud/common.tsx`
- Read view in `apps/2/src/app/crud/[id]/client.tsx`
- Edit view in `apps/2/src/app/crud/[id]/edit/client.tsx`

Notable fields:

- `coverImage` and `attachments` are file fields stored as storage IDs.
- `coverImageUrl` and `attachmentsUrls` are hydrated by backend.
- `author` and `own` are hydrated by backend.

Type derivation:

```tsx
type Blog = FunctionReturnType<typeof api.blog.all>[number]
```

This keeps UI props in sync with backend changes.

## Form Factory (TanStack Form + Zod)

The form factory is split into:

- `apps/2/src/form.tsx` for state, schema, and guards
- `apps/2/src/fields.tsx` for field components

### `useForm`

Accepts:

- `schema`: Zod object
- `values`: default values
- `onSubmit`, `onSuccess`, `onError`

Returns:

- `instance` for TanStack Form
- `isPending`, `isDirty`
- `reset()`
- `error`
- `guard` for navigation blocking

### `Form`

`Form` wraps:

- The actual `<form>` element
- A navigation guard dialog
- A `FormContext` to provide schema and form instance

### Field components

Use the field components exposed through the render prop:

- `Text`
- `Num`
- `Choose`
- `Arr`
- `Toggle`
- `File`
- `Files`
- `Submit`
- `Err`

The render function is typed to your schema keys.

```tsx
const form = useForm({
  schema: t.blog.omit({ published: true, slug: true }),
  values: { attachments: [], category: 'tech', content: '', coverImage: null, tags: [], title: '' },
  onSubmit: d => create({ ...d, published: false, slug: slugify(d.title) })
})
return (
  <Form
    form={form}
    render={({ Arr, Choose, File, Files, Submit, Text }) => (
      <>
        <FieldGroup>
          <Text label='Title' name='title' />
          <Choose label='Category' name='category' options={categories} />
          <Text label='Content' multiline name='content' />
          <File accept='image/*' label='Cover Image' name='coverImage' />
          <Files accept='image/*,application/pdf' label='Attachments' name='attachments' />
          <Arr label='Tags' name='tags' />
        </FieldGroup>
        <Submit>Create</Submit>
      </>
    )}
  />
)
```

### File fields

`File` and `Files` do all of the following:

- Upload to Convex storage via `useUpload`
- Store storage IDs in form state
- Preview files via `api.file.info`
- Enforce max size and type via `react-dropzone`
- Compress images before upload by default

If you want to bypass compression:

```tsx
<File compressImg={false} name='coverImage' />
```

## File Storage End-to-End

The upload flow:

1. Frontend calls `api.file.upload` to get a signed upload URL.
2. Browser uploads file via `XMLHttpRequest`.
3. Convex returns a `storageId`.
4. The storage ID is stored in the document.
5. On read, backend hydrates `Url` fields.

The delete flow:

- `crud.update` compares previous and new file IDs.
- `crud.rm` deletes all file IDs on the document.
- `storage.delete` is called only for removed IDs.

## Migration Quick-Start Checklist (Existing App -> Convex)

> Use this list when migrating an existing app into this setup.

Inventory data

- List all tables/collections.
- Identify ownership (`userId`) and indexes you need for reads.
- Mark file fields as single or multiple.

Define schemas in `packages/cv/t.ts`

- One Zod schema per table.
- Use `zid('_storage').meta({ cv: 'file' })` for single files.
- Use `array(file).meta({ cv: 'files' })` for multiple files.

Register tables in `packages/cv/convex/schema.ts`

- Use `n(schema)` for standard owned tables.
- Add indexes needed for your read patterns.

Create CRUD modules in `packages/cv/convex/<table>.ts`

- Keep it minimal: `crud('table', t.table)` and export `all/list/read/create/update/rm/my`.
- Add custom queries only if you need indexed filters or special rules.

Replace client data access

- Replace REST/GraphQL calls with `useQuery`, `useMutation`, `usePaginatedQuery`.
- For SSR, use `fetchQuery` or `preloadQuery`.

Replace forms

- Use `useForm` + `Form` + field render pattern.
- Use `File`/`Files` for file inputs to get uploads and previews.

Enforce access

- Use `where: { or: [{ published: true }, { own: true }] }` on public lists.
- Add custom Convex queries for any special access logic.

Remove old storage layer

- Store storage IDs directly in tables.
- Let CRUD handle URL hydration and cleanup.

Verify

- `bun typecheck`
- Create, update, delete, upload
- Verify URLs and file cleanup

## Adding a New Table

- Define schema in `packages/cv/t.ts`.

```tsx
const t = {
  product: object({
    title: string().min(1),
    price: number().min(0),
    photo: zid('_storage').meta({ cv: 'file' }).nullable().optional()
  })
}
```

- Register table in `packages/cv/convex/schema.ts`.

```tsx
product: n(t.product).index('by_user', ['userId'])
```

- Create a CRUD module in `packages/cv/convex/product.ts`.

```tsx
import { crud } from '../f'
import t from '../t'

const { create, my, pub, rm, update } = crud('product', t.product),
  { all, list, read } = pub

export { all, create, list, my, read, rm, update }
```

- Use it on the frontend:

```tsx
const create = useMutation(api.product.create)
const products = useQuery(api.product.all, { where: { own: true } })
```

## Adding a Cache Table

Cache tables are for external API data with automatic expiration.

- Define schema in `packages/cv/t.ts` with `expiresAt`.

```tsx
const t = {
  movie: object({
    tmdb_id: number(),
    title: string(),
    overview: string(),
    poster_path: string().nullable(),
    release_date: string(),
    vote_average: number(),
    expiresAt: number()  // required for cache tables
  })
}
```

- Register table in `packages/cv/convex/schema.ts` using `cache` helper.

```tsx
movie: cache(t.movie).index('by_tmdb_id', ['tmdb_id'])
```

- Create a cache module in `packages/cv/convex/movie.ts`.

```tsx
import { cache } from '../f'
import t from '../t'

const c = cache({
  table: 'movie',
  schema: t.movie,
  key: 'tmdb_id',
  ttl: 7 * 24 * 60 * 60 * 1000,
  fetcher: async (ctx, tmdb_id) => {
    const res = await fetch(`https://api.example.com/movie/${tmdb_id}`)
    const { id, ...rest } = await res.json()
    return { ...rest, tmdb_id: id }
  }
})

export const { all, get, invalidate, list, load, purge, read, refresh, rm } = c
```

- Use it on the frontend:

```tsx
const load = useAction(api.movie.load)
const movie = await load({ tmdb_id: 550 })
// movie.cacheHit tells you if it came from cache
```

## Adding File Fields to a Table

Use `zid('_storage').meta({ cv: 'file' })` for single files and `array(...).meta({ cv: 'files' })` for multiple.

On the frontend, use `File` and `Files` components to handle uploads and previews.

The CRUD factory will automatically create:

- `<field>Url` for single file fields
- `<field>Urls` for file arrays

## Custom Queries and Performance

The default CRUD uses `filter` which is not index-optimized for large datasets.

If you need:

- heavy filtering
- index use
- range search

Create a custom Convex query in the table module and export it.

### Pattern: read by unique index

```tsx
const bySlug = pq({
  args: { slug: z.string() },
  handler: async (c, { slug }) => {
    const doc = await c.db.query('blog').withIndex('by_slug', q => q.eq('slug', slug)).unique()
    return doc ? (await c.withAuthor([doc]))[0] ?? null : null
  }
})

export { bySlug }
```

### Pattern: index-backed list with pagination

```tsx
const publishedList = pq({
  args: { paginationOpts },
  handler: async (c, { paginationOpts: opt }) => {
    const { page, ...rest } = await c.db
      .query('blog')
      .withIndex('by_published', q => q.eq('published', true))
      .order('desc')
      .paginate(opt)
    return { ...rest, page: await c.withAuthor(page) }
  }
})

export { publishedList }
```

### Pattern: index-backed false values

The CRUD `where` supports `false`, but it uses `filter` and may not use an index. If you need indexed queries for `false` values, add a custom query.

```tsx
const draftsByUser = q({
  handler: async c => {
    const docs = await c.db
      .query('blog')
      .withIndex('by_user', q => q.eq('userId', c.user._id))
      .filter(f => f.eq(f.field('published'), false))
      .order('desc')
      .collect()
    return c.withAuthor(docs)
  }
})

export { draftsByUser }
```

If you need performance, add a compound index like `['userId', 'published']` and query that index instead of filtering.

### Pattern: range queries on `updatedAt`

Add an index in `schema.ts`:

```tsx
blog: n(t.blog).index('by_updated', ['updatedAt'])
```

Query with range:

```tsx
const updatedSince = pq({
  args: { since: z.number() },
  handler: async (c, { since }) =>
    c.db.query('blog').withIndex('by_updated', q => q.gte('updatedAt', since)).order('desc').collect()
})
```

### Pattern: read + access gate in one query

```tsx
const readPublishedOrOwn = pq({
  args: { id: zid('blog') },
  handler: async (c, { id }) => {
    const doc = await c.db.get(id)
    if (!doc) return null
    if (!doc.published && (!c.viewerId || doc.userId !== c.viewerId)) return null
    return (await c.withAuthor([doc]))[0] ?? null
  }
})
```

## Where to Edit vs Where to Avoid

Edit:

- `packages/cv/t.ts` for schema.
- `packages/cv/convex/schema.ts` for table registration and indexes.
- `packages/cv/convex/<table>.ts` for table APIs.
- `apps/2/src/form.tsx` and `apps/2/src/fields.tsx` to change form behavior.
- `apps/2/src/use-upload.ts` to change upload behavior.

Avoid:

- `packages/cv/convex/_generated/*`
- `packages/cv/eslint.config.ts` and any lint configs
- `node_modules`

Keep `f.ts` generic. If a change affects only one table, it belongs in that table’s Convex module or the frontend.

## Behavior Guarantees

- All write operations require auth and enforce ownership.
- All reads can include `own` for access gating.
- File storage IDs are never exposed as URLs directly.
- `author` and `own` are computed, not stored.
- Removing a file ID from a doc cleans the file from storage.

## Common Pitfalls

- Do not create a table field named `own`.
- `where` ignores only `undefined` values. `own: false` has no effect.
- If you need index-backed `published: false` queries, add a custom query with an index.
- `coverImageUrl` and `attachmentsUrls` are null if a file no longer exists.

## Agent Guidance

When extending this codebase:

- Keep `f.ts` table-agnostic.
- Put table-specific logic in `packages/cv/convex/<table>.ts`.
- Never add a field named `own` to a schema.
- Prefer index-backed queries for large datasets.
- Use the provided form factory for consistent types and behavior.

## Routing Map (Blog Example)

This section shows how the blog example is wired end-to-end.

### Routes

- `/crud` navigation hub
- `/crud/static` server-side fetch
- `/crud/dynamic` preload + client consume
- `/crud/pagination` infinite list
- `/crud/[id]` single read
- `/crud/[id]/edit` owner edit view

### Route responsibilities

- `apps/2/src/app/crud/page.tsx`
  - Links to examples
- `apps/2/src/app/crud/static/page.tsx`
  - Uses `fetchQuery` on the server
  - Renders `<Create />` and `<List />`
- `apps/2/src/app/crud/dynamic/page.tsx`
  - Uses `preloadQuery` on the server
  - Renders client component
- `apps/2/src/app/crud/dynamic/client.tsx`
  - Uses `usePreloadedQuery`
  - Renders `<Create />` and `<List />`
- `apps/2/src/app/crud/pagination/page.tsx`
  - Uses `usePaginatedQuery` for infinite scroll
- `apps/2/src/app/crud/[id]/page.tsx`
  - Preloads `api.blog.read`
- `apps/2/src/app/crud/[id]/client.tsx`
  - Displays blog content, files, and author
- `apps/2/src/app/crud/[id]/edit/page.tsx`
  - Preloads `api.blog.read`
- `apps/2/src/app/crud/[id]/edit/client.tsx`
  - Edit forms and settings, owner-only

## File Lifecycle FAQ

### Where do files live?

Files are stored in Convex file storage. Documents store only the `_storage` IDs.

### When do URLs exist?

URLs are created at read time via `storage.getUrl`, not stored in the table.

### What happens if a file is removed in the form?

On update:

- `crud.update` compares previous and new storage IDs.
- Any removed IDs are deleted from storage.

### What happens on delete?

On delete:

- `crud.rm` deletes all storage IDs attached to the document.

### Can URLs be shared directly?

Yes, but they are signed and may expire. Always read via CRUD to refresh URLs.

### How do I prevent cleanup?

Do not remove the storage ID from the document. If you need shared assets, use a dedicated asset table and never delete those IDs.

## Template: Table README (for new tables)

Copy this section into a table-specific README or use it as a checklist.

```text
# <TableName>

Purpose:
- What this table represents

Schema:
- Defined in packages/cv/t.ts under <tableName>
- File fields: <field> (single), <field> (multiple)

Indexes:
- by_user
- by_<field>

API:
- create/update/rm (auth)
- my (auth)
- pub.all/pub.list/pub.read (public)
- auth.all/auth.list/auth.read (auth)
- custom: <function> (if any)

Frontend:
- Primary list page: <route>
- Detail page: <route>
- Edit page: <route>

Access rules:
- Owns by userId
- Public reads gated by published or own

Notes:
- Any special validation or migration rules
```

## Testing Checklist

Run these steps after adding a new table or file field.

### Backend

- Create: `create` works and sets `userId` and `updatedAt`.
- Update: `update` patches fields and updates `updatedAt`.
- Delete: `rm` deletes the document and cleans storage IDs.
- Read: `pub.read` and `auth.read` return author + own.
- List: `pub.list` pagination works and returns hydrated URLs.

### Files

- Upload: file uploads and returns a `storageId`.
- Preview: `api.file.info` returns metadata + URL.
- Replace: swapping a file deletes the old one.
- Remove: removing a file deletes it from storage.

### Frontend

- Forms: validation matches Zod rules.
- Draft vs published: access gating works.
- Pagination: load more works and stops when exhausted.

## Migration Pitfalls and Fixes

- Missing `userId`: CRUD assumes ownership, add `userId` via `n()` in schema.
- Missing indexes: create index for any heavy query pattern.
- Expecting indexed `published: false` filters: CRUD `where` uses `filter`; add a custom query with an index.
- Stale URLs: URLs are generated on read; never store them in documents.
- Named `own` field: reserved, rename the column.
- File field missing meta: add `meta({ cv: 'file' | 'files' })` to Zod field.

## Glossary

- `crud`: factory in `packages/cv/f.ts` that builds standard APIs for user-owned tables.
- `cache`: factory in `packages/cv/f.ts` that builds APIs for external data with TTL expiration.
- `pub`: public queries with optional viewer (auth optional).
- `auth`: authenticated queries (auth required).
- `own`: derived boolean if viewerId matches doc.userId.
- `withAuthor`: joins a doc with its `users` row.
- `storageId`: `_storage` ID returned by Convex file upload.
- `Url` fields: derived fields like `coverImageUrl` and `attachmentsUrls`.
- `expiresAt`: timestamp field in cache tables indicating when cached data expires.
- `cacheHit`: boolean returned by cache `load`/`refresh` indicating if data came from cache.
- `ttl`: time-to-live in milliseconds for cached data.
- `pick`: internal function that extracts only schema-defined fields from fetcher responses.

## Security and Access Patterns

### Public read with ownership fallback

Use this for feeds where owners can see their drafts but others only see published content.

```tsx
{ where: { or: [{ published: true }, { own: true }] } }
```

### Owner-only list

Use `my` for owner data.

```tsx
const mine = useQuery(api.blog.my)
```

### Owner-only read

Use `auth.read` or custom queries for stricter rules.

```tsx
const doc = useQuery(api.blog.read, { id, where: { own: true } })
```

### Public read with custom access

If access is complex (e.g., team membership), add a custom query in `convex/<table>.ts`.

## Performance Guide

### Use indexes for high volume queries

Use indexes for:

- lists by user
- lists by published
- lookups by slug
- range queries on timestamps

Example index registration:

```tsx
blog: n(t.blog)
  .index('by_user', ['userId'])
  .index('by_published', ['published'])
  .index('by_slug', ['slug'])
```

### Avoid heavy `filter` for large datasets

`filter` runs in-memory and scans query results. For large tables, prefer `withIndex`.

### Pagination defaults

The CRUD list uses Convex pagination and is safe for infinite scroll. Use `initialNumItems` and `loadMore` on the client.

## Schema Design Checklist

Use this when creating or revisiting a table schema.

- Fields and types match the UI and validation rules.
- Ownership fields (`userId`) are present and required.
- File fields are marked with `meta({ cv: 'file' | 'files' })`.
- Defaults are handled in the form values and in mutations.
- String fields have minimum lengths and formatting where required.
- Arrays have max length if needed (tags, attachments).

## Auth Integration

The project uses `@convex-dev/auth` in `packages/cv/convex/auth.ts`.

Current behavior:

- `getAuthUserId` is used in `f.ts`.
- Mutations and `auth.*` queries require a signed-in user.
- Public reads still include `viewerId` if provided.

## Frontend UX Checklist

Use this when building forms and list screens.

- Forms use `useForm` + `Form` so validation and guards stay consistent.
- File inputs use `File` / `Files` for correct upload and preview logic.
- Lists use `List` + `Card` patterns for consistent types.
- Owner-only actions are gated by `own`.
- Pagination uses `usePaginatedQuery` and stops when exhausted.

## Forms Cookbook

These patterns show how to use the form factory for common cases.

### Enum select

```tsx
const categories = t.blog.shape.category.options.map(c => ({
  label: c.charAt(0).toUpperCase() + c.slice(1),
  value: c
}))

<Choose label='Category' name='category' options={categories} />
```

### Long text

```tsx
<Text label='Content' multiline name='content' />
```

### Tags array with limit

```tsx
<Arr label='Tags' name='tags' placeholder='Add tag...' transform={s => s.toLowerCase()} />
```

### Single file with preview

```tsx
<File accept='image/*' label='Cover Image' maxSize={5 * 1024 * 1024} name='coverImage' />
```

### Multiple files with limit

```tsx
<Files
  accept='image/*,application/pdf'
  label='Attachments'
  maxSize={10 * 1024 * 1024}
  name='attachments'
/>
```

### Submit states

```tsx
<Submit className='ml-auto' Icon={Save}>
  {form.isPending ? 'Saving...' : 'Save'}
</Submit>
```

### Conditional fields (simple)

Use a regular React condition in the render block.

```tsx
render={({ Text, Toggle }) => (
  <>
    <FieldGroup>
      <Toggle name='published' trueLabel='Published' falseLabel='Draft' />
      {form.instance.state.values.published ? <Text label='Slug' name='slug' /> : null}
    </FieldGroup>
  </>
)
```

### Dependent selects (client-driven)

Compute options in the component and pass them into `Choose`.

```tsx
const category = form.instance.state.values.category
const subOptions = category === 'tech' ? techSubs : lifeSubs

<Choose label='Subcategory' name='subcategory' options={subOptions} />
```

### Async defaults

Load data first, then pass it as `values` to `useForm`.

```tsx
const blog = useQuery(api.blog.read, { id })
const form = useForm({
  schema: t.blog.partial(),
  values: blog ? { title: blog.title, content: blog.content } : { title: '', content: '' },
  onSubmit: d => update({ id, ...d })
})
```

### File-only edit form

Use only `File` / `Files` fields.

```tsx
<Form
  form={form}
  render={({ File, Files, Submit }) => (
    <>
      <File label='Cover' name='coverImage' accept='image/*' />
      <Files label='Attachments' name='attachments' />
      <Submit>Save</Submit>
    </>
  )}
/>
```

### Bulk edits (simple)

Use `Promise.all` on the client and a custom mutation on the server if you need transactional behavior.

```tsx
await Promise.all(ids.map(id => update({ id, published: true })))
```

If you need atomicity, implement a bulk mutation in `packages/cv/convex/<table>.ts`.

### Custom file validation

Use client-side validation before uploading and schema validation for metadata fields.

```tsx
<File
  accept='image/*'
  maxSize={2 * 1024 * 1024}
  name='coverImage'
/>
```

## Summary

This setup makes Convex a drop-in replacement for a fullstack app:

- Zod schema drives database schema, validation, and frontend types.
- CRUD is one line per table (user-owned data).
- Cache is one line per table (external API data with TTL).
- File storage is automatic when Zod meta is present.
- Frontend uses typed hooks and a schema-aware form factory.

When in doubt:

- Add tables in `t.ts`
- Register in `schema.ts` (use `owned` for user data, `cache` for external data)
- Export CRUD or cache in `convex/<table>.ts`
- Consume via `@a/cv` on the frontend
