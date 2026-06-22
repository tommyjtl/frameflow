export type AssetKind = 'video' | 'image'

export type NodeKind = 'video' | 'image' | 'drawing' | 'text'

export type AssetRecord = {
  id: string
  mimeType: string
  extension: string
  originalName: string | null
  kind: AssetKind
  createdAt: string
  url: string
}

export type BoardNodeRecord = {
  id: string
  kind: NodeKind
  assetId: string | null
  label: string
  positionX: number
  positionY: number
  width: number
  height: number
  meta: Record<string, unknown> | null
}

export type BoardEdgeRecord = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  kind: string | null
  meta: Record<string, unknown> | null
}

export type BoardPayload = {
  nodes: BoardNodeRecord[]
  edges: BoardEdgeRecord[]
}

export type BoardResponse = BoardPayload & {
  assets: AssetRecord[]
}

export type AssetUploadResponse = {
  asset: AssetRecord
}

export type ImportPlatform = 'youtube'

export type ImportJobSnapshot = {
  id: string
  nodeId: string
  sourceUrl: string
  platform: ImportPlatform
  status: 'queued' | 'downloading' | 'complete' | 'error'
  progress: number
  title: string | null
  assetId: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type StartImportUrlResponse = {
  jobId: string
  platform: ImportPlatform
  title: string | null
}

export type ImportCompletePayload = {
  assetId: string
  url: string
  kind: AssetKind
  title: string
  naturalWidth?: number
  naturalHeight?: number
}

export type ClipJobSnapshot = {
  id: string
  sourceNodeId: string
  outputNodeId: string
  sourceAssetId: string
  startFrame: number
  endFrame: number
  fps: number
  label: string
  status: 'queued' | 'processing' | 'complete' | 'error'
  progress: number
  assetId: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type StartClipExtractResponse = {
  jobId: string
}

export type ClipCompletePayload = {
  assetId: string
  url: string
  kind: AssetKind
  title: string
  naturalWidth?: number
  naturalHeight?: number
  sourceClipStartFrame: number
  sourceClipEndFrame: number
  extractedFromNodeId: string
}

export type ClipJobEventHandlers = {
  onProgress?: (data: { percent: number }) => void
  onComplete?: (data: ClipCompletePayload) => void
  onError?: (data: { message: string }) => void
}

export type ImportJobEventHandlers = {
  onMetadata?: (data: { title: string | null; platform: ImportPlatform }) => void
  onProgress?: (data: { percent: number; title: string | null }) => void
  onComplete?: (data: ImportCompletePayload) => void
  onError?: (data: { message: string }) => void
}

class StoryboardApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'StoryboardApiError'
    this.status = status
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText

    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) {
        message = body.error
      }
    } catch {
      // ignore parse errors
    }

    throw new StoryboardApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export async function fetchBoard(): Promise<BoardResponse> {
  const response = await fetch('/api/board')
  return parseJson<BoardResponse>(response)
}

export async function saveBoard(payload: BoardPayload): Promise<BoardResponse> {
  const response = await fetch('/api/board', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJson<BoardResponse>(response)
}

export async function uploadAsset(file: File): Promise<AssetRecord> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/assets', {
    method: 'POST',
    body: formData,
  })

  const body = await parseJson<AssetUploadResponse>(response)
  return body.asset
}

export async function deleteAsset(assetId: string): Promise<void> {
  const response = await fetch(`/api/assets/${assetId}`, {
    method: 'DELETE',
  })

  if (response.ok || response.status === 404) {
    return
  }

  let message = response.statusText

  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) {
      message = body.error
    }
  } catch {
    // ignore parse errors
  }

  throw new StoryboardApiError(message, response.status)
}

export async function startUrlImport(input: {
  url: string
  nodeId: string
}): Promise<StartImportUrlResponse> {
  const response = await fetch('/api/import/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<StartImportUrlResponse>(response)
}

export async function fetchImportJob(jobId: string): Promise<ImportJobSnapshot> {
  const response = await fetch(`/api/import/${jobId}`)
  return parseJson<ImportJobSnapshot>(response)
}

export function subscribeImportJobEvents(
  jobId: string,
  handlers: ImportJobEventHandlers,
): () => void {
  const source = new EventSource(`/api/import/${jobId}/stream`)

  const listen = <T>(eventName: string, handler?: (data: T) => void) => {
    if (!handler) {
      return
    }

    source.addEventListener(eventName, (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as T
        handler(data)
      } catch {
        // ignore malformed SSE payloads
      }
    })
  }

  listen<{ title: string | null; platform: ImportPlatform }>(
    'metadata',
    handlers.onMetadata,
  )
  listen<{ percent: number; title: string | null }>('progress', handlers.onProgress)
  listen<ImportCompletePayload>('complete', handlers.onComplete)
  listen<{ message: string }>('error', handlers.onError)

  source.onerror = () => {
    source.close()
  }

  return () => {
    source.close()
  }
}

export async function startClipExtract(input: {
  sourceNodeId: string
  outputNodeId: string
  sourceAssetId: string
  startFrame: number
  endFrame: number
  fps: number
  label: string
}): Promise<StartClipExtractResponse> {
  const response = await fetch('/api/clips/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<StartClipExtractResponse>(response)
}

export async function fetchClipJob(jobId: string): Promise<ClipJobSnapshot> {
  const response = await fetch(`/api/clips/${jobId}`)
  return parseJson<ClipJobSnapshot>(response)
}

export async function cancelClipExtract(jobId: string): Promise<void> {
  const response = await fetch(`/api/clips/${jobId}`, {
    method: 'DELETE',
  })

  await parseJson<{ ok: true }>(response)
}

export function subscribeClipJobEvents(
  jobId: string,
  handlers: ClipJobEventHandlers,
): () => void {
  const source = new EventSource(`/api/clips/${jobId}/stream`)

  const listen = <T>(eventName: string, handler?: (data: T) => void) => {
    if (!handler) {
      return
    }

    source.addEventListener(eventName, (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as T
        handler(data)
      } catch {
        // ignore malformed SSE payloads
      }
    })
  }

  listen<{ percent: number }>('progress', handlers.onProgress)
  listen<ClipCompletePayload>('complete', handlers.onComplete)
  listen<{ message: string }>('error', handlers.onError)

  source.onerror = () => {
    source.close()
  }

  return () => {
    source.close()
  }
}

export { StoryboardApiError }
