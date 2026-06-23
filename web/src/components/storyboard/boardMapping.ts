import type { Edge } from '@xyflow/react'
import { DEFAULT_SAMPLE_VIDEO } from '../../frameflow'
import type { AssetRecord, BoardEdgeRecord, BoardNodeRecord, BoardPayload } from './storyboardApi'
import {
  STORYBOARD_DEFAULT_CANVAS_HEIGHT,
  STORYBOARD_DEFAULT_CANVAS_WIDTH,
  STORYBOARD_DEFAULT_NODE_HEIGHT,
  STORYBOARD_DEFAULT_NODE_WIDTH,
  STORYBOARD_NODE_X_GAP,
  STORYBOARD_NODE_Y,
  createImageNode,
  createVideoNode,
  createFreehandNode,
  createTextNoteNode,
  getImageNodeDimensions,
  getVideoNodeDimensions,
  isDefaultVideoNodeDimensions,
  isFreehandDrawNode,
  isTextNoteNode,
  isVideoNodeData,
  normalizeImageNodeDimensions,
  FREEHAND_DRAW_Z_INDEX_BASE,
  FREEHAND_STROKE_COLOR,
  type FreehandStrokePoint,
  type MediaCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'

const DEFAULT_EDGE_TYPE = 'default'

export function createDefaultStoryboard(): {
  nodes: MediaCardNodeType[]
  edges: Edge[]
} {
  const nodes: MediaCardNodeType[] = [
    createVideoNode('shot-1', { x: 0, y: STORYBOARD_NODE_Y }, {
      label: 'Shot 1',
      src: DEFAULT_SAMPLE_VIDEO,
    }),
    createVideoNode(
      'shot-2',
      { x: STORYBOARD_NODE_X_GAP, y: STORYBOARD_NODE_Y },
      { label: 'Shot 2', src: DEFAULT_SAMPLE_VIDEO },
    ),
  ]

  const edges: Edge[] = [
    {
      id: 'shot-1-shot-2',
      source: 'shot-1',
      target: 'shot-2',
      type: DEFAULT_EDGE_TYPE,
    },
  ]

  return { nodes, edges }
}

export async function createDefaultStoryboardWithAssets(
  uploadSampleVideo: (file: File) => Promise<AssetRecord>,
  sampleVideoUrl: string = DEFAULT_SAMPLE_VIDEO,
): Promise<{
  nodes: MediaCardNodeType[]
  edges: Edge[]
}> {
  const response = await fetch(sampleVideoUrl)

  if (!response.ok) {
    throw new Error('Could not load the sample video for a new storyboard.')
  }

  const blob = await response.blob()
  const file = new File([blob], 'do-it-again.mp4', {
    type: blob.type || 'video/mp4',
  })
  const asset = await uploadSampleVideo(file)

  const nodes: MediaCardNodeType[] = [
    createVideoNode('shot-1', { x: 0, y: STORYBOARD_NODE_Y }, {
      label: 'Shot 1',
      src: asset.url,
      assetId: asset.id,
    }),
    createVideoNode(
      'shot-2',
      { x: STORYBOARD_NODE_X_GAP, y: STORYBOARD_NODE_Y },
      { label: 'Shot 2', src: asset.url, assetId: asset.id },
    ),
  ]

  const edges: Edge[] = [
    {
      id: 'shot-1-shot-2',
      source: 'shot-1',
      target: 'shot-2',
      type: DEFAULT_EDGE_TYPE,
    },
  ]

  return { nodes, edges }
}

function resolveNodeLastFrame(record: BoardNodeRecord): number | undefined {
  const lastFrame = record.meta?.lastFrame
  if (typeof lastFrame !== 'number' || !Number.isFinite(lastFrame) || lastFrame < 0) {
    return undefined
  }

  return Math.floor(lastFrame)
}

function resolveLoopPlayback(record: BoardNodeRecord): boolean {
  return record.meta?.loopPlayback === true
}

function resolveNodeNaturalDimensions(record: BoardNodeRecord): {
  naturalWidth?: number
  naturalHeight?: number
  sourceFrameIndex?: number
  extractedFromNodeId?: string
  sourceClipStartFrame?: number
  sourceClipEndFrame?: number
} {
  const naturalWidth = record.meta?.naturalWidth
  const naturalHeight = record.meta?.naturalHeight
  const sourceFrameIndex = record.meta?.sourceFrameIndex
  const extractedFromNodeId = record.meta?.extractedFromNodeId
  const sourceClipStartFrame = record.meta?.sourceClipStartFrame
  const sourceClipEndFrame = record.meta?.sourceClipEndFrame

  return {
    naturalWidth:
      typeof naturalWidth === 'number' && Number.isFinite(naturalWidth)
        ? Math.round(naturalWidth)
        : undefined,
    naturalHeight:
      typeof naturalHeight === 'number' && Number.isFinite(naturalHeight)
        ? Math.round(naturalHeight)
        : undefined,
    sourceFrameIndex:
      typeof sourceFrameIndex === 'number' &&
      Number.isFinite(sourceFrameIndex) &&
      sourceFrameIndex >= 0
        ? Math.floor(sourceFrameIndex)
        : undefined,
    extractedFromNodeId:
      typeof extractedFromNodeId === 'string' && extractedFromNodeId.length > 0
        ? extractedFromNodeId
        : undefined,
    sourceClipStartFrame:
      typeof sourceClipStartFrame === 'number' &&
      Number.isFinite(sourceClipStartFrame) &&
      sourceClipStartFrame >= 0
        ? Math.floor(sourceClipStartFrame)
        : undefined,
    sourceClipEndFrame:
      typeof sourceClipEndFrame === 'number' &&
      Number.isFinite(sourceClipEndFrame) &&
      sourceClipEndFrame >= 0
        ? Math.floor(sourceClipEndFrame)
        : undefined,
  }
}

function resolveNodeSrc(
  record: BoardNodeRecord,
  assets: AssetRecord[],
): string {
  if (record.assetId) {
    const asset = assets.find((item) => item.id === record.assetId)
    if (asset) {
      return asset.url
    }
  }

  const metaSrc = record.meta?.src
  if (typeof metaSrc === 'string' && metaSrc.length > 0) {
    return metaSrc
  }

  return DEFAULT_SAMPLE_VIDEO
}

function parseStrokePoints(raw: unknown): FreehandStrokePoint[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined
  }

  const points: FreehandStrokePoint[] = []

  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) {
      continue
    }

    const x = item[0]
    const y = item[1]

    if (typeof x !== 'number' || typeof y !== 'number') {
      continue
    }

    const pressure = typeof item[2] === 'number' ? item[2] : 0.5
    points.push([x, y, pressure])
  }

  return points.length > 0 ? points : undefined
}

function resolveDrawingMeta(record: BoardNodeRecord): {
  path?: string
  points?: FreehandStrokePoint[]
  color?: string
} {
  const path = record.meta?.path
  const points = record.meta?.points
  const color = record.meta?.color

  return {
    path: typeof path === 'string' && path.length > 0 ? path : undefined,
    points: parseStrokePoints(points),
    color: typeof color === 'string' && color.length > 0 ? color : undefined,
  }
}

function resolveTextMeta(record: BoardNodeRecord): {
  fontSize?: number
  scale?: number
  referenceWidth?: number
} {
  const fontSize = record.meta?.fontSize
  const scale = record.meta?.scale
  const referenceWidth = record.meta?.referenceWidth

  return {
    fontSize:
      typeof fontSize === 'number' && Number.isFinite(fontSize)
        ? fontSize
        : undefined,
    scale:
      typeof scale === 'number' && Number.isFinite(scale) ? scale : undefined,
    referenceWidth:
      typeof referenceWidth === 'number' && Number.isFinite(referenceWidth)
        ? referenceWidth
        : undefined,
  }
}

function resolveImportMeta(record: BoardNodeRecord): {
  sourceUrl?: string
  platform?: 'youtube' | 'instagram'
  importJobId?: string
  importStatus?: 'downloading' | 'complete' | 'error'
  importProgress?: number
  importTitle?: string
  importErrorMessage?: string
} {
  const sourceUrl = record.meta?.sourceUrl
  const platform = record.meta?.platform
  const importJobId = record.meta?.importJobId
  const importStatus = record.meta?.importStatus
  const importProgress = record.meta?.importProgress
  const importTitle = record.meta?.importTitle
  const importErrorMessage = record.meta?.importErrorMessage

  return {
    sourceUrl:
      typeof sourceUrl === 'string' && sourceUrl.length > 0 ? sourceUrl : undefined,
    platform:
      platform === 'youtube' || platform === 'instagram' ? platform : undefined,
    importJobId:
      typeof importJobId === 'string' && importJobId.length > 0
        ? importJobId
        : undefined,
    importStatus:
      importStatus === 'downloading' ||
      importStatus === 'complete' ||
      importStatus === 'error'
        ? importStatus
        : undefined,
    importProgress:
      typeof importProgress === 'number' && Number.isFinite(importProgress)
        ? Math.min(100, Math.max(0, Math.round(importProgress)))
        : undefined,
    importTitle:
      typeof importTitle === 'string' && importTitle.length > 0
        ? importTitle
        : undefined,
    importErrorMessage:
      typeof importErrorMessage === 'string' && importErrorMessage.length > 0
        ? importErrorMessage
        : undefined,
  }
}

function resolveClipExtractMeta(record: BoardNodeRecord): {
  clipExtractJobId?: string
  clipExtractStatus?: 'processing' | 'error'
  clipExtractProgress?: number
  clipExtractErrorMessage?: string
} {
  const clipExtractJobId = record.meta?.clipExtractJobId
  const clipExtractStatus = record.meta?.clipExtractStatus
  const clipExtractProgress = record.meta?.clipExtractProgress
  const clipExtractErrorMessage = record.meta?.clipExtractErrorMessage

  return {
    clipExtractJobId:
      typeof clipExtractJobId === 'string' && clipExtractJobId.length > 0
        ? clipExtractJobId
        : undefined,
    clipExtractStatus:
      clipExtractStatus === 'processing' || clipExtractStatus === 'error'
        ? clipExtractStatus
        : undefined,
    clipExtractProgress:
      typeof clipExtractProgress === 'number' &&
      Number.isFinite(clipExtractProgress)
        ? Math.min(100, Math.max(0, Math.round(clipExtractProgress)))
        : undefined,
    clipExtractErrorMessage:
      typeof clipExtractErrorMessage === 'string' &&
      clipExtractErrorMessage.length > 0
        ? clipExtractErrorMessage
        : undefined,
  }
}

function boardNodeToFlowNode(
  record: BoardNodeRecord,
  assets: AssetRecord[],
): StoryboardNodeType | null {
  const position = { x: record.positionX, y: record.positionY }
  const importMeta = resolveImportMeta(record)
  const clipExtractMeta = resolveClipExtractMeta(record)
  const baseData = {
    label: record.label,
    src: resolveNodeSrc(record, assets),
    assetId: record.assetId,
    ...importMeta,
    ...clipExtractMeta,
  }

  if (record.kind === 'video') {
    const naturalMeta = resolveNodeNaturalDimensions(record)
    const dimensions =
      naturalMeta.naturalWidth && naturalMeta.naturalHeight
        ? isDefaultVideoNodeDimensions(record.width, record.height)
          ? getVideoNodeDimensions(
              naturalMeta.naturalWidth,
              naturalMeta.naturalHeight,
              STORYBOARD_DEFAULT_CANVAS_WIDTH,
              STORYBOARD_DEFAULT_CANVAS_HEIGHT,
            )
          : { width: record.width, height: record.height }
        : { width: record.width, height: record.height }

    return createVideoNode(
      record.id,
      position,
      {
        ...baseData,
        naturalWidth: naturalMeta.naturalWidth,
        naturalHeight: naturalMeta.naturalHeight,
        lastFrame: resolveNodeLastFrame(record),
        loopPlayback: resolveLoopPlayback(record),
        sourceClipStartFrame: naturalMeta.sourceClipStartFrame,
        sourceClipEndFrame: naturalMeta.sourceClipEndFrame,
        extractedFromNodeId: naturalMeta.extractedFromNodeId,
      },
      dimensions,
    )
  }

  if (record.kind === 'image') {
    const imageMeta = resolveNodeNaturalDimensions(record)
    const dimensions =
      imageMeta.naturalWidth && imageMeta.naturalHeight
        ? normalizeImageNodeDimensions(
            record.width,
            record.height,
            imageMeta.naturalWidth,
            imageMeta.naturalHeight,
          )
        : isDefaultVideoNodeDimensions(record.width, record.height)
          ? getImageNodeDimensions(imageMeta.naturalWidth, imageMeta.naturalHeight)
          : { width: record.width, height: record.height }

    return createImageNode(
      record.id,
      position,
      {
        ...baseData,
        naturalWidth: imageMeta.naturalWidth,
        naturalHeight: imageMeta.naturalHeight,
        sourceFrameIndex: imageMeta.sourceFrameIndex,
        extractedFromNodeId: imageMeta.extractedFromNodeId,
      },
      dimensions,
    )
  }

  if (record.kind === 'drawing') {
    const drawingMeta = resolveDrawingMeta(record)

    if (!drawingMeta.path || !drawingMeta.points) {
      return null
    }

    return createFreehandNode(
      record.id,
      position,
      {
        path: drawingMeta.path,
        points: drawingMeta.points,
        color: drawingMeta.color === FREEHAND_STROKE_COLOR
          ? FREEHAND_STROKE_COLOR
          : undefined,
      },
      { width: record.width, height: record.height },
      FREEHAND_DRAW_Z_INDEX_BASE,
    )
  }

  if (record.kind === 'text') {
    const textMeta = resolveTextMeta(record)

    return createTextNoteNode(
      record.id,
      position,
      {
        text: record.label === 'Text' ? '' : record.label,
        fontSize: textMeta.fontSize,
        scale: textMeta.scale,
        referenceWidth: textMeta.referenceWidth,
      },
      { width: record.width, height: record.height },
    )
  }

  return null
}

export function boardToFlow(
  board: BoardPayload & { assets: AssetRecord[] },
): { nodes: StoryboardNodeType[]; edges: Edge[] } {
  const nodes = board.nodes
    .map((record) => boardNodeToFlowNode(record, board.assets))
    .filter((node): node is StoryboardNodeType => node !== null)

  const edges = board.edges.map(boardEdgeToFlowEdge)

  return { nodes, edges }
}

export function flowToBoardPayload(
  nodes: StoryboardNodeType[],
  edges: Edge[],
): BoardPayload {
  return {
    nodes: nodes.map(flowNodeToBoardRecord),
    edges: edges.map(flowEdgeToBoardRecord),
  }
}

function buildNodeMeta(node: StoryboardNodeType): Record<string, unknown> | null {
  if (isFreehandDrawNode(node)) {
    return {
      path: node.data.path,
      points: node.data.points,
      color: node.data.color,
    }
  }

  if (isTextNoteNode(node)) {
    return null
  }

  const meta: Record<string, unknown> = {}

  if (!node.data.assetId) {
    meta.src = node.data.src
  }

  if (isVideoNodeData(node.data) && node.data.lastFrame != null) {
    meta.lastFrame = node.data.lastFrame
  }

  if (isVideoNodeData(node.data) && node.data.loopPlayback) {
    meta.loopPlayback = true
  }

  if (isVideoNodeData(node.data)) {
    if (node.data.naturalWidth != null) {
      meta.naturalWidth = node.data.naturalWidth
    }

    if (node.data.naturalHeight != null) {
      meta.naturalHeight = node.data.naturalHeight
    }

    if (node.data.sourceClipStartFrame != null) {
      meta.sourceClipStartFrame = node.data.sourceClipStartFrame
    }

    if (node.data.sourceClipEndFrame != null) {
      meta.sourceClipEndFrame = node.data.sourceClipEndFrame
    }

    if (node.data.extractedFromNodeId) {
      meta.extractedFromNodeId = node.data.extractedFromNodeId
    }
  }

  if (node.data.kind === 'image') {
    if (node.data.naturalWidth != null) {
      meta.naturalWidth = node.data.naturalWidth
    }

    if (node.data.naturalHeight != null) {
      meta.naturalHeight = node.data.naturalHeight
    }

    if (node.data.sourceFrameIndex != null) {
      meta.sourceFrameIndex = node.data.sourceFrameIndex
    }

    if (node.data.extractedFromNodeId) {
      meta.extractedFromNodeId = node.data.extractedFromNodeId
    }
  }

  if (node.data.sourceUrl) {
    meta.sourceUrl = node.data.sourceUrl
  }

  if (node.data.platform) {
    meta.platform = node.data.platform
  }

  if (node.data.importJobId) {
    meta.importJobId = node.data.importJobId
  }

  if (node.data.importStatus) {
    meta.importStatus = node.data.importStatus
  }

  if (node.data.importProgress != null) {
    meta.importProgress = node.data.importProgress
  }

  if (node.data.importTitle) {
    meta.importTitle = node.data.importTitle
  }

  if (node.data.importErrorMessage) {
    meta.importErrorMessage = node.data.importErrorMessage
  }

  if (node.data.clipExtractJobId) {
    meta.clipExtractJobId = node.data.clipExtractJobId
  }

  if (node.data.clipExtractStatus) {
    meta.clipExtractStatus = node.data.clipExtractStatus
  }

  if (node.data.clipExtractProgress != null) {
    meta.clipExtractProgress = node.data.clipExtractProgress
  }

  if (node.data.clipExtractErrorMessage) {
    meta.clipExtractErrorMessage = node.data.clipExtractErrorMessage
  }

  return Object.keys(meta).length > 0 ? meta : null
}

function resolveNodeLabel(label: string | undefined, fallback: string): string {
  const trimmed = label?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

function flowNodeToBoardRecord(node: StoryboardNodeType): BoardNodeRecord {
  if (isFreehandDrawNode(node)) {
    return {
      id: node.id,
      kind: 'drawing',
      assetId: null,
      label: 'Drawing',
      positionX: node.position.x,
      positionY: node.position.y,
      width: node.width ?? STORYBOARD_DEFAULT_NODE_WIDTH,
      height: node.height ?? STORYBOARD_DEFAULT_NODE_HEIGHT,
      meta: buildNodeMeta(node),
    }
  }

  if (isTextNoteNode(node)) {
    const text = node.data.text.trim()
    const meta: Record<string, unknown> = {}

    if (node.data.fontSize != null) {
      meta.fontSize = node.data.fontSize
    }

    if (node.data.scale != null) {
      meta.scale = node.data.scale
    }

    if (node.data.referenceWidth != null) {
      meta.referenceWidth = node.data.referenceWidth
    }

    return {
      id: node.id,
      kind: 'text',
      assetId: null,
      label: text.length > 0 ? text : 'Text',
      positionX: node.position.x,
      positionY: node.position.y,
      width: node.width ?? STORYBOARD_DEFAULT_NODE_WIDTH,
      height: node.height ?? STORYBOARD_DEFAULT_NODE_HEIGHT,
      meta: Object.keys(meta).length > 0 ? meta : null,
    }
  }

  const assetId = node.data.assetId ?? null

  return {
    id: node.id,
    kind: node.data.kind,
    assetId,
    label: resolveNodeLabel(node.data.label, 'Imported media'),
    positionX: node.position.x,
    positionY: node.position.y,
    width: node.width ?? STORYBOARD_DEFAULT_NODE_WIDTH,
    height: node.height ?? STORYBOARD_DEFAULT_NODE_HEIGHT,
    meta: buildNodeMeta(node),
  }
}

function flowEdgeToBoardRecord(edge: Edge): BoardEdgeRecord {
  const meta: Record<string, unknown> = {}

  if (edge.sourceHandle) {
    meta.sourceHandle = edge.sourceHandle
  }

  if (edge.targetHandle) {
    meta.targetHandle = edge.targetHandle
  }

  return {
    id: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    kind: typeof edge.data?.kind === 'string' ? edge.data.kind : null,
    meta: Object.keys(meta).length > 0 ? meta : null,
  }
}

function boardEdgeToFlowEdge(record: BoardEdgeRecord): Edge {
  const sourceHandle =
    typeof record.meta?.sourceHandle === 'string' ? record.meta.sourceHandle : undefined
  const targetHandle =
    typeof record.meta?.targetHandle === 'string' ? record.meta.targetHandle : undefined

  return {
    id: record.id,
    source: record.sourceNodeId,
    target: record.targetNodeId,
    type: DEFAULT_EDGE_TYPE,
    sourceHandle,
    targetHandle,
    data: record.kind ? { kind: record.kind } : undefined,
  }
}
