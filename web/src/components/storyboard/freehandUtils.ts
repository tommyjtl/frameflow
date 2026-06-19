import { getStroke } from 'perfect-freehand'
import type { StrokeOptions } from 'perfect-freehand'
import {
  FREEHAND_DRAW_NODE_TYPE,
  FREEHAND_DRAW_Z_INDEX_BASE,
  FREEHAND_STROKE_COLOR,
  type FreehandDrawNodeType,
  type FreehandStrokePoint,
} from './storyboardTypes'

/**
 * perfect-freehand stroke profile for storyboard freehand drawing.
 * @see https://github.com/steveruizok/perfect-freehand#options
 *
 * - size: Base stroke diameter in flow coordinates. Primary “brush width” control.
 * - thinning: How strongly pressure/speed narrows the stroke (0 = uniform width).
 * - smoothing: Softens the path curvature; higher values reduce jitter.
 * - streamline: Stabilizes the line by pulling points toward a smoother path (like pen smoothing).
 * - simulatePressure: Derives pressure from pointer speed when no stylus pressure is available.
 * - start.taper / end.taper: Taper stroke ends to a point; true tapers over the stroke length.
 */
export const FREEHAND_STROKE_OPTIONS: StrokeOptions = {
  size: 4,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: false,
  start: { taper: false },
  end: { taper: false },
}

export const FREEHAND_MIN_POINTS = 3
export const FREEHAND_BBOX_PADDING = 4

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) {
    return ''
  }

  const d: string[] = []
  const [firstX, firstY] = stroke[0]
  d.push(`M ${firstX} ${firstY}`)

  for (let index = 1; index < stroke.length; index++) {
    const [x0, y0] = stroke[index - 1]
    const [x1, y1] = stroke[index]
    const midX = (x0 + x1) / 2
    const midY = (y0 + y1) / 2
    d.push(`Q ${x0} ${y0} ${midX} ${midY}`)
  }

  d.push('Z')
  return d.join(' ')
}

export function getStrokeOutline(
  points: FreehandStrokePoint[],
  last = false,
): number[][] {
  const normalizedPoints = points.map(([x, y, pressure = 0.5]) => [
    x,
    y,
    pressure,
  ])

  return getStroke(normalizedPoints, {
    ...FREEHAND_STROKE_OPTIONS,
    last,
  })
}

export function getStrokePathData(
  points: FreehandStrokePoint[],
  last = false,
): string {
  return getSvgPathFromStroke(getStrokeOutline(points, last))
}

function getOutlineBounds(outline: number[][]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [x, y] of outline) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return { minX, minY, maxX, maxY }
}

function shiftOutlineToLocal(
  outline: number[][],
  originX: number,
  originY: number,
): number[][] {
  return outline.map(([x, y]) => [x - originX, y - originY])
}

function shiftPointsToLocal(
  points: FreehandStrokePoint[],
  originX: number,
  originY: number,
): FreehandStrokePoint[] {
  return points.map(([x, y, pressure = 0.5]) => [
    x - originX,
    y - originY,
    pressure,
  ])
}

export function createFreehandNodeFromPoints(
  points: FreehandStrokePoint[],
  zIndex: number,
): FreehandDrawNodeType | null {
  if (points.length < FREEHAND_MIN_POINTS) {
    return null
  }

  const outline = getStrokeOutline(points, true)
  const bounds = getOutlineBounds(outline)

  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return null
  }

  const originX = bounds.minX - FREEHAND_BBOX_PADDING
  const originY = bounds.minY - FREEHAND_BBOX_PADDING
  const width =
    bounds.maxX - bounds.minX + FREEHAND_BBOX_PADDING * 2
  const height =
    bounds.maxY - bounds.minY + FREEHAND_BBOX_PADDING * 2

  if (width <= 0 || height <= 0) {
    return null
  }

  const localOutline = shiftOutlineToLocal(outline, originX, originY)
  const localPoints = shiftPointsToLocal(points, originX, originY)

  return {
    id: crypto.randomUUID(),
    type: FREEHAND_DRAW_NODE_TYPE,
    position: { x: originX, y: originY },
    width,
    height,
    zIndex,
    data: {
      kind: 'drawing',
      path: getSvgPathFromStroke(localOutline),
      points: localPoints,
      color: FREEHAND_STROKE_COLOR,
    },
  }
}

export function getNextFreehandZIndex(nodes: { zIndex?: number }[]): number {
  const maxZ = nodes.reduce(
    (max, node) => Math.max(max, node.zIndex ?? FREEHAND_DRAW_Z_INDEX_BASE - 1),
    FREEHAND_DRAW_Z_INDEX_BASE - 1,
  )

  return Math.max(maxZ + 1, FREEHAND_DRAW_Z_INDEX_BASE)
}
