import { useCallback, useRef, useState } from 'react'
import {
  PROGRESS_BAR_HEIGHT_PX,
  PROGRESS_BAR_HOVER_HEIGHT_PX,
  PROGRESS_HIT_AREA_HEIGHT_PX,
} from '../../frameflow/constants'
import {
  getFrameFromPointerX,
  getPlaybackProgress,
} from '../../frameflow/FrameflowPlaybackProgress'
import { useFrameflowVideoContext } from '../../frameflow'

const MIN_CLIP_FRAMES = 2

export type VideoCardClipProgressProps = {
  active: boolean
  rangeStart: number | null
  rangeEnd: number | null
  onRangeChange: (start: number, end: number) => void
}

function getRangeProgress(
  startFrame: number,
  endFrame: number,
  totalFrames: number,
): { left: number; width: number } {
  if (totalFrames <= 1) {
    return { left: 0, width: 0 }
  }

  const start = Math.min(startFrame, endFrame)
  const end = Math.max(startFrame, endFrame)
  const left = (start / (totalFrames - 1)) * 100
  const right = (end / (totalFrames - 1)) * 100

  return {
    left,
    width: Math.max(0, right - left),
  }
}

/** Clip-mode progress bar with purple range overlay and resize handles. */
export function VideoCardClipProgress({
  active,
  rangeStart,
  rangeEnd,
  onRangeChange,
}: VideoCardClipProgressProps) {
  const hitAreaRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef<'start' | 'end' | 'scrub' | null>(null)
  const [, setIsDragging] = useState(false)
  const [hoverHandle, setHoverHandle] = useState<'start' | 'end' | 'range' | null>(
    null,
  )

  const {
    isReady,
    currentFrame,
    totalFrames,
    seekToFrame,
    beginProgressScrub,
    endProgressScrub,
  } = useFrameflowVideoContext()

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

  const getHandleAtPointer = useCallback(
    (
      clientX: number,
    ): 'start' | 'end' | 'range' | null => {
      const hitArea = hitAreaRef.current

      if (
        !hitArea ||
        totalFrames === null ||
        totalFrames <= 1 ||
        rangeStart == null ||
        rangeEnd == null
      ) {
        return null
      }

      const rect = hitArea.getBoundingClientRect()
      const frame = getFrameFromPointerX(clientX, rect, totalFrames)
      const start = Math.min(rangeStart, rangeEnd)
      const end = Math.max(rangeStart, rangeEnd)

      if (Math.abs(frame - start) <= 1) {
        return 'start'
      }

      if (Math.abs(frame - end) <= 1) {
        return 'end'
      }

      if (frame >= start && frame <= end) {
        return 'range'
      }

      return null
    },
    [rangeEnd, rangeStart, totalFrames],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      const handle =
        rangeStart != null && rangeEnd != null
          ? getHandleAtPointer(event.clientX)
          : null

      if (handle === 'start' || handle === 'end') {
        isDraggingRef.current = handle
        setIsDragging(true)
        return
      }

      isDraggingRef.current = 'scrub'
      setIsDragging(true)
      beginProgressScrub()
      seekFromPointer(event.clientX)
    },
    [
      beginProgressScrub,
      getHandleAtPointer,
      rangeEnd,
      rangeStart,
      seekFromPointer,
    ],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isDraggingRef.current ||
        !event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        if (active) {
          setHoverHandle(getHandleAtPointer(event.clientX))
        }
        return
      }

      event.stopPropagation()

      const dragKind = isDraggingRef.current

      if (
        (dragKind === 'start' || dragKind === 'end') &&
        rangeStart != null &&
        rangeEnd != null &&
        totalFrames != null
      ) {
        const hitArea = hitAreaRef.current

        if (!hitArea) {
          return
        }

        const frame = getFrameFromPointerX(
          event.clientX,
          hitArea.getBoundingClientRect(),
          totalFrames,
        )
        const start = Math.min(rangeStart, rangeEnd)
        const end = Math.max(rangeStart, rangeEnd)

        if (dragKind === 'start') {
          const nextStart = Math.min(frame, end - (MIN_CLIP_FRAMES - 1))
          onRangeChange(nextStart, end)
        } else {
          const nextEnd = Math.max(frame, start + (MIN_CLIP_FRAMES - 1))
          onRangeChange(start, nextEnd)
        }

        return
      }

      if (dragKind === 'scrub') {
        seekFromPointer(event.clientX)
      }
    },
    [
      active,
      getHandleAtPointer,
      onRangeChange,
      rangeEnd,
      rangeStart,
      seekFromPointer,
      totalFrames,
    ],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const wasScrubbing = isDraggingRef.current === 'scrub'
      isDraggingRef.current = null
      setIsDragging(false)
      setHoverHandle(getHandleAtPointer(event.clientX))

      if (wasScrubbing) {
        endProgressScrub()
      }
    },
    [endProgressScrub, getHandleAtPointer],
  )

  if (!isReady || !active || totalFrames === null || totalFrames <= 0) {
    return null
  }

  const progress = getPlaybackProgress(currentFrame, totalFrames)
  const isExpanded = true
  const barHeight = isExpanded
    ? PROGRESS_BAR_HOVER_HEIGHT_PX
    : PROGRESS_BAR_HEIGHT_PX

  const hasRange =
    rangeStart != null && rangeEnd != null && rangeEnd - rangeStart + 1 >= MIN_CLIP_FRAMES
  const rangeStyle = hasRange
    ? getRangeProgress(rangeStart, rangeEnd, totalFrames)
    : null

  const showResizeCursor =
    hoverHandle === 'start' ||
    hoverHandle === 'end' ||
    hoverHandle === 'range'

  return (
    <div
      ref={hitAreaRef}
      className={[
        'frameflow-progress-hit',
        'frameflow-progress-hit--expanded',
        'frameflow-progress-hit--clip-mode',
        showResizeCursor ? 'frameflow-progress-hit--resize' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        height: PROGRESS_HIT_AREA_HEIGHT_PX,
        cursor: showResizeCursor ? 'ew-resize' : undefined,
      }}
      onPointerEnter={() => undefined}
      onPointerLeave={() => {
        setHoverHandle(null)
      }}
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
        {rangeStyle ? (
          <div
            className="frameflow-progress-bar__clip-range"
            style={{
              left: `${rangeStyle.left}%`,
              width: `${rangeStyle.width}%`,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
