import {
  STORYBOARD_DEFAULT_NODE_HEIGHT,
  STORYBOARD_DEFAULT_NODE_WIDTH,
  type MediaCardNodeType,
} from './storyboardTypes'

export const STORYBOARD_EXTRACT_CLIP_GAP = 40

/** Clip card matches the source video card's on-canvas size. */
export function getClipExtractNodeDimensions(source: MediaCardNodeType): {
  width: number
  height: number
} {
  return {
    width: source.width ?? STORYBOARD_DEFAULT_NODE_WIDTH,
    height: source.height ?? STORYBOARD_DEFAULT_NODE_HEIGHT,
  }
}

export function getDefaultExtractClipPosition(source: MediaCardNodeType): {
  x: number
  y: number
} {
  const { width: sourceWidth } = getClipExtractNodeDimensions(source)

  return {
    x: source.position.x + sourceWidth + STORYBOARD_EXTRACT_CLIP_GAP,
    y: source.position.y,
  }
}

export function getClipLabel(
  sourceLabel: string,
  startFrame: number,
  endFrame: number,
): string {
  return `${sourceLabel} — clip ${startFrame}–${endFrame}`
}

export function normalizeClipRange(
  anchorFrame: number,
  outFrame: number,
): { start: number; end: number } | null {
  const start = Math.min(anchorFrame, outFrame)
  const end = Math.max(anchorFrame, outFrame)

  if (end - start + 1 < 2) {
    return null
  }

  return { start, end }
}

export function clipRangesEqual(
  a: { start: number; end: number } | null,
  b: { start: number; end: number } | null,
): boolean {
  if (a === b) {
    return true
  }

  if (a == null || b == null) {
    return a === b
  }

  return a.start === b.start && a.end === b.end
}

/** Resolve persisted asset id from node data or `/assets/{id}.ext` src URLs. */
export function resolveVideoAssetId(input: {
  assetId?: string | null
  src?: string
}): string | null {
  if (input.assetId) {
    return input.assetId
  }

  if (!input.src) {
    return null
  }

  const match = input.src.match(/^\/assets\/([^/]+?)\.[^/]+$/)

  return match?.[1] ?? null
}

export function canExtractClipFromVideo(input: {
  assetId?: string | null
  src?: string
}): boolean {
  return resolveVideoAssetId(input) != null
}

export function getClipExtractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Could not extract the video clip.'
}
