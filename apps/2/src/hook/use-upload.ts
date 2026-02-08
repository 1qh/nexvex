// oxlint-disable unicorn/prefer-add-event-listener
/* eslint-disable no-await-in-loop, max-statements */
// biome-ignore-all lint/performance/noAwaitInLoops: retry logic
'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'

import { sleep } from '../utils'

interface UploadOptions {
  retries?: number
  retryDelay?: number
}

type UploadResult =
  | { code: 'ABORTED' | 'INVALID_RESPONSE' | 'NETWORK' | 'URL'; ok: false }
  | { code: 'HTTP'; ok: false; status: number }
  | { ok: true; storageId: Id<'_storage'> }

const useUpload = (options?: UploadOptions) => {
  const { retries = 3, retryDelay = 1000 } = options ?? {},
    getUrl = useMutation(api.file.upload),
    [progress, setProgress] = useState(0),
    [uploading, setUploading] = useState(false),
    [attempt, setAttempt] = useState(0),
    xhr = useRef<null | XMLHttpRequest>(null),
    reset = () => {
      setUploading(false)
      setProgress(0)
      setAttempt(0)
    },
    uploadOnce = async (file: File): Promise<UploadResult> => {
      try {
        const url = await getUrl()
        // oxlint-disable-next-line promise/avoid-new
        return await new Promise(res => {
          const x = new XMLHttpRequest()
          xhr.current = x
          x.upload.onprogress = e => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100))
          x.onload = () => {
            if (x.status < 200 || x.status >= 300) return res({ code: 'HTTP', ok: false, status: x.status })
            try {
              const { storageId } = JSON.parse(x.responseText) as { storageId?: unknown }
              if (typeof storageId !== 'string') return res({ code: 'INVALID_RESPONSE', ok: false })
              setProgress(100)
              res({ ok: true, storageId: storageId as Id<'_storage'> })
            } catch {
              res({ code: 'INVALID_RESPONSE', ok: false })
            }
          }
          x.onerror = () => res({ code: 'NETWORK', ok: false })
          x.onabort = () => res({ code: 'ABORTED', ok: false })
          x.open('POST', url)
          x.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
          x.send(file)
        })
      } catch {
        return { code: 'URL', ok: false }
      }
    },
    upload = async (file: File): Promise<UploadResult> => {
      setUploading(true)
      setProgress(0)
      setAttempt(0)

      try {
        for (let i = 0; i < retries; i += 1) {
          setAttempt(i + 1)
          const result = await uploadOnce(file)
          if (result.ok || result.code === 'ABORTED') return result
          if (i < retries - 1) await sleep(retryDelay * (i + 1))
        }
        return { code: 'NETWORK', ok: false }
      } finally {
        setUploading(false)
      }
    }
  return {
    attempt,
    cancel: () => {
      xhr.current?.abort()
      reset()
    },
    isUploading: uploading,
    progress,
    reset,
    upload
  }
}

export default useUpload
