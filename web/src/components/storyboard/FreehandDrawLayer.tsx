import { useCallback, useRef, useState } from 'react'
import { ViewportPortal, useReactFlow } from '@xyflow/react'
import {
  createFreehandNodeFromPoints,
  getNextFreehandZIndex,
  getStrokePathData,
  FREEHAND_MIN_POINTS,
} from './freehandUtils'
import type {
  FreehandDrawNodeType,
  FreehandStrokePoint,
  StoryboardNodeType,
} from './storyboardTypes'

type FreehandDrawLayerProps = {
  onStrokeComplete: (node: FreehandDrawNodeType) => void
}

export function FreehandDrawLayer({ onStrokeComplete }: FreehandDrawLayerProps) {
  const { screenToFlowPosition, getNodes } = useReactFlow<StoryboardNodeType>()
  const [points, setPoints] = useState<FreehandStrokePoint[] | null>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<FreehandStrokePoint[] | null>(null)

  const toFlowPoint = useCallback(
    (event: React.PointerEvent): FreehandStrokePoint => {
      const flow = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      return [flow.x, flow.y, event.pressure || 0.5]
    },
    [screenToFlowPosition],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      isDrawingRef.current = true
      const nextPoints: FreehandStrokePoint[] = [toFlowPoint(event)]
      pointsRef.current = nextPoints
      setPoints(nextPoints)
    },
    [toFlowPoint],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawingRef.current || event.buttons !== 1) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      setPoints((current) => {
        const base = current ?? pointsRef.current ?? []
        const nextPoints = [...base, toFlowPoint(event)]
        pointsRef.current = nextPoints
        return nextPoints
      })
    },
    [toFlowPoint],
  )

  const finishStroke = useCallback(
    (strokePoints: FreehandStrokePoint[] | null) => {
      if (!strokePoints || strokePoints.length < FREEHAND_MIN_POINTS) {
        return
      }

      const zIndex = getNextFreehandZIndex(getNodes())
      const node = createFreehandNodeFromPoints(strokePoints, zIndex)

      if (node) {
        onStrokeComplete(node)
      }
    },
    [getNodes, onStrokeComplete],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawingRef.current) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      isDrawingRef.current = false
      const strokePoints = pointsRef.current
      pointsRef.current = null
      setPoints(null)
      finishStroke(strokePoints)
    },
    [finishStroke],
  )

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      isDrawingRef.current = false
      pointsRef.current = null
      setPoints(null)
    },
    [],
  )

  const previewPath =
    points && points.length > 0 ? getStrokePathData(points, false) : null

  return (
    <>
      <div
        className="freehand-draw-layer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      {previewPath && (
        <ViewportPortal>
          <svg className="freehand-draw-layer__preview" aria-hidden>
            <path className="freehand-draw-layer__preview-path" d={previewPath} />
          </svg>
        </ViewportPortal>
      )}
    </>
  )
}
