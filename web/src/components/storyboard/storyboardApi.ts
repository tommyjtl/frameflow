export type AssetKind = 'video' | 'image'

export type NodeKind = 'video' | 'image' | 'drawing'

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

export { StoryboardApiError }
