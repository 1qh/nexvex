import type { paginationOptsValidator } from 'convex/server'
import type { z as _, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodRawShape } from 'zod/v4'

import type { Doc, Id, TableNames } from '../convex/_generated/dataModel'
import type { ActionCtx, DatabaseReader, QueryCtx } from '../convex/_generated/server'
import type { children } from '../t'

interface AuthCtx extends ReadCtx {
  user: Doc<'users'>
}
interface CacheOptions<
  T extends TableNames,
  S extends ZodRawShape,
  K extends keyof _.infer<ZodObject<S>> & keyof Doc<T> & string
> {
  fetcher?: (c: ActionCtx, key: Doc<T>[K]) => Promise<_.infer<ZodObject<S>>>
  key: K
  schema: ZodObject<S>
  table: T
  ttl?: number
}
type ChildMeta<T extends ChildTable = ChildTable> = (typeof children)[T]
type ChildTable = keyof typeof children
interface ComparisonOp<V> {
  /** Inclusive range: `{ $between: [10, 50] }` matches 10 <= value <= 50 */
  $between?: [V, V]
  /** Greater than: `{ $gt: 10 }` matches value > 10 */
  $gt?: V
  /** Greater than or equal: `{ $gte: 10 }` matches value >= 10 */
  $gte?: V
  /** Less than: `{ $lt: 10 }` matches value < 10 */
  $lt?: V
  /** Less than or equal: `{ $lte: 10 }` matches value <= 10 */
  $lte?: V
}
interface CrudOptions<S extends ZodRawShape> {
  auth?: { where?: WhereOf<S> }
  cascade?: boolean
  pub?: { where?: WhereOf<S> }
  softDelete?: boolean
}
type Data<T extends TableNames> = Omit<Doc<T>, '_creationTime' | '_id' | 'updatedAt' | 'userId'>
const ERROR_MESSAGES = {
  ALREADY_ORG_MEMBER: 'Already a member of this organization',
  CANNOT_MODIFY_ADMIN: 'Admins cannot modify other admins',
  CANNOT_MODIFY_OWNER: 'Cannot modify the owner',
  CHUNK_ALREADY_UPLOADED: 'Chunk already uploaded',
  CHUNK_NOT_FOUND: 'Chunk not found',
  CONFLICT: 'Conflict detected',
  EDITOR_REQUIRED: 'Editor permission required',
  FILE_NOT_FOUND: 'File not found',
  FILE_TOO_LARGE: 'File too large',
  FORBIDDEN: 'Forbidden',
  INCOMPLETE_UPLOAD: 'Incomplete upload',
  INSUFFICIENT_ORG_ROLE: 'Insufficient permissions',
  INVALID_FILE_TYPE: 'Invalid file type',
  INVALID_INVITE: 'Invalid invite',
  INVALID_MESSAGE: 'Invalid message',
  INVALID_SESSION_STATE: 'Invalid session state',
  INVALID_TOOL_ARGS: 'Invalid tool arguments',
  INVALID_WHERE: 'Invalid filters',
  INVITE_EXPIRED: 'Invite has expired',
  JOIN_REQUEST_EXISTS: 'Join request already exists',
  LIMIT_EXCEEDED: 'Limit exceeded',
  MESSAGE_NOT_SAVED: 'Message not saved',
  MUST_TRANSFER_OWNERSHIP: 'Must transfer ownership before leaving',
  NO_FETCHER: 'No fetcher configured',
  NO_PRECEDING_USER_MESSAGE: 'No preceding user message',
  NOT_AUTHENTICATED: 'Please log in',
  NOT_AUTHORIZED: 'Not authorized',
  NOT_FOUND: 'Not found',
  NOT_ORG_MEMBER: 'Not a member of this organization',
  ORG_SLUG_TAKEN: 'Organization slug already taken',
  RATE_LIMITED: 'Too many requests',
  SESSION_NOT_FOUND: 'Session not found',
  TARGET_MUST_BE_ADMIN: 'Can only transfer ownership to an admin',
  UNAUTHORIZED: 'Unauthorized',
  USER_NOT_FOUND: 'User not found'
} as const

interface CanEditOpts {
  acl: boolean
  doc: {
    editors?: Id<'users'>[]
    userId: Id<'users'>
  }
  role: 'admin' | 'member' | 'owner'
  userId: Id<'users'>
}
type ErrorCode = keyof typeof ERROR_MESSAGES
type FID = Id<'_storage'>
type OrgDoc<T extends TableNames> = Doc<T> & {
  orgId: Id<'org'>
  userId: Id<'users'>
}
type Own = { [K in TableNames]: Doc<K> extends { userId: Id<'users'> } ? K : never }[TableNames]
type OwnDoc<T extends TableNames> = Doc<T> & { userId: Id<'users'> }
type PaginationOptsShape = Record<keyof typeof paginationOptsValidator.fields, ZodNullable | ZodNumber | ZodOptional>
interface ReadCtx {
  db: DatabaseReader
  storage: QueryCtx['storage']
  viewerId: Id<'users'> | null
  withAuthor: <T extends WithUser>(
    docs: T[]
  ) => Promise<
    (T & {
      author: Doc<'users'> | null
      own: boolean | null
    })[]
  >
}
type UrlKey<K, V> =
  NonNullable<V> extends FID | FID[] | readonly FID[] ? `${K & string}Url${NonNullable<V> extends FID ? '' : 's'}` : never
type UrlVal<V> =
  NonNullable<V> extends FID | FID[] | readonly FID[]
    ? NonNullable<V> extends FID
      ? null | string
      : (null | string)[]
    : never
/** Exact match or comparison: `'tech'` | `{ $gte: 10 }` | `{ $between: [1, 100] }` */
type WhereFieldValue<V> = ComparisonOp<V> | V
/**
 * Single filter group. Each key matches a schema field.
 *
 * `{ title: 'hello', price: { $gte: 10 }, own: true }`
 */
type WhereGroupOf<S extends ZodRawShape> = {
  /** Filter to current user's records only */
  own?: boolean
} & {
  [K in keyof _.infer<ZodObject<S>>]?: WhereFieldValue<_.infer<ZodObject<S>>[K]>
}
/**
 * Full where clause with optional OR groups.
 *
 * `{ category: 'tech', or: [{ published: true }, { own: true }] }`
 */
type WhereOf<S extends ZodRawShape> = WhereGroupOf<S> & {
  /** OR conditions: at least one group must match */
  or?: WhereGroupOf<S>[]
}
type WithUrls<D> = D & { [K in keyof D as UrlKey<K, D[K]>]: UrlVal<D[K]> }
interface WithUser {
  userId: Id<'users'>
}

export type {
  AuthCtx,
  CacheOptions,
  CanEditOpts,
  ChildMeta,
  ChildTable,
  ComparisonOp,
  CrudOptions,
  Data,
  ErrorCode,
  FID,
  OrgDoc,
  Own,
  OwnDoc,
  PaginationOptsShape,
  ReadCtx,
  WhereGroupOf,
  WhereOf,
  WithUrls,
  WithUser
}
export { ERROR_MESSAGES }
