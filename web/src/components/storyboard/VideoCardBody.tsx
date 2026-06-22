import { FrameflowCanvas } from '../../frameflow'
import { VideoCardLastFrameSync } from './VideoCardLastFrameSync'
import { VideoFrameCaptureRegistration } from './VideoFrameCaptureRegistration'

type VideoCardBodyProps = {
  lastFrame?: number
  src?: string
  width: number
  height: number
  importing?: boolean
  importErrorMessage?: string
}

export function VideoCardBody({
  src,
  lastFrame,
  width,
  height,
  importing = false,
  importErrorMessage,
}: VideoCardBodyProps) {
  if (importErrorMessage) {
    return (
      <div
        className="video-card-body video-card-body--import-error"
        style={{ width, height }}
      >
        <div className="media-card__import-error" role="alert">
          <p className="media-card__import-error-title">Import failed</p>
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
      <FrameflowCanvas
        layout="fill"
        width={width}
        height={height}
        className="video-card-body__canvas"
      />
    </div>
  )
}
