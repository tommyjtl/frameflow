import { FrameflowCanvas } from '../../frameflow'
import { VideoCardLastFrameSync } from './VideoCardLastFrameSync'
import { VideoFrameCaptureRegistration } from './VideoFrameCaptureRegistration'

type VideoCardBodyProps = {
  lastFrame?: number
  src: string
  width: number
  height: number
}

export function VideoCardBody({
  src,
  lastFrame,
  width,
  height,
}: VideoCardBodyProps) {
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
