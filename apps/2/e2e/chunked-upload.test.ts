/* eslint-disable max-statements, no-await-in-loop, jest/no-conditional-in-test */
/** biome-ignore-all lint/performance/useTopLevelRegex: E2E test patterns */
import { expect, test } from './fixtures'
import { login, testConvex } from './helpers'

const CHUNK_SIZE = 5 * 1024 * 1024

test.describe('Chunked Upload', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('chunked upload flow completes successfully with 2 chunks', async () => {
    const fileName = 'test-large-file.png',
      contentType = 'image/png',
      totalSize = 6 * 1024 * 1024,
      totalChunks = Math.ceil(totalSize / CHUNK_SIZE)

    expect(totalChunks).toBe(2)

    const startResult = await testConvex.mutation('file:startChunkedUpload' as never, {
      contentType,
      fileName,
      totalChunks,
      totalSize
    })

    expect(startResult).toHaveProperty('uploadId')
    const { uploadId } = startResult as { uploadId: string }
    expect(uploadId).toBeTruthy()

    for (let i = 0; i < totalChunks; i += 1) {
      const chunkSize: number = i === 0 ? CHUNK_SIZE : totalSize - CHUNK_SIZE,
        chunkData = new Uint8Array(chunkSize).fill(i + 1),
        uploadUrl = await testConvex.mutation('file:uploadChunk' as never, {
          chunkIndex: i,
          uploadId
        })

      expect(uploadUrl).toBeTruthy()

      const uploadResponse = await fetch(uploadUrl as string, {
        body: new Blob([chunkData], { type: 'image/png' }),
        method: 'POST'
      })

      expect(uploadResponse.ok).toBe(true)
      const { storageId } = (await uploadResponse.json()) as { storageId: string }

      const confirmResult = await testConvex.mutation('file:confirmChunk' as never, {
        chunkIndex: i,
        storageId,
        uploadId
      })

      expect(confirmResult).toHaveProperty('completedChunks')
      expect((confirmResult as { completedChunks: number }).completedChunks).toBe(i + 1)
      expect((confirmResult as { totalChunks: number }).totalChunks).toBe(totalChunks)
    }

    const progress = await testConvex.query('file:getUploadProgress' as never, { uploadId })

    expect(progress).toHaveProperty('completedChunks', totalChunks)
    expect(progress).toHaveProperty('progress', 100)
    expect(progress).toHaveProperty('status', 'pending')

    const assembleResult = await testConvex.action('file:assembleChunks' as never, { uploadId })

    expect(assembleResult).toHaveProperty('storageId')
    expect(assembleResult).toHaveProperty('contentType', contentType)
    expect(assembleResult).toHaveProperty('size', totalSize)

    const finalProgress = await testConvex.query('file:getUploadProgress' as never, { uploadId })

    expect(finalProgress).toHaveProperty('status', 'completed')
    expect(finalProgress).toHaveProperty('finalStorageId')
  })

  test('chunked upload can be cancelled mid-progress', async () => {
    const fileName = 'test-cancel-file.png',
      contentType = 'image/png',
      totalSize = 6 * 1024 * 1024,
      totalChunks = 2

    const startResult = await testConvex.mutation('file:startChunkedUpload' as never, {
      contentType,
      fileName,
      totalChunks,
      totalSize
    })

    const { uploadId } = startResult as { uploadId: string }

    const chunkData = new Uint8Array(CHUNK_SIZE).fill(1),
      uploadUrl = await testConvex.mutation('file:uploadChunk' as never, {
        chunkIndex: 0,
        uploadId
      })

    const uploadResponse = await fetch(uploadUrl as string, {
      body: new Blob([chunkData], { type: 'image/png' }),
      method: 'POST'
    })

    const { storageId } = (await uploadResponse.json()) as { storageId: string }
    await testConvex.mutation('file:confirmChunk' as never, {
      chunkIndex: 0,
      storageId,
      uploadId
    })

    const cancelResult = await testConvex.mutation('file:cancelChunkedUpload' as never, { uploadId })

    expect(cancelResult).toHaveProperty('cancelled', true)

    const progress = await testConvex.query('file:getUploadProgress' as never, { uploadId })

    expect(progress).toHaveProperty('status', 'failed')
  })

  test('chunked upload rejects duplicate chunk uploads', async () => {
    const fileName = 'test-duplicate-chunk.png',
      contentType = 'image/png',
      totalSize = 6 * 1024 * 1024,
      totalChunks = 2

    const startResult = await testConvex.mutation('file:startChunkedUpload' as never, {
      contentType,
      fileName,
      totalChunks,
      totalSize
    })

    const { uploadId } = startResult as { uploadId: string }

    const chunkData = new Uint8Array(CHUNK_SIZE).fill(1),
      uploadUrl = await testConvex.mutation('file:uploadChunk' as never, {
        chunkIndex: 0,
        uploadId
      })

    const uploadResponse = await fetch(uploadUrl as string, {
      body: new Blob([chunkData], { type: 'image/png' }),
      method: 'POST'
    })

    const { storageId } = (await uploadResponse.json()) as { storageId: string }
    await testConvex.mutation('file:confirmChunk' as never, {
      chunkIndex: 0,
      storageId,
      uploadId
    })

    await expect(
      testConvex.mutation('file:uploadChunk' as never, {
        chunkIndex: 0,
        uploadId
      })
    ).rejects.toThrow(/CHUNK_ALREADY_UPLOADED/)
  })

  test('chunked upload validates file type', async () => {
    const fileName = 'malicious.exe',
      contentType = 'application/x-msdownload',
      totalSize = 6 * 1024 * 1024,
      totalChunks = 2

    await expect(
      testConvex.mutation('file:startChunkedUpload' as never, {
        contentType,
        fileName,
        totalChunks,
        totalSize
      })
    ).rejects.toThrow(/INVALID_FILE_TYPE/)
  })

  test('chunked upload validates file size limit', async () => {
    const fileName = 'too-large.png',
      contentType = 'image/png',
      totalSize = 20 * 1024 * 1024,
      totalChunks = 4

    await expect(
      testConvex.mutation('file:startChunkedUpload' as never, {
        contentType,
        fileName,
        totalChunks,
        totalSize
      })
    ).rejects.toThrow(/FILE_TOO_LARGE/)
  })

  test('chunked upload tracks progress correctly', async () => {
    const fileName = 'progress-test.png',
      contentType = 'image/png',
      totalSize = 6 * 1024 * 1024,
      totalChunks = 2

    const startResult = await testConvex.mutation('file:startChunkedUpload' as never, {
      contentType,
      fileName,
      totalChunks,
      totalSize
    })

    const { uploadId } = startResult as { uploadId: string }

    let progress = await testConvex.query('file:getUploadProgress' as never, { uploadId })

    expect(progress).toHaveProperty('completedChunks', 0)
    expect(progress).toHaveProperty('progress', 0)

    const chunkData = new Uint8Array(CHUNK_SIZE).fill(1),
      uploadUrl = await testConvex.mutation('file:uploadChunk' as never, {
        chunkIndex: 0,
        uploadId
      })

    const uploadResponse = await fetch(uploadUrl as string, {
      body: new Blob([chunkData], { type: 'image/png' }),
      method: 'POST'
    })

    const { storageId } = (await uploadResponse.json()) as { storageId: string }
    await testConvex.mutation('file:confirmChunk' as never, {
      chunkIndex: 0,
      storageId,
      uploadId
    })

    progress = await testConvex.query('file:getUploadProgress' as never, { uploadId })
    expect(progress).toHaveProperty('completedChunks', 1)
    expect(progress).toHaveProperty('progress', 50)

    await testConvex.mutation('file:cancelChunkedUpload' as never, { uploadId })
  })
})
