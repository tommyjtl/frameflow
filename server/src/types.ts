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

export type ImportJobStatus = 'queued' | 'downloading' | 'complete' | 'error'

export type ImportJobRecord = {
  id: string
  nodeId: string
  sourceUrl: string
  platform: ImportPlatform
  status: ImportJobStatus
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

export type ClipJobStatus = 'queued' | 'processing' | 'complete' | 'error'

export type ClipJobRecord = {
  id: string
  sourceNodeId: string
  outputNodeId: string
  sourceAssetId: string
  startFrame: number
  endFrame: number
  fps: number
  label: string
  status: ClipJobStatus
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
