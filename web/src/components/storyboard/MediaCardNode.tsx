import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { FrameflowVideoProvider } from '../../frameflow'
import { ImageCardBody } from './ImageCardBody'
import { MediaCardShell } from './MediaCardShell'
import { VideoCardBody } from './VideoCardBody'
import { VideoCardHeader } from './VideoCardHeader'
import {
  getCanvasDimensions,
  getImageNodeMinDimensions,
  isImageNodeData,
  isVideoNodeData,
  STORYBOARD_PLAYBACK_CLICK_INSET,
  type MediaCardNodeType,
} from './storyboardTypes'

function MediaCardNodeComponent({
  data,
  selected,
  width,
  height,
}: NodeProps<MediaCardNodeType>) {
  const canvasDimensions = getCanvasDimensions(width, height)
  const resizeBounds = isImageNodeData(data)
    ? getImageNodeMinDimensions(data.naturalWidth, data.naturalHeight)
    : undefined

  if (isVideoNodeData(data)) {
    return (
      <FrameflowVideoProvider
        src={data.src}
        playbackClickInset={STORYBOARD_PLAYBACK_CLICK_INSET}
      >
        <MediaCardShell
          label={data.label}
          selected={selected}
          showHeader
          header={<VideoCardHeader label={data.label} />}
          keepAspectRatio
          bodyClassName="media-card__body--video nodrag nopan"
        >
          <VideoCardBody
            src={data.src}
            lastFrame={data.lastFrame}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
          />
        </MediaCardShell>
      </FrameflowVideoProvider>
    )
  }

  return (
    <MediaCardShell
      label={data.label}
      selected={selected}
      showHeader={false}
      minWidth={resizeBounds?.minWidth}
      minHeight={resizeBounds?.minHeight}
      keepAspectRatio={false}
      bodyClassName="media-card__body--image dragHandle"
    >
      <ImageCardBody src={data.src} alt={data.label} />
    </MediaCardShell>
  )
}

export const MediaCardNode = memo(MediaCardNodeComponent)
