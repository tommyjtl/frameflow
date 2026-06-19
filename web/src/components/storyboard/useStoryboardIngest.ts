import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { StoryboardApiError, uploadAsset } from './storyboardApi'
import {
  getFilesFromDataTransfer,
  getPasteImageFiles,
  hasFileDrag,
  labelFromFileName,
  loadImageDimensions,
  nodePositionForDrop,
  nodePositionForPaste,
  validateIngestFile,
} from './storyboardIngest'
import {
  STORYBOARD_DEFAULT_NODE_HEIGHT,
  STORYBOARD_DEFAULT_NODE_WIDTH,
  createImageNode,
  createVideoNode,
  getImageNodeDimensions,
  type StoryboardNodeType,
} from './storyboardTypes'

type UseStoryboardIngestOptions = {
  enabled: boolean
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  getNodes: () => StoryboardNodeType[]
  screenToFlowPosition: (position: { x: number; y: number }) => {
    x: number
    y: number
  }
  onMessage: (text: string, type: 'error' | 'info') => void
  playgroundRef: React.RefObject<HTMLElement | null>
}

export function useStoryboardIngest({
  enabled,
  setNodes,
  getNodes,
  screenToFlowPosition,
  onMessage,
  playgroundRef,
}: UseStoryboardIngestOptions) {
  const [dragActive, setDragActive] = useState(false)
  const dragDepthRef = useRef(0)

  const getViewportCenterFlowPosition = useCallback(() => {
    const pane = playgroundRef.current
      ?.querySelector('.react-flow')
      ?.getBoundingClientRect()

    if (!pane) {
      return { x: 0, y: 0 }
    }

    return screenToFlowPosition({
      x: pane.left + pane.width / 2,
      y: pane.top + pane.height / 2,
    })
  }, [playgroundRef, screenToFlowPosition])

  const ingestFilesAt = useCallback(
    async (files: File[], anchor: { x: number; y: number }) => {
      if (!enabled || files.length === 0) {
        return
      }

      let successCount = 0
      let lastError: string | null = null
      const startCount = getNodes().length

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const validation = validateIngestFile(file)

        if (!validation.ok) {
          lastError = validation.error
          continue
        }

        try {
          const asset = await uploadAsset(file)
          const label = labelFromFileName(
            file.name,
            asset.kind,
            startCount + successCount + 1,
          )
          const nodeId = crypto.randomUUID()

          if (asset.kind === 'video') {
            const position = nodePositionForDrop(
              anchor,
              STORYBOARD_DEFAULT_NODE_WIDTH,
              STORYBOARD_DEFAULT_NODE_HEIGHT,
              index,
            )

            setNodes((currentNodes) => [
              ...currentNodes,
              createVideoNode(nodeId, position, {
                label,
                src: asset.url,
                assetId: asset.id,
              }),
            ])
          } else {
            const natural = await loadImageDimensions(asset.url)
            const nodeDimensions = getImageNodeDimensions(
              natural?.naturalWidth,
              natural?.naturalHeight,
            )
            const position = nodePositionForDrop(
              anchor,
              nodeDimensions.width,
              nodeDimensions.height,
              index,
            )

            setNodes((currentNodes) => [
              ...currentNodes,
              createImageNode(
                nodeId,
                position,
                {
                  label,
                  src: asset.url,
                  assetId: asset.id,
                  naturalWidth: natural?.naturalWidth,
                  naturalHeight: natural?.naturalHeight,
                },
                nodeDimensions,
              ),
            ])
          }

          successCount += 1
        } catch (error) {
          lastError =
            error instanceof StoryboardApiError
              ? error.message
              : 'Upload failed.'
        }
      }

      if (successCount > 0) {
        onMessage(
          `Added ${successCount} ${successCount === 1 ? 'card' : 'cards'}.`,
          'info',
        )
      }

      if (lastError) {
        onMessage(lastError, 'error')
      }
    },
    [enabled, getNodes, onMessage, setNodes],
  )

  const ingestPasteImages = useCallback(
    async (files: File[]) => {
      const anchor = nodePositionForPaste(
        getNodes,
        getViewportCenterFlowPosition(),
        STORYBOARD_DEFAULT_NODE_WIDTH,
        STORYBOARD_DEFAULT_NODE_HEIGHT,
        0,
      )

      await ingestFilesAt(files, anchor)
    },
    [getNodes, getViewportCenterFlowPosition, ingestFilesAt],
  )

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0
    setDragActive(false)
  }, [])

  const handleDragEnter = useCallback(
    (event: DragEvent) => {
      if (!enabled || !hasFileDrag(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current += 1
      setDragActive(true)
    },
    [enabled],
  )

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (!hasFileDrag(event.dataTransfer)) {
      return
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

    if (dragDepthRef.current === 0) {
      setDragActive(false)
    }
  }, [])

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!hasFileDrag(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent) => {
      resetDragState()

      if (!enabled) {
        return
      }

      event.preventDefault()

      const files = getFilesFromDataTransfer(event.dataTransfer)

      if (files.length === 0) {
        return
      }

      const anchor = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      void ingestFilesAt(files, anchor)
    },
    [enabled, ingestFilesAt, resetDragState, screenToFlowPosition],
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handlePaste = (event: ClipboardEvent) => {
      const playground = playgroundRef.current

      if (!playground) {
        return
      }

      const activeElement = document.activeElement
      const focusInsidePlayground =
        activeElement === playground || playground.contains(activeElement)

      if (!focusInsidePlayground) {
        return
      }

      if (!event.clipboardData) {
        return
      }

      const files = getPasteImageFiles(event.clipboardData)

      if (files.length === 0) {
        return
      }

      event.preventDefault()
      void ingestPasteImages(files)
    }

    window.addEventListener('paste', handlePaste)

    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [enabled, ingestPasteImages, playgroundRef])

  return {
    dragActive,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    ingestFilesAt,
    getViewportCenterFlowPosition,
  }
}
