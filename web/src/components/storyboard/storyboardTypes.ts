import type { Node } from '@xyflow/react'

type MediaCardBaseData = {
  label: string
  src: string
  assetId?: string | null
  sourceUrl?: string
  platform?: 'youtube' | 'instagram'
  importJobId?: string
  importStatus?: 'downloading' | 'complete' | 'error'
  importProgress?: number
  importTitle?: string
  importErrorMessage?: string
}

export type VideoMediaNodeData = MediaCardBaseData & {
  kind: 'video'
  /** Last scrubbed/playback frame index, persisted in board meta. */
  lastFrame?: number
}

export type ImageMediaNodeData = MediaCardBaseData & {
  kind: 'image'
  naturalWidth?: number
  naturalHeight?: number
  /** Frame index when extracted from a video card. */
  sourceFrameIndex?: number
  /** Source video node id when extracted from a video card. */
  extractedFromNodeId?: string
}

export type MediaNodeData = VideoMediaNodeData | ImageMediaNodeData

export type MediaCardNodeType = Node<MediaNodeData, 'mediaCard'>

export type ImageCardNodeType = Node<ImageMediaNodeData, 'mediaCard'>

export const MEDIA_CARD_NODE_TYPE = 'mediaCard' as const

export type BoardInteractionMode = 'select' | 'draw' | 'text'

export type FreehandStrokePoint = [number, number, number?]

export const FREEHAND_DRAW_NODE_TYPE = 'freehandDraw' as const
export const TEXT_NOTE_NODE_TYPE = 'textNote' as const
export const FREEHAND_STROKE_COLOR = '#ffffff' as const
export const FREEHAND_DRAW_Z_INDEX_BASE = 10
export const TEXT_NOTE_Z_INDEX = FREEHAND_DRAW_Z_INDEX_BASE + 1
export const MEDIA_CARD_Z_INDEX = 0
export const STORYBOARD_TEXT_NOTE_MIN_WIDTH = 32
export const STORYBOARD_TEXT_NOTE_MIN_HEIGHT = 28
export const STORYBOARD_TEXT_DEFAULT_FONT_SIZE = 24
export const STORYBOARD_TEXT_MIN_SCALE = 0.25
export const STORYBOARD_TEXT_MAX_SCALE = 8

export type FreehandDrawNodeData = {
  kind: 'drawing'
  path: string
  points: FreehandStrokePoint[]
  color: typeof FREEHAND_STROKE_COLOR
}

export type FreehandDrawNodeType = Node<FreehandDrawNodeData, 'freehandDraw'>

export type TextNoteNodeData = {
  kind: 'text'
  text: string
  fontSize?: number
  scale?: number
  /** Natural width at scale 1, frozen when editing ends. */
  referenceWidth?: number
}

export function getTextNoteEffectiveFontSize(data: TextNoteNodeData): number {
  return (
    (data.fontSize ?? STORYBOARD_TEXT_DEFAULT_FONT_SIZE) * (data.scale ?? 1)
  )
}

const TEXT_NOTE_MEASURE_MIRROR_ID = 'storyboard-text-measure'

export function measureTextNoteDimensions(
  text: string,
  fontSize: number,
): { width: number; height: number } {
  if (typeof document === 'undefined') {
    return {
      width: STORYBOARD_TEXT_NOTE_MIN_WIDTH,
      height: STORYBOARD_TEXT_NOTE_MIN_HEIGHT,
    }
  }

  let mirror = document.getElementById(
    TEXT_NOTE_MEASURE_MIRROR_ID,
  ) as HTMLSpanElement | null

  if (!mirror) {
    mirror = document.createElement('span')
    mirror.id = TEXT_NOTE_MEASURE_MIRROR_ID
    mirror.setAttribute('aria-hidden', 'true')
    mirror.style.cssText =
      'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none;'
    document.body.appendChild(mirror)
  }

  mirror.style.fontFamily = "tldraw_draw, 'Caveat', cursive"
  mirror.style.fontSize = `${fontSize}px`
  mirror.style.lineHeight = '1.25'

  const lines = text.split('\n')
  const lineHeightPx = fontSize * 1.25
  let maxWidth = 0

  for (const line of lines) {
    mirror.textContent = line.length > 0 ? line : '\u00a0'
    maxWidth = Math.max(maxWidth, mirror.getBoundingClientRect().width)
  }

  return {
    width: Math.max(STORYBOARD_TEXT_NOTE_MIN_WIDTH, Math.ceil(maxWidth)),
    height: Math.max(
      STORYBOARD_TEXT_NOTE_MIN_HEIGHT,
      Math.ceil(lines.length * lineHeightPx),
    ),
  }
}

export type TextNoteNodeType = Node<TextNoteNodeData, typeof TEXT_NOTE_NODE_TYPE>

export type StoryboardNodeType =
  | MediaCardNodeType
  | FreehandDrawNodeType
  | TextNoteNodeType

export type StoryboardCopyableNode = MediaCardNodeType | TextNoteNodeType

export const STORYBOARD_NODE_X_GAP = 420
export const STORYBOARD_NODE_Y = 80

export const STORYBOARD_DUPLICATE_OFFSET = { x: 40, y: 40 } as const
export const STORYBOARD_EXTRACT_FRAME_GAP = 40

export const STORYBOARD_DRAG_HANDLE = '.dragHandle'
export const STORYBOARD_IMAGE_DRAG_HANDLE = '.media-card__body--image'

/** Play/pause only when click starts and ends inside this inset. */
export const STORYBOARD_PLAYBACK_CLICK_INSET = {
  top: 8,
  right: 16,
  bottom: 28,
  left: 16,
} as const

export const STORYBOARD_DEFAULT_CANVAS_WIDTH = 320
export const STORYBOARD_DEFAULT_CANVAS_HEIGHT = 180
export const STORYBOARD_NODE_HEADER_HEIGHT = 38
export const STORYBOARD_URL_IMPORT_BODY_SIZE = 512
export const STORYBOARD_URL_IMPORT_VIDEO_NODE_WIDTH = STORYBOARD_URL_IMPORT_BODY_SIZE
export const STORYBOARD_URL_IMPORT_VIDEO_NODE_HEIGHT =
  STORYBOARD_URL_IMPORT_BODY_SIZE + STORYBOARD_NODE_HEADER_HEIGHT
export const STORYBOARD_DEFAULT_NODE_WIDTH = STORYBOARD_DEFAULT_CANVAS_WIDTH
export const STORYBOARD_DEFAULT_NODE_HEIGHT =
  STORYBOARD_DEFAULT_CANVAS_HEIGHT + STORYBOARD_NODE_HEADER_HEIGHT

export const STORYBOARD_MIN_CANVAS_WIDTH = 240
export const STORYBOARD_MIN_CANVAS_HEIGHT = 135
export const STORYBOARD_MIN_NODE_WIDTH = STORYBOARD_MIN_CANVAS_WIDTH
export const STORYBOARD_MIN_NODE_HEIGHT =
  STORYBOARD_MIN_CANVAS_HEIGHT + STORYBOARD_NODE_HEADER_HEIGHT

export const STORYBOARD_MIN_IMAGE_CANVAS_WIDTH = 72
export const STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT = 72
export const STORYBOARD_MAX_IMAGE_CANVAS_WIDTH = 1920
export const STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT = 1920

function clampImageBodyDimensions(
  bodyWidth: number,
  bodyHeight: number,
): { bodyWidth: number; bodyHeight: number } {
  let width = Math.round(bodyWidth)
  let height = Math.round(bodyHeight)
  const aspect = width / height

  if (width > STORYBOARD_MAX_IMAGE_CANVAS_WIDTH) {
    width = STORYBOARD_MAX_IMAGE_CANVAS_WIDTH
    height = Math.round(width / aspect)
  }

  if (height > STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT) {
    height = STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT
    width = Math.round(height * aspect)
  }

  if (width < STORYBOARD_MIN_IMAGE_CANVAS_WIDTH) {
    width = STORYBOARD_MIN_IMAGE_CANVAS_WIDTH
    height = Math.round(width / aspect)
  }

  if (height < STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT) {
    height = STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT
    width = Math.round(height * aspect)
  }

  return { bodyWidth: width, bodyHeight: height }
}

function imageBodyFromNaturalAspect(
  naturalWidth: number,
  naturalHeight: number,
  seedBodyHeight: number,
): { bodyWidth: number; bodyHeight: number } {
  const aspect = naturalWidth / naturalHeight
  return clampImageBodyDimensions(
    Math.round(seedBodyHeight * aspect),
    seedBodyHeight,
  )
}

function imageNodeFromBody(bodyWidth: number, bodyHeight: number): {
  width: number
  height: number
} {
  return {
    width: bodyWidth,
    height: bodyHeight,
  }
}

/** Node size for an image card, preserving the asset aspect ratio in the body. */
export function getImageNodeDimensions(
  naturalWidth?: number,
  naturalHeight?: number,
): { width: number; height: number } {
  if (
    !naturalWidth ||
    !naturalHeight ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return {
      width: STORYBOARD_DEFAULT_CANVAS_WIDTH,
      height: STORYBOARD_DEFAULT_CANVAS_HEIGHT,
    }
  }

  const body = imageBodyFromNaturalAspect(
    naturalWidth,
    naturalHeight,
    STORYBOARD_DEFAULT_CANVAS_HEIGHT,
  )

  return imageNodeFromBody(body.bodyWidth, body.bodyHeight)
}

/** Keep image body aspect while mapping React Flow node size changes. */
export function normalizeImageNodeDimensions(
  nodeWidth: number,
  nodeHeight: number,
  naturalWidth?: number,
  naturalHeight?: number,
): { width: number; height: number } {
  if (
    !naturalWidth ||
    !naturalHeight ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return {
      width: Math.round(nodeWidth),
      height: Math.round(nodeHeight),
    }
  }

  const aspect = naturalWidth / naturalHeight
  const requestedBodyHeight = Math.max(
    STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT,
    Math.round(nodeHeight),
  )
  const requestedBodyWidth = Math.max(
    STORYBOARD_MIN_IMAGE_CANVAS_WIDTH,
    Math.round(nodeWidth),
  )

  const widthLedHeight = Math.round(requestedBodyWidth / aspect)
  const heightLedWidth = Math.round(requestedBodyHeight * aspect)

  const widthDelta = Math.abs(widthLedHeight - requestedBodyHeight)
  const heightDelta = Math.abs(heightLedWidth - requestedBodyWidth)

  const body =
    widthDelta <= heightDelta
      ? clampImageBodyDimensions(requestedBodyWidth, widthLedHeight)
      : clampImageBodyDimensions(heightLedWidth, requestedBodyHeight)

  return imageNodeFromBody(body.bodyWidth, body.bodyHeight)
}

export function getImageNodeMinDimensions(
  naturalWidth?: number,
  naturalHeight?: number,
): { minWidth: number; minHeight: number } {
  if (
    !naturalWidth ||
    !naturalHeight ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return {
      minWidth: STORYBOARD_MIN_NODE_WIDTH,
      minHeight: STORYBOARD_MIN_NODE_HEIGHT,
    }
  }

  const body = imageBodyFromNaturalAspect(
    naturalWidth,
    naturalHeight,
    STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT,
  )

  const node = imageNodeFromBody(body.bodyWidth, body.bodyHeight)

  return {
    minWidth: node.width,
    minHeight: node.height,
  }
}

export function isDefaultVideoNodeDimensions(
  width: number,
  height: number,
): boolean {
  return (
    width === STORYBOARD_DEFAULT_NODE_WIDTH &&
    height === STORYBOARD_DEFAULT_NODE_HEIGHT
  )
}

export function isVideoNodeData(data: MediaNodeData): data is VideoMediaNodeData {
  return data.kind === 'video'
}

export function isImageNodeData(data: MediaNodeData): data is ImageMediaNodeData {
  return data.kind === 'image'
}

/** Node size for a video card body, preserving asset aspect ratio plus header. */
export function getVideoNodeDimensions(
  naturalWidth?: number,
  naturalHeight?: number,
  seedBodyHeight: number = STORYBOARD_URL_IMPORT_BODY_SIZE,
): { width: number; height: number } {
  if (
    !naturalWidth ||
    !naturalHeight ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return {
      width: STORYBOARD_DEFAULT_NODE_WIDTH,
      height: STORYBOARD_DEFAULT_NODE_HEIGHT,
    }
  }

  const body = imageBodyFromNaturalAspect(
    naturalWidth,
    naturalHeight,
    seedBodyHeight,
  )

  return {
    width: body.bodyWidth,
    height: body.bodyHeight + STORYBOARD_NODE_HEADER_HEIGHT,
  }
}

export function getCanvasDimensions(
  nodeWidth?: number,
  nodeHeight?: number,
): { width: number; height: number } {
  const width = nodeWidth ?? STORYBOARD_DEFAULT_NODE_WIDTH
  const height = nodeHeight ?? STORYBOARD_DEFAULT_NODE_HEIGHT

  return {
    width: Math.round(width),
    height: Math.max(
      STORYBOARD_MIN_CANVAS_HEIGHT,
      Math.round(height - STORYBOARD_NODE_HEADER_HEIGHT),
    ),
  }
}

function createMediaCardNode(
  id: string,
  position: { x: number; y: number },
  data: MediaNodeData,
  dimensions?: { width?: number; height?: number },
  dragHandle: string = STORYBOARD_DRAG_HANDLE,
): MediaCardNodeType {
  return {
    id,
    type: MEDIA_CARD_NODE_TYPE,
    position,
    dragHandle,
    zIndex: MEDIA_CARD_Z_INDEX,
    width: dimensions?.width ?? STORYBOARD_DEFAULT_NODE_WIDTH,
    height: dimensions?.height ?? STORYBOARD_DEFAULT_NODE_HEIGHT,
    data,
  }
}

export function createUrlImportPlaceholderNode(
  id: string,
  position: { x: number; y: number },
  data: {
    sourceUrl: string
    platform: 'youtube'
    importJobId?: string
    importTitle?: string
  },
): MediaCardNodeType {
  return createVideoNode(
    id,
    position,
    {
      label: data.importTitle ?? 'Importing…',
      src: '',
      sourceUrl: data.sourceUrl,
      platform: data.platform,
      importJobId: data.importJobId,
      importStatus: 'downloading',
      importProgress: 0,
      importTitle: data.importTitle,
    },
    {
      width: STORYBOARD_URL_IMPORT_VIDEO_NODE_WIDTH,
      height: STORYBOARD_URL_IMPORT_VIDEO_NODE_HEIGHT,
    },
  )
}

export function createVideoNode(
  id: string,
  position: { x: number; y: number },
  data: Omit<VideoMediaNodeData, 'kind'>,
  dimensions?: { width?: number; height?: number },
): MediaCardNodeType {
  return createMediaCardNode(
    id,
    position,
    { kind: 'video', ...data },
    dimensions,
  )
}

export function createImageNode(
  id: string,
  position: { x: number; y: number },
  data: Omit<ImageMediaNodeData, 'kind'>,
  dimensions?: { width?: number; height?: number },
): MediaCardNodeType {
  return createMediaCardNode(
    id,
    position,
    { kind: 'image', ...data },
    dimensions,
    STORYBOARD_IMAGE_DRAG_HANDLE,
  )
}

export function isFreehandDrawNode(
  node: StoryboardNodeType,
): node is FreehandDrawNodeType {
  return node.type === FREEHAND_DRAW_NODE_TYPE
}

export function isTextNoteNode(node: StoryboardNodeType): node is TextNoteNodeType {
  return node.type === TEXT_NOTE_NODE_TYPE
}

export function isCopyableStoryboardNode(
  node: StoryboardNodeType,
): node is StoryboardCopyableNode {
  return !isFreehandDrawNode(node)
}

export function createTextNoteNode(
  id: string,
  position: { x: number; y: number },
  data: {
    text?: string
    fontSize?: number
    scale?: number
    referenceWidth?: number
  } = {},
  dimensions: {
    width?: number
    height?: number
  } = {},
): TextNoteNodeType {
  return {
    id,
    type: TEXT_NOTE_NODE_TYPE,
    position,
    dragHandle: STORYBOARD_DRAG_HANDLE,
    width: dimensions.width ?? STORYBOARD_TEXT_NOTE_MIN_WIDTH,
    height: dimensions.height ?? STORYBOARD_TEXT_NOTE_MIN_HEIGHT,
    zIndex: TEXT_NOTE_Z_INDEX,
    data: {
      kind: 'text',
      text: data.text ?? '',
      fontSize: data.fontSize ?? STORYBOARD_TEXT_DEFAULT_FONT_SIZE,
      scale: data.scale ?? 1,
      referenceWidth: data.referenceWidth,
    },
  }
}

export function createFreehandNode(
  id: string,
  position: { x: number; y: number },
  data: Omit<FreehandDrawNodeData, 'kind' | 'color'> & {
    color?: FreehandDrawNodeData['color']
  },
  dimensions: { width: number; height: number },
  zIndex: number = FREEHAND_DRAW_Z_INDEX_BASE,
): FreehandDrawNodeType {
  return {
    id,
    type: FREEHAND_DRAW_NODE_TYPE,
    position,
    width: dimensions.width,
    height: dimensions.height,
    zIndex,
    data: {
      kind: 'drawing',
      color: data.color ?? FREEHAND_STROKE_COLOR,
      path: data.path,
      points: data.points,
    },
  }
}
