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
