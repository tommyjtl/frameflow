import type { ImportPlatform } from '../types'

const MAX_URL_LENGTH = 2048

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

export class ImportUrlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportUrlValidationError'
  }
}

export function validateImportUrl(rawUrl: string): {
  url: string
  platform: ImportPlatform
} {
  const trimmed = rawUrl.trim()

  if (!trimmed) {
    throw new ImportUrlValidationError('URL is required.')
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ImportUrlValidationError('URL is too long.')
  }

  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ImportUrlValidationError('Enter a valid URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ImportUrlValidationError('Only HTTP and HTTPS URLs are supported.')
  }

  const host = parsed.hostname.toLowerCase()

  if (YOUTUBE_HOSTS.has(host)) {
    return { url: parsed.toString(), platform: 'youtube' }
  }

  throw new ImportUrlValidationError('Only YouTube URLs are supported.')
}
