import { useEffect, useRef } from 'react'
import {
  directionLabel,
  formatVelocityValue,
} from './motion'
import { FrameflowPlaybackProgress } from './FrameflowPlaybackProgress'
import { useFrameflowVideoContext } from './FrameflowVideoProvider'
import './frameflow.css'

export type FrameflowCanvasProps = {
  width?: number
  height?: number
  className?: string
  showDragStats?: boolean
  /** Read-only 2px progress strip on the top edge of the canvas. */
  showPlaybackProgress?: boolean
}

export function FrameflowCanvas({
  width = 640,
  height = 360,
  className,
  showDragStats = false,
  showPlaybackProgress = true,
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
  } = useFrameflowVideoContext()

  useEffect(() => {
    registerCanvas(canvasRef.current)
    return () => registerCanvas(null)
  }, [registerCanvas])

  const statusMessage =
    fpsProbeStatus === 'probing'
      ? 'Measuring video frame rate…'
      : fpsProbeStatus === 'needs-play'
        ? 'Click canvas to calibrate frame rate.'
        : null

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

      <div className="frameflow-canvas-stack">
        <canvas ref={canvasRef} width={width} height={height} />
        {isReady && (
          <>
            {showPlaybackProgress && <FrameflowPlaybackProgress />}
            <div
              className={`frameflow-canvas-overlay${isScrubbing ? ' frameflow-canvas-overlay--scrubbing' : ''
                }`}
              {...scrubHandlers}
              onPointerCancel={scrubHandlers.onPointerUp}
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
