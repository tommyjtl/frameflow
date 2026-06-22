import { useCallback, useRef, useState } from 'react'
import {
  PROGRESS_BAR_HEIGHT_PX,
  PROGRESS_BAR_HOVER_HEIGHT_PX,
  PROGRESS_HIT_AREA_HEIGHT_PX,
} from './constants'
import { useFrameflowVideoContext } from './FrameflowVideoProvider'

function getPlaybackProgress(
  currentFrame: number | null,
  totalFrames: number | null,
): number {
  if (
    currentFrame === null ||
    totalFrames === null ||
    totalFrames <= 1
  ) {
    return 0
  }

  return Math.min(
    100,
    Math.max(0, (currentFrame / (totalFrames - 1)) * 100),
  )
}

function getFrameFromPointerX(
  clientX: number,
  rect: DOMRect,
  totalFrames: number,
): number {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return Math.round(ratio * (totalFrames - 1))
}

/** Interactive progress strip along the top edge of the canvas. */
export function FrameflowPlaybackProgress() {
  const hitAreaRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const { isReady, currentFrame, totalFrames, seekToFrame, beginProgressScrub, endProgressScrub } =
    useFrameflowVideoContext()

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const hitArea = hitAreaRef.current
      if (!hitArea || totalFrames === null || totalFrames <= 1) {
        return
      }

      const frame = getFrameFromPointerX(
        clientX,
        hitArea.getBoundingClientRect(),
        totalFrames,
      )
      seekToFrame(frame)
    },
    [seekToFrame, totalFrames],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      isDraggingRef.current = true
      setIsDragging(true)
      beginProgressScrub()
      seekFromPointer(event.clientX)
    },
    [beginProgressScrub, seekFromPointer],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isDraggingRef.current ||
        !event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        return
      }

      event.stopPropagation()
      seekFromPointer(event.clientX)
    },
    [seekFromPointer],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const wasDragging = isDraggingRef.current
      isDraggingRef.current = false
      setIsDragging(false)

      if (wasDragging) {
        endProgressScrub()
      }
    },
    [endProgressScrub],
  )

  if (!isReady || totalFrames === null || totalFrames <= 0) {
    return null
  }

  const progress = getPlaybackProgress(currentFrame, totalFrames)
  const isExpanded = isHovering || isDragging
  const barHeight = isExpanded
    ? PROGRESS_BAR_HOVER_HEIGHT_PX
    : PROGRESS_BAR_HEIGHT_PX

  return (
    <div
      ref={hitAreaRef}
      className={[
        'frameflow-progress-hit',
        isExpanded ? 'frameflow-progress-hit--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: PROGRESS_HIT_AREA_HEIGHT_PX }}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="frameflow-progress-bar"
        style={{ height: barHeight }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={totalFrames - 1}
        aria-valuenow={currentFrame ?? 0}
        aria-label="Playback position"
      >
        <div
          className="frameflow-progress-bar__fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export { getPlaybackProgress, getFrameFromPointerX }
