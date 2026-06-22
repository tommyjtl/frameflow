import {
  STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT,
  STORYBOARD_MAX_IMAGE_CANVAS_WIDTH,
  STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT,
  STORYBOARD_MIN_IMAGE_CANVAS_WIDTH,
} from './storyboardTypes'

export type ImageCropTransform = {
  /** Multiplier on top of the base cover scale (1 = cover, no extra zoom). */
  scale: number
  offsetX: number
  offsetY: number
}

export type CropFrameRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CropHandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export type NaturalRect = {
  x: number
  y: number
  width: number
  height: number
}

export function getFullCropFrame(
  stageWidth: number,
  stageHeight: number,
): CropFrameRect {
  return {
    x: 0,
    y: 0,
    width: stageWidth,
    height: stageHeight,
  }
}

export function clampCropFrame(
  frame: CropFrameRect,
  stageWidth: number,
  stageHeight: number,
  minWidth: number = STORYBOARD_MIN_IMAGE_CANVAS_WIDTH,
  minHeight: number = STORYBOARD_MIN_IMAGE_CANVAS_HEIGHT,
): CropFrameRect {
  const width = Math.max(minWidth, Math.min(frame.width, stageWidth))
  const height = Math.max(minHeight, Math.min(frame.height, stageHeight))
  const x = Math.min(
    Math.max(0, frame.x),
    Math.max(0, stageWidth - width),
  )
  const y = Math.min(
    Math.max(0, frame.y),
    Math.max(0, stageHeight - height),
  )

  return { x, y, width, height }
}

function repositionFromAnchor(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  anchor: 'nw' | 'ne' | 'sw' | 'se',
): CropFrameRect {
  switch (anchor) {
    case 'nw':
      return { x: anchorX, y: anchorY, width, height }
    case 'ne':
      return { x: anchorX - width, y: anchorY, width, height }
    case 'sw':
      return { x: anchorX, y: anchorY - height, width, height }
    case 'se':
      return { x: anchorX - width, y: anchorY - height, width, height }
  }
}

export function resizeCropFrame(
  start: CropFrameRect,
  handle: CropHandleId,
  deltaX: number,
  deltaY: number,
  stageWidth: number,
  stageHeight: number,
  lockAspect: boolean,
): CropFrameRect {
  const aspect = start.width / start.height
  let width = start.width
  let height = start.height
  let x = start.x
  let y = start.y

  switch (handle) {
    case 'e':
      width = start.width + deltaX
      break
    case 'w':
      x = start.x + deltaX
      width = start.width - deltaX
      break
    case 's':
      height = start.height + deltaY
      break
    case 'n':
      y = start.y + deltaY
      height = start.height - deltaY
      break
    case 'se':
      width = start.width + deltaX
      height = start.height + deltaY
      break
    case 'nw':
      x = start.x + deltaX
      y = start.y + deltaY
      width = start.width - deltaX
      height = start.height - deltaY
      break
    case 'ne':
      y = start.y + deltaY
      width = start.width + deltaX
      height = start.height - deltaY
      break
    case 'sw':
      x = start.x + deltaX
      width = start.width - deltaX
      height = start.height + deltaY
      break
  }

  if (lockAspect && aspect > 0) {
    const anchorMap: Record<CropHandleId, 'nw' | 'ne' | 'sw' | 'se'> = {
      nw: 'se',
      ne: 'sw',
      sw: 'ne',
      se: 'nw',
      n: 'sw',
      s: 'nw',
      w: 'ne',
      e: 'nw',
    }
    const anchor = anchorMap[handle]
    const anchorX =
      anchor === 'se' || anchor === 'ne'
        ? start.x + start.width
        : start.x
    const anchorY =
      anchor === 'se' || anchor === 'sw'
        ? start.y + start.height
        : start.y

    if (handle === 'n' || handle === 's') {
      width = height * aspect
    } else if (handle === 'e' || handle === 'w') {
      height = width / aspect
    } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      height = width / aspect
    } else {
      width = height * aspect
    }

    return clampCropFrame(
      repositionFromAnchor(anchorX, anchorY, width, height, anchor),
      stageWidth,
      stageHeight,
    )
  }

  if (handle === 'e' || handle === 'w') {
    return clampCropFrame({ x, y, width, height }, stageWidth, stageHeight)
  }

  if (handle === 'n' || handle === 's') {
    return clampCropFrame({ x, y, width, height }, stageWidth, stageHeight)
  }

  return clampCropFrame({ x, y, width, height }, stageWidth, stageHeight)
}

export function getCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return 1
  }

  return Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight)
}

export function getInitialCropTransform(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
): ImageCropTransform {
  const coverScale = getCoverScale(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
  )
  const displayWidth = naturalWidth * coverScale
  const displayHeight = naturalHeight * coverScale

  return {
    scale: 1,
    offsetX: (stageWidth - displayWidth) / 2,
    offsetY: (stageHeight - displayHeight) / 2,
  }
}

/** Image offsets are in stage space; cover scale is derived from the fixed stage size. */
export function getStageDisplayScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
  transform: ImageCropTransform,
): number {
  return (
    getCoverScale(naturalWidth, naturalHeight, stageWidth, stageHeight) *
    Math.max(1, transform.scale)
  )
}

export function getStageDisplaySize(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
  transform: ImageCropTransform,
): { width: number; height: number } {
  const scale = getStageDisplayScale(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
    transform,
  )

  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  }
}

export function clampCropPanForFrame(
  transform: ImageCropTransform,
  naturalWidth: number,
  naturalHeight: number,
  cropFrame: CropFrameRect,
  stageWidth: number,
  stageHeight: number,
): ImageCropTransform {
  const scale = Math.max(1, transform.scale)
  const display = getStageDisplaySize(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
    { ...transform, scale },
  )

  const minOffsetX = cropFrame.x + cropFrame.width - display.width
  const minOffsetY = cropFrame.y + cropFrame.height - display.height
  const maxOffsetX = cropFrame.x
  const maxOffsetY = cropFrame.y

  return {
    scale,
    offsetX: Math.min(maxOffsetX, Math.max(minOffsetX, transform.offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(minOffsetY, transform.offsetY)),
  }
}

/** @deprecated Use stage-space helpers; kept for callers migrating incrementally. */
export function getDisplayScale(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
  transform: ImageCropTransform,
): number {
  return getStageDisplayScale(
    naturalWidth,
    naturalHeight,
    frameWidth,
    frameHeight,
    transform,
  )
}

/** @deprecated Use getStageDisplaySize. */
export function getDisplaySize(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
  transform: ImageCropTransform,
): { width: number; height: number } {
  return getStageDisplaySize(
    naturalWidth,
    naturalHeight,
    frameWidth,
    frameHeight,
    transform,
  )
}

/** @deprecated Use clampCropPanForFrame. */
export function clampCropPan(
  transform: ImageCropTransform,
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): ImageCropTransform {
  return clampCropPanForFrame(
    transform,
    naturalWidth,
    naturalHeight,
    { x: 0, y: 0, width: frameWidth, height: frameHeight },
    frameWidth,
    frameHeight,
  )
}

export function viewportToNaturalRect(
  transform: ImageCropTransform,
  cropFrame: CropFrameRect,
  stageWidth: number,
  stageHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): NaturalRect {
  const clamped = clampCropPanForFrame(
    transform,
    naturalWidth,
    naturalHeight,
    cropFrame,
    stageWidth,
    stageHeight,
  )
  const displayScale = getStageDisplayScale(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
    clamped,
  )

  const x = (cropFrame.x - clamped.offsetX) / displayScale
  const y = (cropFrame.y - clamped.offsetY) / displayScale
  const width = cropFrame.width / displayScale
  const height = cropFrame.height / displayScale

  const clampedX = Math.max(0, Math.min(x, naturalWidth))
  const clampedY = Math.max(0, Math.min(y, naturalHeight))
  const maxWidth = naturalWidth - clampedX
  const maxHeight = naturalHeight - clampedY

  return {
    x: clampedX,
    y: clampedY,
    width: Math.max(1, Math.min(width, maxWidth)),
    height: Math.max(1, Math.min(height, maxHeight)),
  }
}

export function scaleNaturalRect(
  rect: NaturalRect,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): NaturalRect {
  if (fromWidth === toWidth && fromHeight === toHeight) {
    return rect
  }

  const scaleX = toWidth / fromWidth
  const scaleY = toHeight / fromHeight

  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }
}

function clampExportRect(rect: NaturalRect): NaturalRect {
  let { x, y, width, height } = rect

  if (width > STORYBOARD_MAX_IMAGE_CANVAS_WIDTH) {
    const scale = STORYBOARD_MAX_IMAGE_CANVAS_WIDTH / width
    width = STORYBOARD_MAX_IMAGE_CANVAS_WIDTH
    height = Math.round(height * scale)
  }

  if (height > STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT) {
    const scale = STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT / height
    height = STORYBOARD_MAX_IMAGE_CANVAS_HEIGHT
    width = Math.round(width * scale)
  }

  // Floor origin and ceil size so rounding never shifts the visible crop window.
  const roundedX = Math.max(0, Math.floor(x))
  const roundedY = Math.max(0, Math.floor(y))
  const roundedWidth = Math.max(1, Math.ceil(x + width) - roundedX)
  const roundedHeight = Math.max(1, Math.ceil(y + height) - roundedY)

  return {
    x: roundedX,
    y: roundedY,
    width: roundedWidth,
    height: roundedHeight,
  }
}

export function getImageTransformStyle(
  transform: ImageCropTransform,
  cropFrame: CropFrameRect,
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
): {
  width: number
  height: number
  left: number
  top: number
} {
  const clamped = clampCropPanForFrame(
    transform,
    naturalWidth,
    naturalHeight,
    cropFrame,
    stageWidth,
    stageHeight,
  )
  const display = getStageDisplaySize(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
    clamped,
  )

  return {
    width: display.width,
    height: display.height,
    left: clamped.offsetX - cropFrame.x,
    top: clamped.offsetY - cropFrame.y,
  }
}

export function zoomCropTransformAtPoint(
  transform: ImageCropTransform,
  naturalWidth: number,
  naturalHeight: number,
  cropFrame: CropFrameRect,
  stageWidth: number,
  stageHeight: number,
  pointerStageX: number,
  pointerStageY: number,
  deltaScale: number,
): ImageCropTransform {
  const current = clampCropPanForFrame(
    transform,
    naturalWidth,
    naturalHeight,
    cropFrame,
    stageWidth,
    stageHeight,
  )
  const nextScale = Math.max(1, current.scale * deltaScale)
  const currentDisplayScale = getStageDisplayScale(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
    current,
  )
  const nextDisplayScale = getStageDisplayScale(
    naturalWidth,
    naturalHeight,
    stageWidth,
    stageHeight,
    { ...current, scale: nextScale },
  )

  const imageX = (pointerStageX - current.offsetX) / currentDisplayScale
  const imageY = (pointerStageY - current.offsetY) / currentDisplayScale
  const nextOffsetX = pointerStageX - imageX * nextDisplayScale
  const nextOffsetY = pointerStageY - imageY * nextDisplayScale

  return clampCropPanForFrame(
    {
      scale: nextScale,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    },
    naturalWidth,
    naturalHeight,
    cropFrame,
    stageWidth,
    stageHeight,
  )
}

export function getWheelZoomScaleFactor(event: WheelEvent): number {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const factor = event.ctrlKey && isMac ? 10 : 1
  const delta =
    -event.deltaY *
    (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) *
    factor

  return Math.pow(2, delta)
}

export async function renderCropToBlob(
  image: HTMLImageElement,
  rect: NaturalRect,
): Promise<{ blob: Blob; rect: NaturalRect }> {
  const exportRect = clampExportRect(rect)
  const canvas = document.createElement('canvas')
  canvas.width = exportRect.width
  canvas.height = exportRect.height

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create crop canvas.')
  }

  context.drawImage(
    image,
    exportRect.x,
    exportRect.y,
    exportRect.width,
    exportRect.height,
    0,
    0,
    exportRect.width,
    exportRect.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export cropped image.'))
          return
        }

        resolve({ blob, rect: exportRect })
      },
      'image/png',
    )
  })
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve(image)
    }

    image.onerror = () => {
      reject(new Error('Could not load image for cropping.'))
    }

    image.src = src
  })
}
