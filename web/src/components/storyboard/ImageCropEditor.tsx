import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  clampCropPanForFrame,
  getImageTransformStyle,
  getWheelZoomScaleFactor,
  zoomCropTransformAtPoint,
  type ImageCropTransform,
} from './imageCropMath'
import { ImageCropFrame } from './ImageCropFrame'
import { useStoryboardImageCrop } from './StoryboardImageCropContext'

type ImageCropEditorProps = {
  nodeId: string
  src: string
  alt: string
  naturalWidth: number
  naturalHeight: number
}

export function ImageCropEditor({
  nodeId,
  src,
  alt,
  naturalWidth,
  naturalHeight,
}: ImageCropEditorProps) {
  const {
    cropTransform,
    cropFrame,
    stageWidth,
    stageHeight,
    updateCropTransform,
    isApplyingCrop,
  } = useStoryboardImageCrop()
  const viewportRef = useRef<HTMLDivElement>(null)
  const cropFrameRef = useRef(cropFrame)
  const panStartRef = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
    clientX: number
    clientY: number
  } | null>(null)
  const transformRef = useRef<ImageCropTransform>(
    cropTransform ?? { scale: 1, offsetX: 0, offsetY: 0 },
  )

  if (!cropFrame || stageWidth <= 0 || stageHeight <= 0) {
    return null
  }

  cropFrameRef.current = cropFrame

  const transform = clampCropPanForFrame(
    cropTransform ?? { scale: 1, offsetX: 0, offsetY: 0 },
    naturalWidth,
    naturalHeight,
    cropFrame,
    stageWidth,
    stageHeight,
  )
  transformRef.current = transform

  const commitTransform = useCallback(
    (next: ImageCropTransform) => {
      updateCropTransform(
        clampCropPanForFrame(
          next,
          naturalWidth,
          naturalHeight,
          cropFrameRef.current ?? cropFrame,
          stageWidth,
          stageHeight,
        ),
      )
    },
    [cropFrame, naturalHeight, naturalWidth, stageHeight, stageWidth, updateCropTransform],
  )

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      if (isApplyingCrop) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const frame = cropFrameRef.current

      if (!frame) {
        return
      }

      const rect = viewport.getBoundingClientRect()
      const pointerStageX = frame.x + (event.clientX - rect.left)
      const pointerStageY = frame.y + (event.clientY - rect.top)
      const deltaScale = getWheelZoomScaleFactor(event)
      const current = transformRef.current

      commitTransform(
        zoomCropTransformAtPoint(
          current,
          naturalWidth,
          naturalHeight,
          frame,
          stageWidth,
          stageHeight,
          pointerStageX,
          pointerStageY,
          deltaScale,
        ),
      )
    }

    viewport.addEventListener('wheel', onWheel, { passive: false, capture: true })

    return () => {
      viewport.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [
    commitTransform,
    isApplyingCrop,
    naturalHeight,
    naturalWidth,
    stageHeight,
    stageWidth,
  ])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isApplyingCrop) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      panStartRef.current = {
        pointerId: event.pointerId,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
        clientX: event.clientX,
        clientY: event.clientY,
      }
    },
    [isApplyingCrop, transform.offsetX, transform.offsetY],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const panStart = panStartRef.current

      if (!panStart || panStart.pointerId !== event.pointerId || isApplyingCrop) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      commitTransform({
        ...transformRef.current,
        offsetX: panStart.offsetX + (event.clientX - panStart.clientX),
        offsetY: panStart.offsetY + (event.clientY - panStart.clientY),
      })
    },
    [commitTransform, isApplyingCrop],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const panStart = panStartRef.current

      if (!panStart || panStart.pointerId !== event.pointerId) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      panStartRef.current = null
    },
    [],
  )

  const imageStyle = getImageTransformStyle(
    transform,
    cropFrame,
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
  )

  return (
    <div
      className="image-crop-editor nowheel nopan nodrag"
      data-node-id={nodeId}
    >
      <div
        ref={viewportRef}
        className="image-crop-editor__crop-viewport"
        style={{
          left: cropFrame.x,
          top: cropFrame.y,
          width: cropFrame.width,
          height: cropFrame.height,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          className="image-crop-editor__image"
          src={src}
          alt={alt}
          draggable={false}
          style={{
            width: imageStyle.width,
            height: imageStyle.height,
            left: imageStyle.left,
            top: imageStyle.top,
          }}
        />
        <div className="image-crop-editor__hint" aria-hidden>
          Enter to apply · Esc to cancel
        </div>
      </div>
      <ImageCropFrame
        cropFrame={cropFrame}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
      />
    </div>
  )
}
