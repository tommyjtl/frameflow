import type { FrameCaptureResult } from '../../frameflow'
import { StoryboardApiError, uploadAsset } from './storyboardApi'
import {
  STORYBOARD_DEFAULT_NODE_WIDTH,
  STORYBOARD_EXTRACT_FRAME_GAP,
  createImageNode,
  getCanvasDimensions,
  isVideoNodeData,
  normalizeImageNodeDimensions,
  type MediaCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'

export const FRAME_EXTRACT_GHOST_MAX_SIZE = 120

export function getDefaultExtractFramePosition(source: MediaCardNodeType): {
  x: number
  y: number
} {
  const sourceWidth = source.width ?? STORYBOARD_DEFAULT_NODE_WIDTH

  return {
    x: source.position.x + sourceWidth + STORYBOARD_EXTRACT_FRAME_GAP,
    y: source.position.y,
  }
}

export function getExtractFrameImageNodeDimensions(
  source: MediaCardNodeType,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const canvas = getCanvasDimensions(source.width, source.height)

  return normalizeImageNodeDimensions(
    canvas.width,
    canvas.height,
    naturalWidth,
    naturalHeight,
  )
}

export function getExtractFrameGhostSize(
  nodeWidth: number,
  nodeHeight: number,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    FRAME_EXTRACT_GHOST_MAX_SIZE / Math.max(nodeWidth, nodeHeight),
  )

  return {
    width: Math.max(1, Math.round(nodeWidth * scale)),
    height: Math.max(1, Math.round(nodeHeight * scale)),
  }
}

export function flowPositionForFrameExtractDrop(
  clientX: number,
  clientY: number,
  nodeWidth: number,
  nodeHeight: number,
  screenToFlowPosition: (position: { x: number; y: number }) => {
    x: number
    y: number
  },
): { x: number; y: number } {
  const anchor = screenToFlowPosition({ x: clientX, y: clientY })

  return {
    x: anchor.x - nodeWidth / 2,
    y: anchor.y - nodeHeight / 2,
  }
}

export function isPointInsideRect(
  x: number,
  y: number,
  rect: DOMRect,
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

type PlaceExtractedFrameOptions = {
  sourceNodeId: string
  source: MediaCardNodeType
  captured: FrameCaptureResult
  position: { x: number; y: number }
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  takeSnapshot: () => void
}

export async function placeExtractedFrame({
  sourceNodeId,
  source,
  captured,
  position,
  setNodes,
  takeSnapshot,
}: PlaceExtractedFrameOptions): Promise<void> {
  if (!isVideoNodeData(source.data)) {
    return
  }

  const { blob, frameIndex } = captured
  const file = new File(
    [blob],
    `${source.data.label}-frame-${frameIndex}.png`,
    { type: 'image/png' },
  )
  const asset = await uploadAsset(file)
  const dimensions = getExtractFrameImageNodeDimensions(
    source,
    captured.naturalWidth,
    captured.naturalHeight,
  )
  const imageNodeId = crypto.randomUUID()
  const imageNode = createImageNode(
    imageNodeId,
    position,
    {
      label: `${source.data.label} — frame ${frameIndex}`,
      src: asset.url,
      assetId: asset.id,
      naturalWidth: captured.naturalWidth,
      naturalHeight: captured.naturalHeight,
      sourceFrameIndex: frameIndex,
      extractedFromNodeId: sourceNodeId,
    },
    dimensions,
  )

  takeSnapshot()
  setNodes((currentNodes) => [
    ...currentNodes.map((node) =>
      node.id === sourceNodeId ? { ...node, selected: false } : node,
    ),
    { ...imageNode, selected: true },
  ])
}

type ExtractFrameToPositionOptions = {
  sourceNodeId: string
  position: { x: number; y: number }
  getSource: () => MediaCardNodeType | undefined
  capture: () => Promise<FrameCaptureResult | null>
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  takeSnapshot: () => void
}

export async function extractFrameToPosition({
  sourceNodeId,
  position,
  getSource,
  capture,
  setNodes,
  takeSnapshot,
}: ExtractFrameToPositionOptions): Promise<void> {
  const source = getSource()

  if (!source || !isVideoNodeData(source.data)) {
    return
  }

  const captured = await capture()

  if (!captured) {
    throw new Error('Could not capture the current frame.')
  }

  await placeExtractedFrame({
    sourceNodeId,
    source,
    captured,
    position,
    setNodes,
    takeSnapshot,
  })
}

export function getExtractFrameErrorMessage(error: unknown): string {
  if (error instanceof StoryboardApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Could not extract the current frame.'
}
