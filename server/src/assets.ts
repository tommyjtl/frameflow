import path from 'node:path'
import type { AssetKind } from './types'

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
}

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
}

const VIDEO_EXT_TO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
}

const IMAGE_EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

export type ValidatedAsset = {
  kind: AssetKind
  mimeType: string
  extension: string
}

export function validateUploadedFile(file: File): ValidatedAsset {
  const ext = path.extname(file.name).toLowerCase()
  const mime = file.type.toLowerCase()

  if (VIDEO_MIME_TO_EXT[mime] || VIDEO_EXT_TO_MIME[ext]) {
    const extension = VIDEO_MIME_TO_EXT[mime] ?? ext
    const mimeType = mime || VIDEO_EXT_TO_MIME[ext]

    if (!mimeType || !extension) {
      throw new AssetValidationError('Unsupported video format. Use .mp4 or .mov.')
    }

    return { kind: 'video', mimeType, extension }
  }

  if (IMAGE_MIME_TO_EXT[mime] || IMAGE_EXT_TO_MIME[ext]) {
    const extension = IMAGE_MIME_TO_EXT[mime] ?? ext
    const mimeType = mime || IMAGE_EXT_TO_MIME[ext]

    if (!mimeType || !extension) {
      throw new AssetValidationError(
        'Unsupported image format. Use JPEG, PNG, WebP, GIF, AVIF, or SVG.',
      )
    }

    return { kind: 'image', mimeType, extension }
  }

  throw new AssetValidationError(
    'Unsupported file type. Video: .mp4, .mov. Image: JPEG, PNG, WebP, GIF, AVIF, SVG.',
  )
}

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetValidationError'
  }
}

export function assetFileName(id: string, extension: string): string {
  return `${id}${extension}`
}

export function assetUrl(id: string, extension: string): string {
  return `/assets/${assetFileName(id, extension)}`
}
