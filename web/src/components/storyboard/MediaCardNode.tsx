import { memo, useCallback, type MouseEvent } from 'react'
import { useNodeId, type NodeProps } from '@xyflow/react'
import { FrameflowVideoProvider } from '../../frameflow'
import { ImageCardBody } from './ImageCardBody'
import { ImageCropEditor } from './ImageCropEditor'
import { MediaCardShell } from './MediaCardShell'
import { useStoryboardImageCrop } from './StoryboardImageCropContext'
import { VideoCardBody } from './VideoCardBody'
import { ImportVideoCardHeader, VideoCardHeader } from './VideoCardHeader'
import {
  canEnterImageCrop,
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
  const nodeId = useNodeId()
  const { croppingNodeId, cropFrame, naturalWidth, naturalHeight, enterCropMode } =
    useStoryboardImageCrop()
  const isCropping = nodeId != null && croppingNodeId === nodeId

  const handleImageDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.stopPropagation()

      if (!selected || !nodeId || isCropping || !isImageNodeData(data)) {
        return
      }

      if (!canEnterImageCrop(data)) {
        return
      }

      enterCropMode(nodeId)
    },
    [data, enterCropMode, isCropping, nodeId, selected],
  )
  const canvasDimensions = getCanvasDimensions(width, height)
  const resizeBounds = isImageNodeData(data)
    ? getImageNodeMinDimensions(data.naturalWidth, data.naturalHeight)
    : undefined

  if (isVideoNodeData(data)) {
    const isImporting =
      data.importStatus === 'downloading' ||
      data.importStatus === 'error' ||
      !data.src

    if (isImporting) {
      const isImportError = data.importStatus === 'error'

      return (
        <MediaCardShell
          label={data.label}
          selected={selected}
          showHeader
          header={
            <ImportVideoCardHeader
              label={data.label}
              platform={data.platform}
              importStatus={isImportError ? 'error' : 'downloading'}
              importProgress={data.importProgress}
              importTitle={data.importTitle}
            />
          }
          keepAspectRatio
          bodyClassName="media-card__body--video nodrag nopan"
        >
          <VideoCardBody
            importing={!isImportError}
            importErrorMessage={
              isImportError ? data.importErrorMessage : undefined
            }
            width={canvasDimensions.width}
            height={canvasDimensions.height}
          />
        </MediaCardShell>
      )
    }

    return (
      <FrameflowVideoProvider
        key={data.assetId ?? data.src}
        src={data.src}
        playbackClickInset={STORYBOARD_PLAYBACK_CLICK_INSET}
      >
        <MediaCardShell
          label={data.label}
          selected={selected}
          showHeader
          header={
            <VideoCardHeader
              label={data.label}
              platform={data.platform}
              sourceUrl={data.sourceUrl}
            />
          }
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
      showResizer={!isCropping}
      showHeader={false}
      minWidth={resizeBounds?.minWidth}
      minHeight={resizeBounds?.minHeight}
      keepAspectRatio={false}
      bodyClassName={
        isCropping
          ? 'media-card__body--image media-card__body--cropping nowheel nopan nodrag'
          : 'media-card__body--image dragHandle'
      }
    >
      {isCropping &&
      nodeId &&
      data.src &&
      cropFrame &&
      naturalWidth > 0 &&
      naturalHeight > 0 ? (
        <ImageCropEditor
          nodeId={nodeId}
          src={data.src}
          alt={data.label}
          naturalWidth={naturalWidth}
          naturalHeight={naturalHeight}
        />
      ) : (
        <ImageCardBody
          src={data.src}
          alt={data.label}
          platform={data.platform}
          sourceUrl={data.sourceUrl}
          importing={data.importStatus === 'downloading'}
          onDoubleClick={handleImageDoubleClick}
        />
      )}
    </MediaCardShell>
  )
}

export const MediaCardNode = memo(MediaCardNodeComponent)
