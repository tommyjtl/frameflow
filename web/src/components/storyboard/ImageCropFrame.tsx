import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  resizeCropFrame,
  type CropFrameRect,
  type CropHandleId,
} from './imageCropMath'
import { useStoryboardImageCrop } from './StoryboardImageCropContext'

const HANDLES: Array<{ id: CropHandleId; className: string }> = [
  { id: 'nw', className: 'image-crop-frame__handle--nw' },
  { id: 'n', className: 'image-crop-frame__handle--n' },
  { id: 'ne', className: 'image-crop-frame__handle--ne' },
  { id: 'e', className: 'image-crop-frame__handle--e' },
  { id: 'se', className: 'image-crop-frame__handle--se' },
  { id: 's', className: 'image-crop-frame__handle--s' },
  { id: 'sw', className: 'image-crop-frame__handle--sw' },
  { id: 'w', className: 'image-crop-frame__handle--w' },
]

type ImageCropFrameProps = {
  cropFrame: CropFrameRect
  stageWidth: number
  stageHeight: number
}

export function ImageCropFrame({
  cropFrame,
  stageWidth,
  stageHeight,
}: ImageCropFrameProps) {
  const { updateCropFrame, isApplyingCrop } = useStoryboardImageCrop()
  const resizeStartRef = useRef<{
    pointerId: number
    handle: CropHandleId
    frame: CropFrameRect
    clientX: number
    clientY: number
    lockAspect: boolean
  } | null>(null)

  const handlePointerDown = useCallback(
    (handle: CropHandleId, event: ReactPointerEvent<HTMLDivElement>) => {
      if (isApplyingCrop) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.parentElement?.setPointerCapture(event.pointerId)
      resizeStartRef.current = {
        pointerId: event.pointerId,
        handle,
        frame: cropFrame,
        clientX: event.clientX,
        clientY: event.clientY,
        lockAspect: event.shiftKey,
      }
    },
    [cropFrame, isApplyingCrop],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const resizeStart = resizeStartRef.current

      if (
        !resizeStart ||
        resizeStart.pointerId !== event.pointerId ||
        isApplyingCrop
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      updateCropFrame(
        resizeCropFrame(
          resizeStart.frame,
          resizeStart.handle,
          event.clientX - resizeStart.clientX,
          event.clientY - resizeStart.clientY,
          stageWidth,
          stageHeight,
          event.shiftKey || resizeStart.lockAspect,
        ),
      )
    },
    [isApplyingCrop, stageHeight, stageWidth, updateCropFrame],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const resizeStart = resizeStartRef.current

      if (!resizeStart || resizeStart.pointerId !== event.pointerId) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      resizeStartRef.current = null
    },
    [],
  )

  return (
    <div
      className="image-crop-frame nodrag nopan nowheel"
      style={{
        left: cropFrame.x,
        top: cropFrame.y,
        width: cropFrame.width,
        height: cropFrame.height,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {HANDLES.map(({ id, className }) => (
        <div
          key={id}
          className={['image-crop-frame__handle', className].join(' ')}
          onPointerDown={(event) => handlePointerDown(id, event)}
        />
      ))}
    </div>
  )
}
