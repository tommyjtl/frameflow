import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  directionLabel,
  formatVelocityValue,
} from './motion'
import { FrameflowPlaybackProgress } from './FrameflowPlaybackProgress'
import { useFrameflowVideoContext } from './FrameflowVideoProvider'
import { isInsidePlaybackClickSafeRect } from './playbackClickInset'
import type { PlaybackClickInset } from './types'
import './frameflow.css'

export type FrameflowCanvasProps = {
  width?: number
  height?: number
  className?: string
  showDragStats?: boolean
  /** Read-only 2px progress strip on the top edge of the canvas. */
  showPlaybackProgress?: boolean
  /** Fixed pixel stack (demo) or fill the parent container (storyboard cards). */
  layout?: 'fixed' | 'fill'
  /** Optional clip extraction progress overlay (storyboard). */
  clipProgress?: React.ComponentType<{
    active: boolean
    rangeStart: number | null
    rangeEnd: number | null
    onRangeChange: (start: number, end: number) => void
  }> | null
  clipProgressProps?: {
    active: boolean
    rangeStart: number | null
    rangeEnd: number | null
    onRangeChange: (start: number, end: number) => void
  }
}

function getIsInsidePlaybackSafeZone(
  event: React.PointerEvent<HTMLDivElement>,
  inset: PlaybackClickInset,
): boolean {
  const rect = event.currentTarget.getBoundingClientRect()

  return isInsidePlaybackClickSafeRect(
    event.clientX - rect.left,
    event.clientY - rect.top,
    rect.width,
    rect.height,
    inset,
  )
}

export function FrameflowCanvas({
  width = 640,
  height = 360,
  className,
  showDragStats = false,
  showPlaybackProgress = true,
  layout = 'fixed',
  clipProgress: ClipProgressComponent = null,
  clipProgressProps,
}: FrameflowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    registerCanvas,
    fpsProbeStatus,
    isReady,
    isScrubbing,
    dragDirection,
    dragVelocity,
    velocitySpeed,
    frameflowSupported,
    scrubHandlers,
    playbackClickInset,
  } = useFrameflowVideoContext()

  const [isHoverInPlaybackSafeZone, setIsHoverInPlaybackSafeZone] =
    useState(!playbackClickInset)

  useEffect(() => {
    setIsHoverInPlaybackSafeZone(!playbackClickInset)
  }, [playbackClickInset])

  useEffect(() => {
    registerCanvas(canvasRef.current)
    return () => registerCanvas(null)
  }, [registerCanvas])

  const updatePlaybackSafeZoneHover = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!playbackClickInset) {
        setIsHoverInPlaybackSafeZone(true)
        return
      }

      setIsHoverInPlaybackSafeZone(
        getIsInsidePlaybackSafeZone(event, playbackClickInset),
      )
    },
    [playbackClickInset],
  )

  const overlayHandlers = useMemo(
    () => ({
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        updatePlaybackSafeZoneHover(event)
        scrubHandlers.onPointerDown(event)
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        updatePlaybackSafeZoneHover(event)
        scrubHandlers.onPointerMove(event)
      },
      onPointerUp: scrubHandlers.onPointerUp,
      onPointerLeave: () => {
        setIsHoverInPlaybackSafeZone(!playbackClickInset)
      },
      onPointerCancel: scrubHandlers.onPointerUp,
    }),
    [playbackClickInset, scrubHandlers, updatePlaybackSafeZoneHover],
  )

  const showPlaybackAffordanceCursor =
    !playbackClickInset || isHoverInPlaybackSafeZone

  const statusMessage =
    fpsProbeStatus === 'probing'
      ? 'Measuring video frame rate…'
      : fpsProbeStatus === 'needs-play'
        ? 'Click canvas to calibrate frame rate.'
        : null

  const stackClassName = [
    'frameflow-canvas-stack',
    layout === 'fill' ? 'frameflow-canvas-stack--fill' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const stackStyle =
    layout === 'fill'
      ? undefined
      : { width, maxWidth: width, height }

  return (
    <figure className={['frameflow-canvas-figure', className].filter(Boolean).join(' ')}>
      {showDragStats && (
        <figcaption className="frameflow-figure-caption">
          <span className="frameflow-canvas-title">
            <span>Canvas</span>
          </span>
          <span className="frameflow-drag-stats" aria-live="polite">
            <span className="frameflow-drag-stat frameflow-drag-stat-direction">
              {directionLabel(dragDirection)}
            </span>
            <span
              className={`frameflow-drag-stat frameflow-drag-stat-speed${velocitySpeed ? ` frameflow-drag-stat-speed--${velocitySpeed}` : ''
                }`}
            >
              {velocitySpeed ?? '-'}
            </span>
            <span className="frameflow-drag-stat frameflow-drag-stat-velocity">
              {dragVelocity === null
                ? '-'
                : formatVelocityValue(dragVelocity)}
            </span>
          </span>
        </figcaption>
      )}

      <div className={stackClassName} style={stackStyle}>
        <canvas ref={canvasRef} />
        {isReady && (
          <>
            {showPlaybackProgress &&
              (ClipProgressComponent && clipProgressProps?.active ? (
                <ClipProgressComponent {...clipProgressProps} />
              ) : (
                <FrameflowPlaybackProgress />
              ))}
            <div
              className={[
                'frameflow-canvas-overlay',
                isScrubbing &&
                  showPlaybackAffordanceCursor &&
                  'frameflow-canvas-overlay--scrubbing',
                playbackClickInset &&
                  !showPlaybackAffordanceCursor &&
                  'frameflow-canvas-overlay--outside-playback-safe',
              ]
                .filter(Boolean)
                .join(' ')}
              {...overlayHandlers}
            />
          </>
        )}
        {!isReady && statusMessage && (
          <div className="frameflow-canvas-status">{statusMessage}</div>
        )}
      </div>

      {!frameflowSupported && (
        <p className="frameflow-warning" role="alert">
          Your browser does not support{' '}
          <code>HTMLVideoElement.requestVideoFrameCallback()</code>.
        </p>
      )}
    </figure>
  )
}
