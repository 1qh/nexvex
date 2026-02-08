import type { GenericDatabaseWriter } from 'convex/server'

import { ConvexError, v } from 'convex/values'

import type { ErrorCode } from '../f/types'
import type { DataModel, Id } from './_generated/dataModel'

import { internal } from './_generated/api'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { getAuthUserIdOrTest, isTestMode } from './testauth'

const cvErr = (code: ErrorCode, message?: string) => new ConvexError(message ? { code, message } : { code }),
  ALLOWED_TYPES = new Set([
    'application/json',
    'application/msword',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp',
    'text/csv',
    'text/plain'
  ]),
  MAX_FILE_SIZE = 10 * 1024 * 1024,
  CHUNK_SIZE = 5 * 1024 * 1024,
  RATE_LIMIT_WINDOW = 60 * 1000,
  MAX_UPLOADS_PER_WINDOW = 10,
  validateFileType = async (
    storage: { delete: (id: string) => Promise<void> },
    id: string,
    contentType: string | undefined
  ) => {
    if (!ALLOWED_TYPES.has(contentType ?? '')) {
      await storage.delete(id)
      throw cvErr('INVALID_FILE_TYPE', `File type ${contentType} not allowed`)
    }
  },
  validateFileSize = async (storage: { delete: (id: string) => Promise<void> }, id: string, size: number) => {
    if (size > MAX_FILE_SIZE) {
      await storage.delete(id)
      throw cvErr('FILE_TOO_LARGE', `File size ${size} exceeds ${MAX_FILE_SIZE} bytes`)
    }
  },
  checkRateLimit = async (db: GenericDatabaseWriter<DataModel>, userId: Id<'users'>) => {
    const now = Date.now(),
      cutoff = now - RATE_LIMIT_WINDOW,
      recent = await db
        .query('uploadRateLimit')
        .withIndex('by_user', q => q.eq('userId', userId))
        .filter(q => q.gte(q.field('timestamp'), cutoff))
        .collect()
    if (recent.length >= MAX_UPLOADS_PER_WINDOW) throw cvErr('RATE_LIMITED')
    await db.insert('uploadRateLimit', { timestamp: now, userId })
    const old = await db
      .query('uploadRateLimit')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(q => q.lt(q.field('timestamp'), cutoff))
      .collect()
    await Promise.all(old.map(async r => db.delete(r._id)))
  },
  upload = mutation({
    handler: async c => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      if (!isTestMode) await checkRateLimit(c.db, userId)
      return c.storage.generateUploadUrl()
    }
  }),
  validate = mutation({
    args: { id: v.id('_storage') },
    handler: async (c, { id }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      const meta = await c.db.system.get(id)
      if (!meta) throw cvErr('FILE_NOT_FOUND')
      await validateFileType(c.storage, id, meta.contentType)
      await validateFileSize(c.storage, id, meta.size)
      return { contentType: meta.contentType, size: meta.size, valid: true }
    }
  }),
  info = query({
    args: { id: v.id('_storage') },
    handler: async (c, { id }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      const [meta, url] = await Promise.all([c.db.system.get(id), c.storage.getUrl(id)])
      return meta ? { ...meta, url } : null
    }
  }),
  startChunkedUpload = mutation({
    args: {
      contentType: v.string(),
      fileName: v.string(),
      totalChunks: v.number(),
      totalSize: v.number()
    },
    handler: async (c, { contentType, fileName, totalChunks, totalSize }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      if (!isTestMode) await checkRateLimit(c.db, userId)
      if (!ALLOWED_TYPES.has(contentType)) throw cvErr('INVALID_FILE_TYPE', `File type ${contentType} not allowed`)
      if (totalSize > MAX_FILE_SIZE) throw cvErr('FILE_TOO_LARGE', `File size ${totalSize} exceeds ${MAX_FILE_SIZE} bytes`)
      const uploadId = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`
      await c.db.insert('uploadSession', {
        completedChunks: 0,
        contentType,
        fileName,
        status: 'pending',
        totalChunks,
        totalSize,
        uploadId,
        userId
      })
      return { uploadId }
    }
  }),
  uploadChunk = mutation({
    args: {
      chunkIndex: v.number(),
      uploadId: v.string()
    },
    handler: async (c, { chunkIndex, uploadId }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      const session = await c.db
        .query('uploadSession')
        .withIndex('by_upload_id', q => q.eq('uploadId', uploadId))
        .unique()
      if (!session) throw cvErr('SESSION_NOT_FOUND')
      if (session.userId !== userId) throw cvErr('UNAUTHORIZED')
      if (session.status !== 'pending') throw cvErr('INVALID_SESSION_STATE')
      const existing = await c.db
        .query('uploadChunk')
        .withIndex('by_upload', q => q.eq('uploadId', uploadId))
        .filter(q => q.eq(q.field('chunkIndex'), chunkIndex))
        .unique()
      if (existing) throw cvErr('CHUNK_ALREADY_UPLOADED')
      return c.storage.generateUploadUrl()
    }
  }),
  confirmChunk = mutation({
    args: {
      chunkIndex: v.number(),
      storageId: v.id('_storage'),
      uploadId: v.string()
    },
    handler: async (c, { chunkIndex, storageId, uploadId }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      const session = await c.db
        .query('uploadSession')
        .withIndex('by_upload_id', q => q.eq('uploadId', uploadId))
        .unique()
      if (!session) throw cvErr('SESSION_NOT_FOUND')
      if (session.userId !== userId) throw cvErr('UNAUTHORIZED')
      await c.db.insert('uploadChunk', {
        chunkIndex,
        storageId,
        totalChunks: session.totalChunks,
        uploadId,
        userId
      })
      const chunks = await c.db
        .query('uploadChunk')
        .withIndex('by_upload', q => q.eq('uploadId', uploadId))
        .collect()
      await c.db.patch(session._id, {
        completedChunks: chunks.length
      })
      const allUploaded = chunks.length === session.totalChunks
      return {
        allUploaded,
        completedChunks: chunks.length,
        totalChunks: session.totalChunks
      }
    }
  }),
  getSessionForAssembly = internalQuery({
    args: { uploadId: v.string() },
    handler: async (c, { uploadId }) => {
      const session = await c.db
        .query('uploadSession')
        .withIndex('by_upload_id', q => q.eq('uploadId', uploadId))
        .unique()
      if (!session) return null
      const chunks = await c.db
        .query('uploadChunk')
        .withIndex('by_upload', q => q.eq('uploadId', uploadId))
        .collect()
      if (chunks.length !== session.totalChunks) throw cvErr('INCOMPLETE_UPLOAD')
      return { ...session, chunks }
    }
  }),
  finalizeAssembly = internalMutation({
    args: {
      chunkStorageIds: v.array(v.id('_storage')),
      finalStorageId: v.id('_storage'),
      uploadId: v.string()
    },
    handler: async (c, { chunkStorageIds, finalStorageId, uploadId }) => {
      const session = await c.db
        .query('uploadSession')
        .withIndex('by_upload_id', q => q.eq('uploadId', uploadId))
        .unique()
      if (!session) throw cvErr('SESSION_NOT_FOUND')
      await c.db.patch(session._id, { finalStorageId, status: 'completed' })
      const chunks = await c.db
        .query('uploadChunk')
        .withIndex('by_upload', q => q.eq('uploadId', uploadId))
        .collect()
      await Promise.all([
        ...chunkStorageIds.map(async id => c.storage.delete(id)),
        ...chunks.map(async chunk => c.db.delete(chunk._id))
      ])
    }
  }),
  assembleChunks = action({
    args: { uploadId: v.string() },
    handler: async (
      c,
      { uploadId }
    ): Promise<{
      contentType: string
      size: number
      storageId: string
    }> => {
      const session = await c.runQuery(internal.file.getSessionForAssembly, { uploadId })
      if (!session) throw cvErr('SESSION_NOT_FOUND')
      if (session.status !== 'pending') throw cvErr('INVALID_SESSION_STATE')
      const sortedChunks = session.chunks.toSorted(
          (a: { chunkIndex: number }, b: { chunkIndex: number }) => a.chunkIndex - b.chunkIndex
        ),
        chunkBlobs = await Promise.all(
          sortedChunks.map(async chunk => {
            const blob = await c.storage.get(chunk.storageId)
            if (!blob) throw cvErr('CHUNK_NOT_FOUND')
            return blob
          })
        ),
        combinedBlob = new Blob(chunkBlobs, { type: session.contentType }),
        finalStorageId = await c.storage.store(combinedBlob)
      await c.runMutation(internal.file.finalizeAssembly, {
        chunkStorageIds: sortedChunks.map(ch => ch.storageId),
        finalStorageId,
        uploadId
      })
      return { contentType: session.contentType, size: session.totalSize, storageId: finalStorageId }
    }
  }),
  cancelChunkedUpload = mutation({
    args: { uploadId: v.string() },
    handler: async (c, { uploadId }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      const session = await c.db
        .query('uploadSession')
        .withIndex('by_upload_id', q => q.eq('uploadId', uploadId))
        .unique()
      if (!session) throw cvErr('SESSION_NOT_FOUND')
      if (session.userId !== userId) throw cvErr('UNAUTHORIZED')
      const chunks = await c.db
        .query('uploadChunk')
        .withIndex('by_upload', q => q.eq('uploadId', uploadId))
        .collect()
      await Promise.all(chunks.map(async chunk => c.storage.delete(chunk.storageId)))
      await Promise.all(chunks.map(async chunk => c.db.delete(chunk._id)))
      await c.db.patch(session._id, { status: 'failed' })
      return { cancelled: true }
    }
  }),
  getUploadProgress = query({
    args: { uploadId: v.string() },
    handler: async (c, { uploadId }) => {
      const userId = await getAuthUserIdOrTest(c)
      if (!userId) throw cvErr('NOT_AUTHENTICATED')
      const session = await c.db
        .query('uploadSession')
        .withIndex('by_upload_id', q => q.eq('uploadId', uploadId))
        .unique()
      if (!session) return null
      if (session.userId !== userId) throw cvErr('UNAUTHORIZED')
      return {
        completedChunks: session.completedChunks,
        finalStorageId: session.finalStorageId,
        progress: Math.round((session.completedChunks / session.totalChunks) * 100),
        status: session.status,
        totalChunks: session.totalChunks
      }
    }
  })
export {
  assembleChunks,
  cancelChunkedUpload,
  CHUNK_SIZE,
  confirmChunk,
  finalizeAssembly,
  getSessionForAssembly,
  getUploadProgress,
  info,
  startChunkedUpload,
  upload,
  uploadChunk,
  validate
}
