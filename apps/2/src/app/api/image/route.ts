'use server'
import type { NextRequest } from 'next/server'
import type { Sharp } from 'sharp'

import { ConvexHttpClient } from 'convex/browser'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

import env from '~/env'

type Format = 'jpeg' | 'png' | 'webp'
interface FormatOpts {
  contentType: string
  format: Format | undefined
  quality: number
}
interface ProcessOptions {
  compress?: { quality?: number }
  format?: Format
  resize?: { fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'; height?: number; width?: number }
}
interface TransformOpts {
  contentType: string
  options: ProcessOptions | undefined
  pipeline: Sharp
  thumbnail: boolean
}
const IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']),
  isImageType = (contentType: string): boolean => IMAGE_TYPES.has(contentType),
  formatToMime: Record<Format, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  },
  getConvexClient = () => new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL),
  applyFormat = (pipeline: Sharp, { contentType, format, quality }: FormatOpts): Sharp => {
    if (format === 'jpeg') return pipeline.jpeg({ quality })
    if (format === 'png') return pipeline.png({ quality })
    if (format === 'webp') return pipeline.webp({ quality })
    const [, ext] = contentType.split('/')
    if (ext === 'jpeg' || ext === 'jpg') return pipeline.jpeg({ quality })
    if (ext === 'png') return pipeline.png({ quality })
    if (ext === 'webp') return pipeline.webp({ quality })
    return pipeline
  },
  applyTransforms = ({ contentType, options, pipeline, thumbnail }: TransformOpts): Sharp => {
    const quality = options?.compress?.quality ?? 80
    if (thumbnail) return pipeline.resize({ fit: 'cover', height: 200, width: 200 }).webp({ quality: 80 })
    let result = pipeline
    if (options?.resize)
      result = result.resize({
        fit: options.resize.fit ?? 'cover',
        height: options.resize.height,
        width: options.resize.width
      })
    if (options?.format || options?.compress)
      result = applyFormat(result, { contentType, format: options.format, quality })
    return result
  },
  fetchImage = async (
    storageId: string
  ): Promise<{ buffer: Buffer; contentType: string } | { error: string; status: number }> => {
    const client = getConvexClient(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      info = await client.query('file:info' as any, { id: storageId }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      url = info?.url as string | undefined
    if (!url) return { error: 'File not found', status: 404 }
    const response = await fetch(url)
    if (!response.ok) return { error: 'Failed to fetch image', status: 500 }
    const contentType = response.headers.get('content-type') ?? ''
    if (!isImageType(contentType)) return { error: 'Not an image file', status: 400 }
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType }
  },
  POST = async (req: NextRequest) => {
    try {
      const body = (await req.json()) as { options?: ProcessOptions; storageId: string; thumbnail?: boolean },
        { options, storageId, thumbnail } = body
      if (!storageId) return NextResponse.json({ error: 'storageId is required' }, { status: 400 })
      const result = await fetchImage(storageId)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      const { buffer, contentType } = result,
        pipeline = applyTransforms({ contentType, options, pipeline: sharp(buffer), thumbnail: thumbnail ?? false }),
        outputBuffer = await pipeline.toBuffer(),
        outputMime = thumbnail ? 'image/webp' : options?.format ? formatToMime[options.format] : contentType
      return new NextResponse(new Uint8Array(outputBuffer), {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Type': outputMime }
      })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Processing failed' }, { status: 500 })
    }
  }
export { POST }
