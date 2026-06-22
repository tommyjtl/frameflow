import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { applyImageCrop, getImageCropErrorMessage } from './imageCropPlacement'
import {
  clampCropFrame,
  clampCropPanForFrame,
  getFullCropFrame,
  getInitialCropTransform,
  loadImageElement,
  type CropFrameRect,
  type ImageCropTransform,
} from './imageCropMath'
import {
  MEDIA_CARD_NODE_TYPE,
  MEDIA_CARD_Z_INDEX,
  isImageNodeData,
  normalizeImageNodeDimensions,
  type BoardInteractionMode,
  type ImageCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'

type StoryboardImageCropContextValue = {
  croppingNodeId: string | null
  cropTransform: ImageCropTransform | null
  cropFrame: CropFrameRect | null
  stageWidth: number
  stageHeight: number
  naturalWidth: number
  naturalHeight: number
  isApplyingCrop: boolean
  enterCropMode: (nodeId: string) => void
  cancelCrop: () => void
  applyCrop: () => Promise<void>
  updateCropTransform: (transform: ImageCropTransform) => void
  updateCropFrame: (frame: CropFrameRect) => void
}

const StoryboardImageCropContext =
  createContext<StoryboardImageCropContextValue | null>(null)

type StoryboardImageCropProviderProps = {
  children: ReactNode
  nodes: StoryboardNodeType[]
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  takeSnapshot: () => void
  interactionMode: BoardInteractionMode
  onCloseContextMenu: () => void
  showMessage: (text: string, type: 'error' | 'info') => void
}

function getImageSource(
  nodes: StoryboardNodeType[],
  nodeId: string,
): ImageCardNodeType | undefined {
  const node = nodes.find((item) => item.id === nodeId)

  if (
    !node ||
    node.type !== MEDIA_CARD_NODE_TYPE ||
    !isImageNodeData(node.data)
  ) {
    return undefined
  }

  return node as ImageCardNodeType
}

export function StoryboardImageCropProvider({
  children,
  nodes,
  setNodes,
  takeSnapshot,
  interactionMode,
  onCloseContextMenu,
  showMessage,
}: StoryboardImageCropProviderProps) {
  const [croppingNodeId, setCroppingNodeId] = useState<string | null>(null)
  const [cropTransform, setCropTransform] = useState<ImageCropTransform | null>(
    null,
  )
  const [cropFrame, setCropFrame] = useState<CropFrameRect | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [isApplyingCrop, setIsApplyingCrop] = useState(false)
  const nodesRef = useRef(nodes)
  const naturalSizeRef = useRef({ width: 0, height: 0 })

  nodesRef.current = nodes

  useEffect(() => {
    if (croppingNodeId && !nodes.some((node) => node.id === croppingNodeId)) {
      setCroppingNodeId(null)
      setCropTransform(null)
      setCropFrame(null)
      setStageSize({ width: 0, height: 0 })
      setNaturalSize({ width: 0, height: 0 })
      naturalSizeRef.current = { width: 0, height: 0 }
      setIsApplyingCrop(false)
    }
  }, [croppingNodeId, nodes])

  const restoreNodeAfterCrop = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                draggable: true,
                zIndex: MEDIA_CARD_Z_INDEX,
                selectable: undefined,
              }
            : node,
        ),
      )
    },
    [setNodes],
  )

  const cancelCrop = useCallback(() => {
    const nodeId = croppingNodeId

    if (nodeId) {
      restoreNodeAfterCrop(nodeId)
    }

    setCroppingNodeId(null)
    setCropTransform(null)
    setCropFrame(null)
    setStageSize({ width: 0, height: 0 })
    setNaturalSize({ width: 0, height: 0 })
    naturalSizeRef.current = { width: 0, height: 0 }
    setIsApplyingCrop(false)
  }, [croppingNodeId, restoreNodeAfterCrop])

  const enterCropMode = useCallback(
    (nodeId: string) => {
      if (interactionMode !== 'select' || croppingNodeId) {
        return
      }

      const source = getImageSource(nodesRef.current, nodeId)

      if (
        !source ||
        !source.data.src ||
        source.data.importStatus === 'downloading'
      ) {
        return
      }

      const nodeWidth = source.width ?? 0
      const nodeHeight = source.height ?? 0

      if (nodeWidth <= 0 || nodeHeight <= 0) {
        return
      }

      onCloseContextMenu()
      setCropTransform(null)
      setCropFrame(null)
      setStageSize({ width: 0, height: 0 })
      setNaturalSize({ width: 0, height: 0 })
      naturalSizeRef.current = { width: 0, height: 0 }
      setCroppingNodeId(nodeId)

      const normalizedStage =
        source.data.naturalWidth && source.data.naturalHeight
          ? normalizeImageNodeDimensions(
              nodeWidth,
              nodeHeight,
              source.data.naturalWidth,
              source.data.naturalHeight,
            )
          : { width: nodeWidth, height: nodeHeight }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type !== MEDIA_CARD_NODE_TYPE) {
            return node.selected ? { ...node, selected: false } : node
          }

          const isTarget = node.id === nodeId

          return {
            ...node,
            selected: isTarget,
            selectable: isTarget ? true : undefined,
            draggable: !isTarget,
            zIndex: isTarget ? 100 : node.zIndex,
            ...(isTarget &&
            (node.width !== normalizedStage.width ||
              node.height !== normalizedStage.height)
              ? {
                  width: normalizedStage.width,
                  height: normalizedStage.height,
                }
              : {}),
          }
        }),
      )

      void (async () => {
        try {
          const image = await loadImageElement(source.data.src)
          const naturalWidth = image.naturalWidth
          const naturalHeight = image.naturalHeight

          if (naturalWidth <= 0 || naturalHeight <= 0) {
            throw new Error('Could not read image dimensions for cropping.')
          }

          const stage = normalizeImageNodeDimensions(
            normalizedStage.width,
            normalizedStage.height,
            naturalWidth,
            naturalHeight,
          )
          const stageWidth = stage.width
          const stageHeight = stage.height
          const initialFrame = getFullCropFrame(stageWidth, stageHeight)

          naturalSizeRef.current = { width: naturalWidth, height: naturalHeight }
          setNaturalSize({ width: naturalWidth, height: naturalHeight })
          setStageSize({ width: stageWidth, height: stageHeight })
          setCropFrame(initialFrame)
          setCropTransform(
            getInitialCropTransform(
              naturalWidth,
              naturalHeight,
              stageWidth,
              stageHeight,
            ),
          )

          if (
            stageWidth !== normalizedStage.width ||
            stageHeight !== normalizedStage.height
          ) {
            setNodes((currentNodes) =>
              currentNodes.map((node) =>
                node.id === nodeId
                  ? { ...node, width: stageWidth, height: stageHeight }
                  : node,
              ),
            )
          }
        } catch (error) {
          setCroppingNodeId(null)
          restoreNodeAfterCrop(nodeId)
          showMessage(getImageCropErrorMessage(error), 'error')
        }
      })()
    },
    [
      croppingNodeId,
      interactionMode,
      onCloseContextMenu,
      restoreNodeAfterCrop,
      setNodes,
      showMessage,
    ],
  )

  const applyCrop = useCallback(async () => {
    const nodeId = croppingNodeId
    const transform = cropTransform
    const frame = cropFrame

    if (!nodeId || !transform || !frame || isApplyingCrop) {
      return
    }

    setIsApplyingCrop(true)

    try {
      await applyImageCrop({
        nodeId,
        transform,
        cropFrame: frame,
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        naturalWidth: naturalSizeRef.current.width,
        naturalHeight: naturalSizeRef.current.height,
        getSource: () => getImageSource(nodesRef.current, nodeId),
        setNodes,
        takeSnapshot,
      })
      showMessage('Applied crop to image card.', 'info')
      setCroppingNodeId(null)
      setCropTransform(null)
      setCropFrame(null)
      setStageSize({ width: 0, height: 0 })
      setNaturalSize({ width: 0, height: 0 })
      naturalSizeRef.current = { width: 0, height: 0 }
    } catch (error) {
      showMessage(getImageCropErrorMessage(error), 'error')
    } finally {
      setIsApplyingCrop(false)
    }
  }, [
    cropFrame,
    cropTransform,
    croppingNodeId,
    isApplyingCrop,
    setNodes,
    showMessage,
    stageSize.height,
    stageSize.width,
    takeSnapshot,
  ])

  const updateCropTransform = useCallback(
    (transform: ImageCropTransform) => {
      const frame = cropFrame
      const { width: stageWidth, height: stageHeight } = stageSize
      const { width: naturalWidth, height: naturalHeight } =
        naturalSizeRef.current

      if (!frame || stageWidth <= 0 || stageHeight <= 0) {
        setCropTransform(transform)
        return
      }

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        setCropTransform(transform)
        return
      }

      setCropTransform(
        clampCropPanForFrame(
          transform,
          naturalWidth,
          naturalHeight,
          frame,
          stageWidth,
          stageHeight,
        ),
      )
    },
    [cropFrame, stageSize],
  )

  const updateCropFrame = useCallback(
    (frame: CropFrameRect) => {
      const { width: stageWidth, height: stageHeight } = stageSize
      const { width: naturalWidth, height: naturalHeight } =
        naturalSizeRef.current

      if (stageWidth <= 0 || stageHeight <= 0) {
        return
      }

      const clamped = clampCropFrame(frame, stageWidth, stageHeight)

      setCropFrame(clamped)
      setCropTransform((current) => {
        if (!current || naturalWidth <= 0 || naturalHeight <= 0) {
          return current
        }

        return clampCropPanForFrame(
          current,
          naturalWidth,
          naturalHeight,
          clamped,
          stageWidth,
          stageHeight,
        )
      })
    },
    [stageSize],
  )

  useEffect(() => {
    if (interactionMode !== 'select' && croppingNodeId) {
      cancelCrop()
    }
  }, [cancelCrop, croppingNodeId, interactionMode])

  const value = useMemo(
    (): StoryboardImageCropContextValue => ({
      croppingNodeId,
      cropTransform,
      cropFrame,
      stageWidth: stageSize.width,
      stageHeight: stageSize.height,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      isApplyingCrop,
      enterCropMode,
      cancelCrop,
      applyCrop,
      updateCropTransform,
      updateCropFrame,
    }),
    [
      applyCrop,
      cancelCrop,
      cropFrame,
      cropTransform,
      croppingNodeId,
      enterCropMode,
      isApplyingCrop,
      naturalSize.height,
      naturalSize.width,
      stageSize.height,
      stageSize.width,
      updateCropFrame,
      updateCropTransform,
    ],
  )

  return (
    <StoryboardImageCropContext.Provider value={value}>
      {children}
    </StoryboardImageCropContext.Provider>
  )
}

export function useStoryboardImageCrop(): StoryboardImageCropContextValue {
  const context = useContext(StoryboardImageCropContext)

  if (!context) {
    throw new Error(
      'useStoryboardImageCrop must be used within StoryboardImageCropProvider',
    )
  }

  return context
}
