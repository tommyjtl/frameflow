import { StoryboardApiError, uploadAsset } from './storyboardApi'
import {
  loadImageElement,
  renderCropToBlob,
  scaleNaturalRect,
  viewportToNaturalRect,
  type CropFrameRect,
  type ImageCropTransform,
} from './imageCropMath'
import {
  getImageNodeDimensions,
  isImageNodeData,
  MEDIA_CARD_NODE_TYPE,
  MEDIA_CARD_Z_INDEX,
  type ImageCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'

type ApplyImageCropOptions = {
  nodeId: string
  transform: ImageCropTransform
  cropFrame: CropFrameRect
  stageWidth: number
  stageHeight: number
  naturalWidth: number
  naturalHeight: number
  getSource: () => ImageCardNodeType | undefined
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  takeSnapshot: () => void
}

export function getImageCropErrorMessage(error: unknown): string {
  if (error instanceof StoryboardApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Could not apply crop.'
}

export async function applyImageCrop({
  nodeId,
  transform,
  cropFrame,
  stageWidth,
  stageHeight,
  naturalWidth,
  naturalHeight,
  getSource,
  setNodes,
  takeSnapshot,
}: ApplyImageCropOptions): Promise<void> {
  const source = getSource()

  if (!source || !isImageNodeData(source.data) || !source.data.src) {
    return
  }

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error('Image dimensions are not available for cropping.')
  }

  const image = await loadImageElement(source.data.src)
  const cropRect = viewportToNaturalRect(
    transform,
    cropFrame,
    stageWidth,
    stageHeight,
    naturalWidth,
    naturalHeight,
  )
  const exportRect = scaleNaturalRect(
    cropRect,
    naturalWidth,
    naturalHeight,
    image.naturalWidth,
    image.naturalHeight,
  )
  const { blob, rect: bakedRect } = await renderCropToBlob(image, exportRect)
  const file = new File(
    [blob],
    `${source.data.label}-crop.png`,
    { type: 'image/png' },
  )
  const asset = await uploadAsset(file)
  const croppedNaturalWidth = bakedRect.width
  const croppedNaturalHeight = bakedRect.height
  const dimensions = getImageNodeDimensions(
    croppedNaturalWidth,
    croppedNaturalHeight,
  )

  takeSnapshot()
  setNodes((currentNodes) =>
    currentNodes.map((node) => {
      if (node.id !== nodeId || node.type !== MEDIA_CARD_NODE_TYPE) {
        return node
      }

      if (!isImageNodeData(node.data)) {
        return node
      }

      return {
        ...node,
        width: dimensions.width,
        height: dimensions.height,
        draggable: true,
        selected: true,
        selectable: undefined,
        zIndex: MEDIA_CARD_Z_INDEX,
        data: {
          ...node.data,
          src: asset.url,
          assetId: asset.id,
          naturalWidth: croppedNaturalWidth,
          naturalHeight: croppedNaturalHeight,
        },
      }
    }),
  )
}
