# lazyconvex

Zod schema → fullstack app. One schema, zero boilerplate.

Define a Zod schema once → authenticated CRUD endpoints, typesafe forms with file upload, real-time queries, pagination, search, conflict detection, soft delete, rate limiting, org multi-tenancy with ACL — all generated. Ship a production app in minutes, not days.

```tsx
// 3 lines. Authenticated CRUD with file handling, pagination, search, ownership checks.
const { create, pub, rm, update } = crud('blog', owned.blog)
export const { list, read, search } = pub
export { create, rm, update }
```

## What you get from one Zod schema

| Feature | Lines of code |
|---------|:---:|
| CRUD mutations (create/update/delete) with auth + ownership | 0 |
| Public & auth-gated queries (list/read/search) | 0 |
| Pagination with cursor-based infinite scroll | 0 |
| File upload with auto-cleanup, compression, URL resolution | 0 |
| Typesafe forms with Zod validation + auto-generated fields | 0 |
| Conflict detection + resolution dialog | 0 |
| Soft delete + undo toast (Gmail/Linear pattern) | 0 |
| Bulk operations (select all, bulk delete) | 0 |
| Rate limiting on mutations | 0 |
| Where clauses ($gt, $lt, $between, OR, own filter) | 0 |
| Org multi-tenancy with roles + ACL + invites + join requests | 0 |
| Optimistic mutations with auto-rollback | 0 |
| Auto-save with debounce + indicator | 0 |
| Async validation (e.g. unique slug check) | 0 |
| Navigation guard (unsaved changes warning) | 0 |
| External API cache with TTL + auto-refresh | 0 |

## Install

```bash
bun add lazyconvex
```

## 5-Minute Setup

### 1. Define schemas with Zod

> [Real example: packages/be/t.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/t.ts)

```tsx
import { cvFile, cvFiles } from 'lazyconvex/schema'
import { array, boolean, object, string, enum as zenum } from 'zod/v4'

const owned = {
  blog: object({
    title: string().min(1),
    content: string().min(3),
    category: zenum(['tech', 'life', 'tutorial']),
    published: boolean(),
    coverImage: cvFile().nullable().optional(),
    attachments: cvFiles().max(5).optional(),
    tags: array(string()).max(5).optional()
  })
}
```

Every field name, every constraint, every type — defined once, enforced everywhere (backend validation, frontend form, TypeScript types). A typo like `titl` raises a compile error.

### 2. Register tables

> [Real example: packages/be/convex/schema.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/schema.ts)

```tsx
import { defineSchema } from 'convex/server'
import { orgTable, orgTables, ownedTable, rateLimitTable, uploadTables } from 'lazyconvex/server'

export default defineSchema({
  ...uploadTables(),
  ...rateLimitTable(),
  blog: ownedTable(owned.blog),
})
```

### 3. Initialize

> [Real example: packages/be/lazy.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/lazy.ts)

```tsx
import { setup } from 'lazyconvex/server'

const { crud, orgCrud, childCrud, cacheCrud, uniqueCheck, pq, q, m } = setup({
  query, mutation, action, internalQuery, internalMutation,
  getAuthUserId,
})
```

### 4. Generate endpoints

> [Real example: packages/be/convex/blog.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/blog.ts)

```tsx
export const {
  bulkRm, bulkUpdate, create,
  pub: { list, read, search },
  rm, update
} = crud('blog', owned.blog, { rateLimit: { max: 10, window: 60_000 }, search: { field: 'content' } })
```

That's it. You now have 8 fully typed, authenticated, rate-limited endpoints.

### 5. Use in React

```tsx
const { items: blogs, loadMore } = useList(api.blog.list, { where: { published: true } })
const drafts = usePaginatedQuery(api.blog.list, { where: { own: true, published: false } }, { initialNumItems: 20 })
```

## Typesafe Forms

Forms are auto-generated from your Zod schema. Field components (`Text`, `Num`, `Choose`, `Toggle`, `File`, `Files`, `Arr`, `Datepick`, `Combobox`, etc.) are type-checked — `name='titl'` is a compile error.

> [Real example: apps/blog/src/app/common.tsx — Create dialog](https://github.com/1qh/lazyconvex/blob/main/apps/blog/src/app/common.tsx)

```tsx
const form = useForm({
  schema: createBlog,
  onSubmit: async d => { await create({ ...d, published: false }); return d },
  onSuccess: () => toast.success('Created'),
})

<Form form={form} render={({ Text, Choose, File, Files, Arr, Submit }) => (
  <>
    <Text name='title' label='Title' />
    <Choose name='category' label='Category' />
    <Text name='content' label='Content' multiline />
    <File name='coverImage' label='Cover Image' accept='image/*' />
    <Files name='attachments' label='Attachments' />
    <Arr name='tags' label='Tags' transform={s => s.toLowerCase()} />
    <Submit>Create</Submit>
  </>
)} />
```

### Edit forms with `useFormMutation`

> [Real example: apps/org/src/app/wiki/\[wikiId\]/edit/page.tsx](https://github.com/1qh/lazyconvex/blob/main/apps/org/src/app/wiki/%5BwikiId%5D/edit/page.tsx)

```tsx
const form = useFormMutation({
  mutation: api.wiki.update,
  schema: orgScoped.wiki,
  values: wiki ? pickValues(orgScoped.wiki, wiki) : undefined,
  transform: d => ({ ...d, id: wikiId, orgId: org._id }),
  onSuccess: () => toast.success('Updated'),
})
```

`pickValues` extracts schema-matching fields from an existing doc. Empty optional strings auto-coerce to `undefined`.

### Conflict detection

```tsx
onSubmit: d => update({ id, ...d, expectedUpdatedAt: doc?.updatedAt })
```

If another user edited the record, a conflict dialog appears with Cancel / Reload / Overwrite options.

### Auto-save

```tsx
const form = useForm({
  schema: owned.blog,
  onSubmit: d => update({ id, ...d }),
  autoSave: { enabled: true, debounceMs: 1000 }
})
<AutoSaveIndicator lastSaved={form.lastSaved} />
```

### Async validation

```tsx
export const isSlugAvailable = uniqueCheck(orgScoped.wiki, 'wiki', 'slug')


<Text name='slug' asyncValidate={async v => {
  const ok = await isSlugAvailable({ value: v, exclude: id })
  return ok ? undefined : 'Slug already taken'
}} asyncDebounceMs={500} />
```

## File Upload

`cvFile()` for single file, `cvFiles()` for arrays. Everything is automatic:

- Image compression (max 1920px, 0.8 quality) — disable with `compressImg={false}`
- Auto-cleanup on doc update/delete (orphaned files removed)
- URL resolution — `photo` (storage ID) → `photoUrl` (URL string) in query results
- Rate limited (10 uploads/min), max 10MB per file

## Soft Delete + Undo Toast

> [Real example: apps/org/src/app/wiki/page.tsx — bulk delete with undo](https://github.com/1qh/lazyconvex/blob/main/apps/org/src/app/wiki/page.tsx)

```tsx
const { remove } = useSoftDelete({
  rm: useOrgMutation(api.wiki.rm),
  restore: useOrgMutation(api.wiki.restore),
  toast, label: 'wiki page',
})
await remove({ id: wikiId }) // Shows "Wiki page deleted" toast with Undo button
```

Bulk version:

```tsx
const { handleBulkDelete, selected, toggleSelect } = useBulkSelection({
  bulkRm: useMutation(api.wiki.bulkRm),
  items: wikis?.page ?? [],
  orgId: org._id,
  restore: useOrgMutation(api.wiki.restore),
  toast, undoLabel: 'wiki page',
})
```

Enable soft delete on any table by adding `deletedAt: number().optional()` to the schema and `softDelete: true` to the factory:

```tsx
orgCrud('wiki', orgScoped.wiki, { acl: true, softDelete: true })
```

## Optimistic Mutations

> [Real example: apps/blog/src/app/common.tsx — Delete component](https://github.com/1qh/lazyconvex/blob/main/apps/blog/src/app/common.tsx)

```tsx
const { execute, isPending } = useOptimisticMutation({
  mutation: api.blog.rm,
  onOptimistic: () => onOptimisticRemove?.(),
  onRollback: () => toast.error('Failed to delete'),
  onSuccess: () => toast.success('Deleted'),
})
```

## Data Fetching

```tsx
const { items: mine, loadMore, isDone } = useList(api.blog.list, { where: { own: true } })
const published = usePaginatedQuery(api.blog.list, { where: { published: true } }, { initialNumItems: 20 })
const expensive = usePaginatedQuery(api.product.list, { where: { price: { $gte: 100 } } }, { initialNumItems: 20 })
const either = usePaginatedQuery(api.blog.list, { where: { or: [{ category: 'tech' }, { category: 'life' }] } }, { initialNumItems: 20 })
```

`{ own: true }` uses the `by_user` index automatically. Default where clauses can be set at the factory level:

```tsx
crud('blog', owned.blog, { pub: { where: { published: true } } })
```

### Search configuration

Search is generated only when `search` is configured on `crud(...)`. By default, `search: 'index'` uses a search index named `search_field` on a field called `text`:

```tsx
crud('blog', owned.blog, { search: 'index' })
```

To customize the field name or index name:

```tsx
crud('blog', owned.blog, { search: { field: 'content', index: 'search_field' } })
```

Both `field` and `index` default to `'text'` and `'search_field'` respectively when omitted.

You must add a matching `searchIndex` to your schema table.

## Rate Limiting

Built-in sliding window rate limiting on mutations:

```tsx
crud('blog', owned.blog, { rateLimit: { max: 10, window: 60_000 } })
```

`max` requests per `window` (ms) per authenticated user. Uses a single-row sliding window counter per user+table (no write amplification). Returns `RATE_LIMITED` error code when exceeded. Requires `...rateLimitTable()` in schema.

## External API Cache

> [Real example: packages/be/convex/movie.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/movie.ts)

```tsx
const c = cacheCrud({
  table: 'movie', schema: base.movie, key: 'tmdb_id',
  fetcher: async (_, tmdbId) => {
    const { id, ...rest } = await tmdb(`/movie/${tmdbId}`, {}).json<TmdbMovie>()
    return { ...rest, tmdb_id: id }
  },
  rateLimit: { max: 30, window: 60_000 },
})
export const { all, get, load, refresh, invalidate, purge } = c
```

`load` returns cached or fetches. `refresh` force-refreshes. `purge` cleans expired entries.

## Child CRUD

> [Real example: packages/be/convex/message.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/message.ts)

```tsx
const children = {
  message: child({ parent: 'chat', foreignKey: 'chatId', parentSchema: owned.chat, schema: messageSchema })
}
export const { create, list, update } = childCrud('message', children.message)
```

Parent ownership verified automatically. Cascade delete included by default — deleting a chat removes all messages.

### Public access for child resources

Pass `pub` to generate unauthenticated `pub.list` and `pub.get` queries. Access is gated on a boolean field from the parent schema:

```tsx
const ops = childCrud('message', children.message, { pub: { parentField: 'isPublic' } })
export const { list: pubList, get: pubGet } = ops.pub
```

`pub.list` and `pub.get` check that the parent document's `isPublic` field is `true` before returning data.

## Organizations

Full multi-tenant system with roles, invites, join requests, and per-item ACL.

### One line for org-scoped CRUD

> [Real example: packages/be/convex/wiki.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/wiki.ts)

```tsx
export const { addEditor, bulkRm, create, editors, list, read,
  removeEditor, restore, rm, setEditors, update
} = orgCrud('wiki', orgScoped.wiki, { acl: true, softDelete: true })
```

### ACL (per-item editor permissions)

Pass `acl: true` → get `addEditor`, `removeEditor`, `setEditors`, `editors` endpoints. Add `editors: array(zid('users')).optional()` to schema.

| Role | Can edit? |
|------|-----------|
| Org owner/admin | Always |
| Item creator | Always (own docs) |
| In `editors[]` | Yes |
| Regular member | View only |

Child tables inherit ACL from parents:

```tsx
orgCrud('task', orgScoped.task, { aclFrom: { field: 'projectId', table: 'project' } })
```

### Cascade delete

> [Real example: packages/be/convex/project.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/project.ts)

```tsx
orgCrud('project', orgScoped.project, {
  acl: true,
  cascade: orgCascade(orgScoped.task, { foreignKey: 'projectId', table: 'task' })
})
```

Both `foreignKey` and `table` are type-checked — typos are compile errors.

### Frontend org hooks

```tsx
const { useOrg, useActiveOrg, useMyOrgs } = createOrgHooks(api.org)

<OrgProvider membership={membership} org={org} role={role}>
  {children}
</OrgProvider>

const { org, role, isAdmin, isOwner } = useOrg()
const projects = useOrgQuery(api.project.list, { paginationOpts: { cursor: null, numItems: 20 } })
const remove = useOrgMutation(api.project.rm)
await remove({ id: projectId }) // orgId auto-injected
```

### Org API

Management: `create`, `update`, `get`, `getBySlug`, `myOrgs`, `remove`
Membership: `membership`, `members`, `setAdmin`, `removeMember`, `leave`, `transferOwnership`
Invites: `invite`, `acceptInvite`, `revokeInvite`, `pendingInvites`
Join requests: `requestJoin`, `approveJoinRequest`, `rejectJoinRequest`, `pendingJoinRequests`

### Pre-built components

```tsx
import { EditorsSection, PermissionGuard, OrgAvatar, RoleBadge, OfflineIndicator } from 'lazyconvex/components'
```

> [Real example: apps/org/src/app/wiki/\[wikiId\]/edit/page.tsx — PermissionGuard + EditorsSection](https://github.com/1qh/lazyconvex/blob/main/apps/org/src/app/wiki/%5BwikiId%5D/edit/page.tsx)

## Custom Queries

When CRUD isn't enough:

```tsx
// pq = public query, q = auth query, m = auth mutation
const bySlug = pq({
  args: { slug: z.string() },
  handler: async (c, { slug }) => {
    const doc = await c.db.query('blog').withIndex('by_slug', q => q.eq('slug', slug)).unique()
    return doc ? (await c.withAuthor([doc]))[0] : null
  }
})
```

## Error Handling

| Code | Meaning |
|------|---------|
| `NOT_AUTHENTICATED` | Not logged in |
| `NOT_FOUND` | Doesn't exist or not owned |
| `NOT_AUTHORIZED` | No permission |
| `CONFLICT` | Concurrent edit detected |
| `RATE_LIMITED` | Too many requests |
| `EDITOR_REQUIRED` | ACL edit permission required |

```tsx
import { handleConvexError } from 'lazyconvex/server'

handleConvexError(error, {
  NOT_AUTHENTICATED: () => router.push('/login'),
  CONFLICT: () => toast.error('Someone else edited this'),
  default: () => toast.error('Something went wrong')
})
```

## Table Types

| Type | Factory | Use Case |
|------|---------|----------|
| `owned` | `crud()` | User-owned data (has `userId`) |
| `orgScoped` | `orgCrud()` | Org-scoped data (membership check) |
| `children` | `childCrud()` | Nested under parent (e.g. messages in chat) |
| `base` | `cacheCrud()` | External API cache with TTL |

## Demo Apps

4 demo apps showing every feature in production-like code:

| App | Features | Code |
|-----|----------|------|
| [Movie](https://github.com/1qh/lazyconvex/tree/main/apps/movie) | Cache factory, TMDB integration, no-auth | [packages/be/convex/movie.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/movie.ts) |
| [Blog](https://github.com/1qh/lazyconvex/tree/main/apps/blog) | Owned CRUD, forms, file upload, optimistic deletes, pagination | [packages/be/convex/blog.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/blog.ts) |
| [Chat](https://github.com/1qh/lazyconvex/tree/main/apps/chat) | Child CRUD, public/auth split, AI streaming | [packages/be/convex/chat.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/chat.ts) |
| [Org](https://github.com/1qh/lazyconvex/tree/main/apps/org) | Org multi-tenancy, ACL, soft delete, bulk ops, invites | [packages/be/convex/wiki.ts](https://github.com/1qh/lazyconvex/blob/main/packages/be/convex/wiki.ts) |

## Imports

| Module | Key Exports |
|--------|------------|
| `lazyconvex/server` | `setup`, `ownedTable`, `orgTable`, `baseTable`, `orgChildTable`, `orgTables`, `uploadTables`, `rateLimitTable`, `orgCascade`, `canEdit`, `getOrgMember`, `getOrgRole`, `requireOrgMember`, `requireOrgRole`, `handleConvexError`, `getErrorCode`, `getErrorMessage`, `makeOrg`, `makeFileUpload`, `makeTestAuth` |
| `lazyconvex/react` | `createOrgHooks`, `useForm`, `useFormMutation`, `useList`, `useOptimisticMutation`, `useSoftDelete`, `useUpload`, `useBulkSelection`, `useOnlineStatus`, `OrgProvider`, `useOrg`, `useOrgQuery`, `useOrgMutation`, `canEditResource` |
| `lazyconvex/components` | `Form`, `EditorsSection`, `PermissionGuard`, `OfflineIndicator`, `OrgAvatar`, `RoleBadge`, `AutoSaveIndicator`, `ConflictDialog`, `FileApiProvider` |
| `lazyconvex/schema` | `child`, `cvFile`, `cvFiles`, `orgSchema` |
| `lazyconvex/zod` | `pickValues`, `defaultValues`, `enumToOptions` |
| `lazyconvex/next` | `getActiveOrg`, `setActiveOrgCookie`, `clearActiveOrgCookie`, `getToken`, `isAuthenticated`, `makeImageRoute` |
| `lazyconvex/retry` | `withRetry`, `fetchWithRetry` |

## Known Limitations

- **Where clauses use runtime filtering** — `$gt`, `$lt`, `$between`, `or` use `.filter()`, not index lookups. Fine for <1,000 docs. For high-volume tables, use `pubIndexed`/`authIndexed` with Convex indexes.
- **Search requires schema index setup** — define `search` in `crud(...)` and add a matching `searchIndex` to the table schema.
- **Bulk operations cap at 100 items** per call.
- **CRUD factories use `as never` casts** at the Zod↔Convex type boundary internally. Consumer code is fully typesafe.
