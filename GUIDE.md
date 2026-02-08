Typesafe fullstack: Zod schema → Convex backend → React frontend.

**DX wins**: Define a Zod schema once → get CRUD endpoints, typesafe forms, file handling, real-time queries, conflict detection, and optimistic updates with zero boilerplate. No REST routes, no API layer, no manual validation.

### What you'd write without this

```tsx
// WITHOUT: ~80 lines per table (route handler + validation + auth + pagination + error handling + React form)
export const createProduct = mutation({
  args: { title: v.string(), price: v.number(), photo: v.id('_storage') },
  handler: async (ctx, args) => {
    const user = await getAuthUserId(ctx)
    if (!user) throw new ConvexError('NOT_AUTHENTICATED')
    return ctx.db.insert('product', { ...args, userId: user, createdAt: Date.now(), updatedAt: Date.now() })
  }
})
// + updateProduct, deleteProduct, getProduct, listProducts, searchProducts, countProducts...
// + file cleanup on delete, cascade deletes, soft delete, conflict detection, ownership checks...
// + React form with Zod validation, file upload, error handling, optimistic updates...

// WITH: 3 lines. Same result, fully typesafe.
const { create, pub, rm, update } = crud('product', owned.product)
export const { all, count, list, read, search } = pub
export { create, rm, update }
```

## Imports

| Package | Exports |
|---------|---------|
| `@a/cv` | `api` |
| `@a/cv/t` | `owned`, `orgScoped`, `org`, `children`, `base`, `child`, `cvFile`, `cvFiles` |
| `zod/v4` | `object`, `string`, `number`, `boolean`, `array`, `enum as zenum` |
| `convex-helpers/server/zod4` | `zid` (typed ID validator, e.g. `zid('users')`) |
| `@a/cv/f` | `crud`, `orgCrud`, `childCrud`, `cacheCrud`, `orgCascade`, `canEdit`, `uniqueCheck`, `handleConvexError`, `getErrorCode`, `getErrorMessage`, `ERROR_MESSAGES` |
| `@a/cv/model` | `Id`, `Doc`, `TableNames` |
| `@a/cv/zod` | `pickValues`, `defaultValues`, `enumToOptions`, `unwrapZod`, `isStringType`, etc. |
| Schema registration | `ownedTable`, `orgTable`, `childTable`, `cacheTable` — used in `packages/cv/convex/schema.ts` |
| Custom query builders | `pq`, `q`, `m`, `cq`, `cm` — defined per endpoint file via `packages/cv/f/builders` |

## Contents

- [Imports](#imports) · [Recipes](#recipes) · [Which Hook?](#which-hook)
- Quick Start: [Owned Table](#quick-start-add-a-table) · [Org-Scoped Table](#quick-start-org-scoped-table-with-acl)
- [Table Types](#table-types) · [CRUD Factory](#crud-factory) · [Child CRUD](#child-crud) · [Cache Factory](#cache-factory)
- [Frontend](#frontend): [Data Fetching](#data-fetching) · [Forms](#forms-create) · [`useFormMutation`](#useformmutation-combined-hook) · [`pickValues`](#forms-update) · [File Upload](#file-upload) · [Optimistic Updates](#optimistic-updates)
- [Custom Queries](#custom-queries) · [Relations](#relations) · [Where Clauses](#where-clause-reference)
- [Error Handling](#error-handling)
- [Organizations](#organizations-multi-tenant) · [ACL (Editors)](#acl-editors) *(skip if not using)*
- [Known Limitations](#known-limitations) · [Full Examples](#full-examples)

## Quick Start: Add a Table

```tsx
// 1. Define schema (packages/cv/t.ts)
owned = {
  product: object({
    title: string().min(1),
    price: number().min(0),
    photo: cvFile().nullable(),
    attachments: cvFiles().max(5).optional()
  })
}
// 2. Register table (packages/cv/convex/schema.ts)
product: ownedTable(owned.product)
// 3. Create endpoints (packages/cv/convex/product.ts)
const { create, pub, rm, update } = crud('product', owned.product)
export const { all, count, list, read, search } = pub
export { create, rm, update }
// 4. Use in React
const products = useQuery(api.product.all)
const createProduct = useMutation(api.product.create)
```

### Quick Start: Org-Scoped Table with ACL

```tsx
// 1. Define schema (packages/cv/t.ts)
orgScoped = {
  wiki: object({
    title: string().min(1),
    slug: string().min(1),
    content: string().optional(),
    status: zenum(['draft', 'published']),
    editors: array(zid('users')).max(100).optional()
  })
}
// 2. Register table (packages/cv/convex/schema.ts)
wiki: orgTable(orgScoped.wiki)
// 3. Create endpoints (packages/cv/convex/wiki.ts) — acl: true auto-generates editor endpoints
const { addEditor, all, create, editors, list, read, removeEditor, rm, setEditors, update } = orgCrud(
  'wiki', orgScoped.wiki, { acl: true }
)
export { addEditor, all, create, editors, list, read, removeEditor, rm, setEditors, update }
// 4. Use in React (inside OrgProvider)
const wikis = useOrgQuery(api.wiki.list, { paginationOpts: { cursor: null, numItems: 20 } })
const editorsList = useOrgQuery(api.wiki.editors, { wikiId })
```

## Recipes

End-to-end patterns for the most common pages. All org examples assume `<OrgProvider>` context.

### Org List Page

```tsx
const items = useOrgQuery(api.project.list, { paginationOpts: { cursor: null, numItems: 20 } })
const bulkRm = useMutation(api.project.bulkRm)
const { selected, toggleSelect, handleBulkDelete } = useBulkSelection({
  bulkRm, items: items?.page ?? [], label: 'project(s)', orgId: org._id
})
```

### Org Create Page

```tsx
const form = useFormMutation({
  mutation: api.wiki.create,
  schema: orgScoped.wiki,
  transform: d => ({ ...d, orgId: org._id }),
  onSuccess: () => { toast.success('Created'); router.push(`/org/${org.slug}/wiki`) },
  resetOnSuccess: true
})

<Form form={form} render={({ Text, Choose, Submit }) => (
  <>
    <Text name='title' label='Title' />
    <Choose name='status' label='Status' />
    <Submit>Create</Submit>
  </>
)} />
```

### Org Edit Page

```tsx
const doc = useOrgQuery(api.wiki.read, { id: wikiId })
const remove = useOrgMutation(api.wiki.rm)
const form = useFormMutation({
  mutation: api.wiki.update,
  schema: orgScoped.wiki,
  values: doc ? pickValues(orgScoped.wiki, doc) : undefined,
  transform: d => ({ ...d, id: wikiId, orgId: org._id }),
  onSuccess: () => { toast.success('Updated'); router.push(`/org/${org.slug}/wiki`) }
})

const editorsList = useOrgQuery(api.wiki.editors, { wikiId })
const canEditDoc = isAdmin || doc.userId === me._id || editorsList?.some(e => e.userId === me._id)

<PermissionGuard canAccess={canEditDoc} backHref={backUrl} backLabel='wiki' resource='wiki'>
  <Form form={form} render={({ Text, Choose, Submit }) => (
    <>
      <Text name='title' label='Title' />
      <Submit>Save</Submit>
      <Button variant='destructive' onClick={() => { confirm('Delete?') && remove({ id: wikiId }) }}>
        Delete
      </Button>
    </>
  )} />
</PermissionGuard>
```

## Which Hook?

| Task | Hook | When |
|------|------|------|
| Query (owned/public) | `useQuery(api.x.y, args)` | No org context |
| Query (org-scoped) | `useOrgQuery(api.x.y, args?)` | Inside `OrgProvider`, auto-injects `orgId` |
| Mutation (owned/public) | `useMutation(api.x.y)` | No org context |
| Mutation (org-scoped) | `useOrgMutation(api.x.y)` | Inside `OrgProvider`, auto-injects `orgId` |
| Form (custom submit) | `useForm({ schema, onSubmit })` | Need custom submit logic (e.g. conditional redirect) |
| Form + mutation | `useFormMutation({ mutation, schema })` | Standard create/update pattern |
| Edit form values | `pickValues(schema, doc)` | Extract doc fields matching schema with type-safe defaults |

`useOrgQuery` supports `'skip'` as second arg. `useOrgMutation` returns `(args?) => Promise`. Both omit `orgId` from caller args.

## Table Types

| Type | Factory | Use Case |
|------|---------|----------|
| `owned` | `crud()` | User-owned data (has `userId`) |
| `orgScoped` | `orgCrud()` | Org-scoped data (has `orgId` + membership check) |
| `children` | `childCrud()` | Nested under parent (e.g., messages in chat) |
| `base` | `cacheCrud()` | External API cache (e.g., TMDB movies) |

## CRUD Factory

```tsx
const {
  create, update, rm,           // mutations
  pub: { all, count, list, read, search },   // public queries
  auth: { all, count, list, read, search }, // auth-required queries
  bulkUpdate, bulkRm,           // batch ops (max 100)
  restore                       // only with softDelete: true
} = crud('product', owned.product, {
  cascade: false,     // opt out of cascade deletes (default: true)
  softDelete: true    // enable soft delete + restore
})
```

**Soft Delete Setup**: Add `deletedAt` to your Zod schema:

```tsx
// t.ts
owned = {
  product: object({
    title: string(),
    deletedAt: number().optional()  // required for softDelete
  })
}
```

## Child CRUD

```tsx
// t.ts
children = {
  message: child({
    parent: 'chat',
    foreignKey: 'chatId',
    schema: object({ text: string() })
  })
}
// Use
const { create, list, update, rm } = childCrud('message', children.message)
```

Parent ownership is verified automatically. The `list` query uses the `by_${parent}` index by default (e.g., `by_chat` for messages). Override with `index: 'custom_index'` in the `child()` config.

**Type safety**: `foreignKey` must be a key in your schema shape — a typo like `chatid` instead of `chatId` raises a type error.

### Cascade Delete

Deleting a parent automatically deletes all children (enabled by default):

```tsx
// Deleting chat removes all its messages automatically
await rm({ id: chatId })
// Opt-out for specific table:
const { rm } = crud('chat', owned.chat, { cascade: false })
```

Cascade relationships are derived from `children.*.parent` — define once, works everywhere.

## Cache Factory (External APIs)

For caching external API responses with automatic TTL expiration.

```tsx
const c = cacheCrud({
  table: 'movie',
  schema: base.movie,
  key: 'tmdb_id',
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days (default)
  fetcher: async (ctx, id) => fetchFromTMDB(id)
})

export const { load, refresh, get, all, invalidate, purge } = c
```

| Method | Description |
|--------|-------------|
| `load` | Returns cached data or fetches if missing/expired |
| `refresh` | Force re-fetch and update cache |
| `get` | Get cached only (null if expired) |
| `all` | List all cached entries |
| `invalidate` | Delete specific cache entry |
| `purge` | Delete all expired entries |

```tsx
const movie = await ctx.runAction(api.movie.load, { tmdb_id: 550 })
const fresh = await ctx.runAction(api.movie.refresh, { tmdb_id: 550 })
const cached = useQuery(api.movie.get, { tmdb_id: 550 })
const movies = useQuery(api.movie.all, { includeExpired: false })
await invalidate({ tmdb_id: 550 })
const deleted = await purge({})
```

| TTL | Use Case |
|-----|----------|
| 1 hour | Real-time prices, stock data |
| 24 hours | User profiles, frequently updated |
| 7 days | Movie metadata, static content |
| 30 days | Rarely changing reference data |

## Frontend

### Data Fetching

```tsx
// Real-time subscription
const products = useQuery(api.product.all)
// With filters (see Where Clause Reference for full syntax)
const published = useQuery(api.blog.all, { where: { published: true } })
const expensive = useQuery(api.product.all, { where: { price: { $gte: 100 } } })
// Own filter (current user's docs only)
const myPublished = useQuery(api.blog.all, { where: { published: true, own: true } })
// Skip when not needed
const data = useQuery(api.product.all, isOpen ? {} : 'skip')
// Pagination
const { results, loadMore, status } = usePaginatedQuery(
  api.product.list,
  {},
  { initialNumItems: 20 }
)
// Indexed queries (fast lookups)
const bySlug = useQuery(api.blog.pubIndexed, {
  index: 'by_slug',
  key: 'slug',
  value: 'my-post'
})
```

### Forms (Create)

`values` is optional — defaults are derived from the schema (strings → `''`, numbers → `0`, booleans → `false`, arrays → `[]`, files → `null`, enums → first option). Empty optional strings are auto-coerced to `undefined` on submit.

```tsx
const form = useForm({
  schema: owned.product,
  onSubmit: data => create(data),
  onSuccess: () => toast.success('Created')
})

<Form form={form} render={({ Text, Num, File, Submit }) => (
  <>
    <Text name='title' label='Title' />
    <Num name='price' label='Price' />
    <File name='photo' label='Photo' accept='image/*' />
    <Submit>Save</Submit>
  </>
)} />
```

### Derived Schemas (`src/schema.ts`)

Schemas with `.partial()`, `.omit()`, or custom inline forms live in `apps/2/src/schema.ts` to avoid duplication. Raw schemas (`orgScoped.project`) import directly from `@a/cv/t`.

```tsx
// apps/2/src/schema.ts
const createBlog = owned.blog.omit({ published: true }),
  editBlog = owned.blog.partial(),
  orgTeam = org.team.omit({ avatarId: true })
```

### `useFormMutation` (Combined Hook)

Combines `useMutation` + `useForm` — avoids separate wiring:

```tsx
const form = useFormMutation({
  mutation: api.wiki.update,
  schema: orgScoped.wiki,
  values: wiki ? pickValues(orgScoped.wiki, wiki) : undefined,
  transform: d => ({ ...d, id: wikiId, orgId: org._id }),
  onSuccess: () => toast.success('Updated'),
  resetOnSuccess: true
})
```

Options: `mutation`, `schema`, `values?`, `transform?`, `onSuccess?`, `onError?`, `onConflict?`, `resetOnSuccess?` (default `true`).

### Forms (Update)

Edit forms pass `values` from existing data. Use `pickValues` to extract schema-matching fields with type-appropriate defaults:

```tsx
import { pickValues } from '@a/cv/zod'

const doc = useQuery(api.product.read, { id })
const form = useForm({
  schema: editProduct,
  values: doc ? pickValues(editProduct, doc) : undefined,
  onSubmit: async data => {
    await update({ id, ...data })
    return data
  },
  onSuccess: () => toast.success('Saved')
})
```

**Conflict Detection**: Pass `expectedUpdatedAt` to detect concurrent edits:

```tsx
onSubmit: async data => {
  await update({ id, ...data, expectedUpdatedAt: doc?.updatedAt })
}
```

If another user modified the record, a conflict dialog appears with options to cancel, reload, or overwrite.

**Navigation Guard**: Forms automatically warn users about unsaved changes when navigating away.

**Field Components:** `Text`, `Num`, `Choose`, `MultiSelect`, `Arr`, `Toggle`, `Datepick`, `File`, `Files`, `Colorpick`, `Slider`, `Rating`, `Timepick`, `Combobox`, `Submit`

### Async Validation

Validate against the backend (e.g., check uniqueness):

```tsx
// Backend: packages/cv/convex/blog.ts
import { uniqueCheck } from '@a/cv/f'
export const isSlugAvailable = uniqueCheck('blog', 'slug')  // fully typesafe
// Frontend:
<Text
  name='slug'
  label='Slug'
  asyncValidate={async (value) => {
    const available = await isSlugAvailable({ value, exclude: id })
    return available ? undefined : 'Slug already taken'
  }}
  asyncDebounceMs={500}
/>
```

The `uniqueCheck` helper is fully typesafe — only valid string fields are accepted.

### Auto-Save

```tsx
const form = useForm({
  schema: owned.product,
  onSubmit: data => update({ id, ...data }),
  autoSave: { enabled: true, debounceMs: 1000 }
})
// form.lastSaved: number | null (timestamp)
<AutoSaveIndicator lastSaved={form.lastSaved} />
```

### File Upload

```tsx
const { upload, isUploading, progress } = useUpload()
const result = await upload(file)
if (result.ok) {
  await create({ photo: result.storageId })
}
```

Image fields auto-compress by default (max 1920px, 0.8 quality):

```tsx
<File name='photo' />                    // compressed (default)
<File name='photo' compressImg={false} /> // original quality
```

**File Rules:** `cvFile()` for single file, `cvFiles()` for arrays (from `@a/cv/t`). Auto-cleanup on doc update/delete. Max 10MB, rate limited 10 uploads/min.

**Auto URL resolution:** Query results automatically include resolved URLs for file fields — `photo` (storage ID) → `photoUrl` (string URL), `attachments` (ID array) → `attachmentsUrls` (URL array). No manual `storage.getUrl()` calls needed.

### Optimistic Updates

```tsx
const { execute, isPending, error } = useOptimisticMutation({
  mutation: api.product.rm,
  onOptimistic: ({ id }) => setProducts(p => p.filter(x => x._id !== id)),
  onSuccess: (result, args) => toast.success('Deleted'),
  onRollback: (args, error) => toast.error('Failed to delete')
})
<button onClick={() => execute({ id: product._id })} disabled={isPending}>
  {isPending ? 'Deleting...' : 'Delete'}
</button>
```

For updates:

```tsx
const { execute } = useOptimisticMutation({
  mutation: api.product.update,
  onOptimistic: ({ id, title }) => {
    setProducts(p => p.map(x => x._id === id ? { ...x, title } : x))
  },
  onRollback: () => refetch()
})
```

## Custom Queries

Use when CRUD factory doesn't cover your access pattern (indexed lookups, joins, aggregations):

```tsx
// pq = public query (optional auth)   cq = custom query (no auth context)
// q  = auth required query             cm = custom mutation (no auth context)
// m  = auth required mutation
const bySlug = pq({
  args: { slug: z.string() },
  handler: async (c, { slug }) => {
    const doc = await c.db.query('blog')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .unique()
    return doc ? (await c.withAuthor([doc]))[0] : null
  }
})
const publish = m({
  args: { id: zid('blog') },
  handler: async (c, { id }) => {
    await c.get(id)  // throws if not owner
    return c.patch(id, { published: true })
  }
})
```

## Where Clause Reference

### Default Where (Factory-Level)

Pre-filter endpoints so users only see relevant data:

```tsx
crud('blog', owned.blog, {
  pub: { where: { published: true } },      // public only sees published
  auth: { where: { published: true } }      // auth users also see published
})
```

### Comparison Operators

```tsx
{ where: { price: { $gt: 100 } } }     // greater than
{ where: { price: { $gte: 100 } } }    // greater than or equal
{ where: { price: { $lt: 50 } } }      // less than
{ where: { price: { $lte: 50 } } }     // less than or equal
{ where: { price: { $between: [10, 100] } } }  // inclusive range
```

### Combining Conditions

```tsx
// AND (multiple fields)
{ where: { category: 'tech', published: true } }
// OR (array of conditions)
{ where: { or: [{ category: 'tech' }, { category: 'life' }] } }
```

### Ownership Filter (`own`)

Filter docs by current user ownership in any public/auth query:

```tsx
// All my posts (even from public endpoint)
const myPosts = useQuery(api.blog.all, { where: { own: true } })
// My published posts only
const myPublished = useQuery(api.blog.all, { where: { published: true, own: true } })
// Single doc ownership check
const post = useQuery(api.blog.read, { id, own: true })  // null if not owner
```

| Query | Unauthenticated | Authenticated (owner) | Authenticated (not owner) |
|-------|-----------------|----------------------|---------------------------|
| `read({ id })` | Returns doc | Returns doc | Returns doc |
| `read({ id, own: true })` | `null` | Returns doc | `null` |
| `all({ where: { own: true } })` | `[]` | User's docs | User's docs |

`{ where: { own: true } }` automatically uses the `by_user` index for fast lookups. Works in both `pub` (returns `[]` for guests) and `auth` (requires login) queries. Combinable with other filters: `{ where: { own: true, published: true } }`.

## Relations

Owned tables automatically include author info via `withAuthor`:

```tsx
const posts = useQuery(api.blog.all)
// Each post has: { ...data, author: { name, email, ... }, own: boolean }
```

For custom relations in handlers:

```tsx
const bySlug = pq({
  args: { slug: z.string() },
  handler: async (c, { slug }) => {
    const doc = await c.db.query('blog')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .unique()
    if (!doc) return null
    const author = await c.db.get(doc.userId)
    return { ...doc, author }
  }
})
```

## Error Handling

### Error Codes

The CRUD factory throws typed errors via `ConvexError`:

| Code | Meaning |
|------|---------|
| `NOT_AUTHENTICATED` | User not logged in |
| `NOT_FOUND` | Doc doesn't exist or not owned |
| `NOT_AUTHORIZED` | No permission for action |
| `CONFLICT` | Concurrent edit detected |
| `INVALID_WHERE` | Invalid filter syntax |
| `RATE_LIMITED` | Too many requests |
| `FILE_TOO_LARGE` | File exceeds 10MB |
| `INVALID_FILE_TYPE` | File type not allowed |
| `EDITOR_REQUIRED` | ACL edit permission required |

### Frontend Error Handling

**Typed handler (recommended):**

```tsx
import { handleConvexError } from '@a/cv/f'
try {
  await create(data)
} catch (e) {
  handleConvexError(e, {
    NOT_AUTHENTICATED: () => router.push('/login'),
    CONFLICT: () => toast.error('Someone else edited this'),
    default: () => toast.error('Something went wrong')
  })
}
```

**Get error info:**

```tsx
import { getErrorCode, getErrorMessage, ERROR_MESSAGES } from '@a/cv/f'
try {
  await create(data)
} catch (e) {
  const code = getErrorCode(e)  // ErrorCode | undefined
  const msg = getErrorMessage(e)  // human-readable message
  if (code === 'NOT_AUTHENTICATED') router.push('/login')
  else toast.error(msg)
}
```

### Form Error Display

`<Form>` shows submit errors automatically. Override with `showError={false}` to handle manually.

## Organizations (Multi-Tenant)

*Skip this section if your app doesn't need multi-tenant org support.*

Tables can be user-owned OR org-scoped:

| Type | Factory | Scoping |
|------|---------|---------|
| User-private | `crud()` | `userId` only |
| Org-scoped | `orgCrud()` | `orgId` + membership |

### Define Org-Scoped Table

```tsx
// t.ts
orgScoped = {
  project: object({
    name: string().min(1),
    editors: array(zid('users')).max(100).optional(),
    status: zenum(['active', 'archived', 'completed']).optional()
  })
}
// schema.ts  
project: orgTable(orgScoped.project)
// convex/project.ts — with ACL + cascade delete tasks
const { addEditor, bulkRm, create, editors, list, read, removeEditor, rm, setEditors, update } = orgCrud(
  'project', orgScoped.project, { acl: true, cascade: orgCascade({ foreignKey: 'projectId', table: 'task' }) }
)
export { addEditor, bulkRm, create, editors, list, read, removeEditor, rm, setEditors, update }
```

**`orgCascade` helper**: Validates `foreignKey` against the child table's doc type and `table` against `TableNames`. A typo in either raises a type error. Import from `@a/cv/f`.

**`aclFrom` typing**: The `field` in `aclFrom: { field, table }` is typed against the current table's `Doc<T>`. A typo like `{ field: 'projectid', table: 'project' }` raises a type error.

### `orgCrud` Return Shape

```tsx
const {
  create, update, rm,             // mutations (membership required)
  list, read, all,                // queries (membership required)
  bulkUpdate, bulkRm,            // batch ops (admin only, max 100)
  // only when acl: true:
  addEditor, removeEditor,       // mutations (admin only)
  editors,                        // query (any member) → { userId, name, email }[]
  setEditors                      // mutation (admin only)
} = orgCrud('wiki', orgScoped.wiki, { acl: true })
```

Without `acl: true`, the editor endpoints are not returned.

### Permission Model

| Operation | Member (own) | Member (other's) | Editor (`acl: true`) | Admin | Owner |
|-----------|:------------:|:----------------:|:--------------------:|:-----:|:-----:|
| `create` | Y | - | - | Y | Y |
| `list` / `read` / `all` | Y | Y | Y | Y | Y |
| `update` | Y own | N | Y | Y any | Y any |
| `rm` | Y own | N | Y | Y any | Y any |
| `bulkUpdate` / `bulkRm` | N | N | N | Y | Y |
| `addEditor` / `removeEditor` / `setEditors` | N | N | N | Y | Y |

### Frontend Usage

```tsx
// Wrap org routes in layout
<OrgProvider membership={membership} org={org} role={role}>
  {children}
</OrgProvider>
// Use org context (inside /org/[slug]/*)
const { org, role, isAdmin, isOwner, canManageMembers } = useOrg()
// useOrgQuery auto-injects orgId, args optional, supports 'skip'
const projects = useOrgQuery(api.project.list, { paginationOpts: { cursor: null, numItems: 20 } })
const members = useOrgQuery(api.org.members)
// useOrgMutation auto-injects orgId, args optional
const remove = useOrgMutation(api.project.rm)
await remove({ id: projectId })
// Non-org queries/mutations still use raw useQuery/useMutation
const me = useQuery(api.user.me, {})
```

### Active Org (Cookie-Based)

Active org stored in cookie for SSR. OrgSwitcher can render anywhere.

```tsx
// Server component
const org = await getActiveOrg(token)
if (org) {
  const projects = await fetchQuery(api.project.list, { orgId: org._id, paginationOpts }, { token })
}
// Client component
const { activeOrg, setActiveOrg } = useActiveOrg()
```

### Roles

- `owner` — Stored as `org.userId`, full control
- `admin` — `orgMember.isAdmin = true`, manage members
- `member` — `orgMember.isAdmin = false`, read/write org data

Use `getOrgRole(org, userId, member)` to derive role.

### Org Helpers

```tsx
import { getOrgMember, getOrgRole, requireOrgMember, requireOrgRole } from '@a/cv'
// Pure derivation
const role = getOrgRole(org, userId, member) // 'owner' | 'admin' | 'member' | null
// Get membership record
const member = await getOrgMember(db, orgId, userId)
// Require membership (throws if not member)
const { org, member, role } = await requireOrgMember(db, orgId, userId)
// Require minimum role (throws if insufficient)
const { org, member, role } = await requireOrgRole({ db, orgId, userId, minRole: 'admin' })
```

## ACL (Editors)

Grant specific org members edit permission on individual items. Other members can only view.

### Enable ACL

Pass `acl: true` to `orgCrud` — this auto-generates `addEditor`, `removeEditor`, `editors` (query), and `setEditors` endpoints:

```tsx
// packages/cv/convex/wiki.ts — 3 lines for full CRUD + ACL
const { addEditor, all, create, editors, list, read, removeEditor, rm, setEditors, update } = orgCrud(
  'wiki', orgScoped.wiki, { acl: true }
)
export { addEditor, all, create, editors, list, read, removeEditor, rm, setEditors, update }
```

The `editors` field (`Id<'users'>[]`) must be in your schema:

```tsx
// t.ts
orgScoped = {
  wiki: object({
    title: string().min(1),
    editors: array(zid('users')).max(100).optional(),
    // ...other fields
  })
}
```

### Permission Hierarchy

| Role | Can Edit? |
|------|-----------|
| Org owner/admin | Always |
| Item creator | Always |
| In `editors[]` | Yes (when `acl: true`) |
| Regular member | View only |

### Auto-Generated ACL Endpoints

The item ID arg is named `${table}Id` (e.g., `projectId`, `wikiId`):

| Endpoint | Args | Access | Returns |
|----------|------|--------|---------|
| `addEditor` | `{ orgId, ${table}Id, editorId }` | Admin only | Updated doc |
| `removeEditor` | `{ orgId, ${table}Id, editorId }` | Admin only | Updated doc |
| `editors` | `{ orgId, ${table}Id }` | Any member | `{ userId, name, email }[]` |
| `setEditors` | `{ orgId, ${table}Id, editorIds }` | Admin only | Updated doc |

### Frontend Usage

```tsx
const editorsList = useOrgQuery(api.wiki.editors, { wikiId })
const addEditor = useOrgMutation(api.wiki.addEditor)
const removeEditor = useOrgMutation(api.wiki.removeEditor)

await addEditor({ wikiId, editorId: userId })
await removeEditor({ wikiId, editorId: userId })
```

### `EditorsSection` Component

Drop-in UI for managing editors on any ACL-enabled item. Shows current editors with remove buttons and a select dropdown to add new ones.

```tsx
import EditorsSection from '~/components/editors-section'

const editorsList = useOrgQuery(api.wiki.editors, { wikiId }) ?? []
const members = useOrgQuery(api.org.members)?.members ?? []
const addEditor = useOrgMutation(api.wiki.addEditor)
const removeEditor = useOrgMutation(api.wiki.removeEditor)

<EditorsSection
  editorsList={editorsList}
  members={members}
  onAdd={userId => addEditor({ wikiId, editorId: userId })}
  onRemove={userId => removeEditor({ wikiId, editorId: userId })}
/>
```

Works with any table — swap `wikiId`/`api.wiki.*` for `projectId`/`api.project.*`.

### `PermissionGuard` Component

Wraps edit pages with an ACL check. Shows a "View only" fallback when the user lacks edit permission.

```tsx
import PermissionGuard from '~/components/permission-guard'

const isCreator = doc.userId === me._id,
  isEditor = editorsList.some(e => e.userId === me._id),
  canEdit = isAdmin || isCreator || isEditor

<PermissionGuard
  backHref={`/org/${slug}/wiki/${wikiId}`}
  backLabel='wiki page'
  canAccess={canEdit}
  resource='wiki page'>
  <EditForm ... />
</PermissionGuard>
```

### `useBulkSelection` Hook

Manages bulk select + delete for org-scoped list pages. Generic over table type.

```tsx
import { useBulkSelection } from '~/hook/use-bulk-selection'

const bulkRm = useMutation(api.wiki.bulkRm)
const { clear, handleBulkDelete, selected, toggleSelect, toggleSelectAll } = useBulkSelection({
  bulkRm,
  items: wikis?.page ?? [],
  label: 'wiki page(s)',
  orgId: org._id
})
// selected: Set<Id<T>>, toggleSelect(id), toggleSelectAll(), handleBulkDelete(), clear()
```

### ACL Inheritance (`aclFrom`)

Child tables can inherit ACL from a parent. Tasks inherit project editors — a project editor can update/delete tasks in that project:

```tsx
// packages/cv/convex/task.ts
const { create, list, update, rm } = orgCrud('task', orgScoped.task, {
  aclFrom: { field: 'projectId', table: 'project' }
})
```

The factory looks up the parent doc via `field` and uses its `editors[]` for permission checks on `update` and `rm`. No ACL endpoints are generated for `aclFrom` tables (editors are managed on the parent).

### `canEdit` Helper (Custom Handlers)

```tsx
import { canEdit } from '@a/cv/f'
const allowed = canEdit({ acl: true, doc: { editors: project.editors, userId: project.userId }, role, userId })
```

## Org API Reference

```tsx
// Org management
api.org.create({ name, slug })
api.org.update({ orgId, name, slug })
api.org.get({ orgId })
api.org.getBySlug({ slug })
api.org.myOrgs
api.org.remove({ orgId })
// Membership
api.org.membership({ orgId })
api.org.members({ orgId })
api.org.setAdmin({ orgId, targetUserId, isAdmin })
api.org.removeMember({ orgId, targetUserId })
api.org.leave({ orgId })
api.org.transferOwnership({ orgId, targetUserId })
// Invites (7-day expiry, single-use)
api.org.invite({ orgId, email, isAdmin })
api.org.acceptInvite({ token })
api.org.revokeInvite({ inviteId })
api.org.pendingInvites({ orgId })
// Join requests
api.org.requestJoin({ orgId, message })
api.org.approveJoinRequest({ requestId })
api.org.rejectJoinRequest({ requestId })
api.org.pendingJoinRequests({ orgId })
```

## Known Limitations

### Where Clauses Use Runtime Filtering

Most `where` filtering (`$gt`, `$gte`, `$lt`, `$lte`, `$between`, `or`) uses Convex `.filter()` — runtime scan, not index lookup. Exception: `{ own: true }` automatically uses the `by_user` index. Fine for hundreds of docs. For high-volume tables (thousands+), use indexed queries.

**Runtime warnings**: `all()` and `count()` log a warning when results exceed 1,000 documents. `search()` logs a warning when falling back to full-text scan (no search index configured). Check server logs for `crud:large_result`, `crud:large_count`, and `crud:search_fallback`.

```tsx
// Slow on large tables: runtime scan
const expensive = useQuery(api.product.all, { where: { price: { $gte: 100 } } })
// Fast: uses index
const bySlug = useQuery(api.blog.pubIndexed, {
  index: 'by_slug',
  key: 'slug',
  value: 'my-post'
})
```

`pubIndexed` / `authIndexed` endpoints accept an `index` parameter for O(1) lookups.

### Generic Type Boundaries

CRUD factories use `as never` casts at the Zod ↔ Convex type boundary. Localized inside factory internals — consumer code is fully typesafe with no casts needed.

### Bulk Operations

`bulkUpdate` and `bulkRm` cap at 100 items per call. No built-in rate limiting on call frequency — add application-level throttling if needed for public-facing endpoints.

## Full Examples

Working implementations in the codebase — read these to see end-to-end patterns:

| Example | What it demonstrates | Files |
|---------|---------------------|-------|
| **Wiki** (simple ACL) | `orgCrud` + `acl: true`, editor management, PermissionGuard | `convex/wiki.ts`, `app/org/[slug]/wiki/` |
| **Project + Task** (ACL inheritance) | `acl: true` on parent, `aclFrom` on child, cascade delete | `convex/project.ts`, `convex/task.ts`, `app/org/[slug]/projects/` |
| **Blog** (owned CRUD) | `crud()` with search, soft delete–ready schema, custom `publish` mutation | `convex/blog.ts`, `app/crud/` |
| **Chat + Message** (child CRUD) | `childCrud()` with parent ownership, cascade delete | `convex/chat.ts`, `convex/message.ts`, `app/chat/` |
| **Movie** (cache) | `cacheCrud()` with TTL, external API fetcher | `convex/movie.ts`, `app/movies/` |

Shared frontend components for org pages:

| Component/Hook | Purpose |
|---------------|---------|
| `~/components/editors-section` | Drop-in editor management UI for any ACL-enabled item |
| `~/components/permission-guard` | Wraps edit pages with "view only" fallback |
| `~/hook/use-org` | `useOrg`, `useOrgQuery`, `useOrgMutation` — auto-inject `orgId` |
| `~/form` | `useForm`, `useFormMutation`, `Form` — schema-driven forms |
| `~/hook/use-bulk-selection` | Bulk select + delete for org-scoped list pages |
