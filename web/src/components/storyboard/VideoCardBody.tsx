import { useCallback, useMemo } from 'react'
import { useNodeId } from '@xyflow/react'
import { FrameflowCanvas } from '../../frameflow'
import { useClipExtractModeOptional } from './ClipExtractProvider'
import { VideoCardClipProgress } from './VideoCardClipProgress'
import { VideoCardClipScrubSync } from './VideoCardClipScrubSync'
import { VideoCardLastFrameSync } from './VideoCardLastFrameSync'
import { VideoFrameCaptureRegistration } from './VideoFrameCaptureRegistration'

type VideoCardBodyProps = {
  lastFrame?: number
  src?: string
  width: number
  height: number
  importing?: boolean
  importErrorMessage?: string
  errorTitle?: string
}

export function VideoCardBody({
  src,
  lastFrame,
  width,
  height,
  importing = false,
  importErrorMessage,
  errorTitle = 'Import failed',
}: VideoCardBodyProps) {
  const nodeId = useNodeId()
  const clipMode = useClipExtractModeOptional()

  const clipModeActive =
    nodeId != null && (clipMode?.isClipModeActive(nodeId) ?? false)

  const setClipRange = clipMode?.setClipRange

  const handleClipProgressProps = useCallback(
    (start: number, end: number) => {
      setClipRange?.(start, end)
    },
    [setClipRange],
  )

  const resolvedClipProgressProps = useMemo(
    () => ({
      active: clipModeActive,
      rangeStart: clipModeActive ? (clipMode?.range?.start ?? null) : null,
      rangeEnd: clipModeActive ? (clipMode?.range?.end ?? null) : null,
      onRangeChange: handleClipProgressProps,
    }),
    [
      clipMode?.range?.end,
      clipMode?.range?.start,
      clipModeActive,
      handleClipProgressProps,
    ],
  )

  if (importErrorMessage) {
    return (
      <div
        className="video-card-body video-card-body--import-error"
        style={{ width, height }}
      >
        <div className="media-card__import-error" role="alert">
          <p className="media-card__import-error-title">{errorTitle}</p>
          <p className="media-card__import-error-message">{importErrorMessage}</p>
        </div>
      </div>
    )
  }

  if (importing || !src) {
    return (
      <div
        className="video-card-body video-card-body--importing"
        style={{ width, height }}
      >
        <div className="media-card__import-placeholder" aria-hidden>
          <span className="media-card__import-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="video-card-body">
      <VideoCardLastFrameSync lastFrame={lastFrame} src={src} />
      <VideoFrameCaptureRegistration />
      {clipModeActive ? <VideoCardClipScrubSync /> : null}
      <FrameflowCanvas
        layout="fill"
        width={width}
        height={height}
        className="video-card-body__canvas"
        clipProgress={VideoCardClipProgress}
        clipProgressProps={resolvedClipProgressProps}
      />
    </div>
  )
}
