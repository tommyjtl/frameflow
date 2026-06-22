import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { FrameCaptureResult } from '../../frameflow'
import type { FrameCaptureRegistration } from './storyboardFrameCapture'
import {
  extractFrameToPosition,
  flowPositionForFrameExtractDrop,
  getDefaultExtractFramePosition,
  getExtractFrameGhostSize,
  getExtractFrameImageNodeDimensions,
  getExtractFrameErrorMessage,
  isPointInsideRect,
  placeExtractedFrame,
} from './frameExtractPlacement'
import {
  MEDIA_CARD_NODE_TYPE,
  isVideoNodeData,
  type MediaCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'

type FrameExtractDragContextValue = {
  beginFrameExtractFromButton: (
    sourceNodeId: string,
    button: HTMLElement,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void
}

const FrameExtractDragContext = createContext<FrameExtractDragContextValue | null>(
  null,
)

type DragPhase = 'idle' | 'armed' | 'capturing' | 'dragging' | 'committing'

type GhostState = {
  previewUrl: string
  pointerX: number
  pointerY: number
  width: number
  height: number
}

type FrameExtractDragProviderProps = {
  children: ReactNode
  getNodes: () => StoryboardNodeType[]
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  takeSnapshot: () => void
  showIngestMessage: (text: string, type: 'error' | 'info') => void
  screenToFlowPosition: (position: { x: number; y: number }) => {
    x: number
    y: number
  }
  getFrameCapture: (nodeId: string) => FrameCaptureRegistration | undefined
}

function getVideoSource(
  getNodes: () => StoryboardNodeType[],
  sourceNodeId: string,
): MediaCardNodeType | undefined {
  const source = getNodes().find((node) => node.id === sourceNodeId)

  if (
    !source ||
    source.type !== MEDIA_CARD_NODE_TYPE ||
    !isVideoNodeData(source.data)
  ) {
    return undefined
  }

  return source
}

export function FrameExtractDragProvider({
  children,
  getNodes,
  setNodes,
  takeSnapshot,
  showIngestMessage,
  screenToFlowPosition,
  getFrameCapture,
}: FrameExtractDragProviderProps) {
  const phaseRef = useRef<DragPhase>('idle')
  const sourceNodeIdRef = useRef<string | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const buttonRectRef = useRef<DOMRect | null>(null)
  const capturedRef = useRef<FrameCaptureResult | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const pendingDropRef = useRef<{ x: number; y: number } | null>(null)
  const cancelledRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const [ghost, setGhost] = useState<GhostState | null>(null)

  const cleanup = useCallback(() => {
    if (
      captureTargetRef.current &&
      pointerIdRef.current !== null &&
      captureTargetRef.current.hasPointerCapture(pointerIdRef.current)
    ) {
      captureTargetRef.current.releasePointerCapture(pointerIdRef.current)
    }

    phaseRef.current = 'idle'
    sourceNodeIdRef.current = null
    pointerIdRef.current = null
    captureTargetRef.current = null
    buttonRectRef.current = null
    capturedRef.current = null
    pendingDropRef.current = null
    cancelledRef.current = false

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    setGhost(null)
  }, [])

  const commitCapturedFrame = useCallback(
    async (
      sourceNodeId: string,
      captured: FrameCaptureResult,
      clientX: number,
      clientY: number,
    ) => {
      const source = getVideoSource(getNodes, sourceNodeId)

      if (!source) {
        return
      }

      phaseRef.current = 'committing'

      try {
        const nodeDimensions = getExtractFrameImageNodeDimensions(
          source,
          captured.naturalWidth,
          captured.naturalHeight,
        )
        const position = flowPositionForFrameExtractDrop(
          clientX,
          clientY,
          nodeDimensions.width,
          nodeDimensions.height,
          screenToFlowPosition,
        )

        await placeExtractedFrame({
          sourceNodeId,
          source,
          captured,
          position,
          setNodes,
          takeSnapshot,
        })
        showIngestMessage('Extracted frame to new image card.', 'info')
      } catch (error) {
        showIngestMessage(getExtractFrameErrorMessage(error), 'error')
      } finally {
        cleanup()
      }
    },
    [cleanup, getNodes, screenToFlowPosition, setNodes, showIngestMessage, takeSnapshot],
  )

  const commitDefaultPlacement = useCallback(
    async (sourceNodeId: string) => {
      const registration = getFrameCapture(sourceNodeId)

      if (!registration?.canExtract()) {
        showIngestMessage(
          'Pause the video and wait for it to be ready before extracting a frame.',
          'error',
        )
        cleanup()
        return
      }

      phaseRef.current = 'committing'

      const source = getVideoSource(getNodes, sourceNodeId)

      if (!source) {
        cleanup()
        return
      }

      try {
        await extractFrameToPosition({
          sourceNodeId,
          position: getDefaultExtractFramePosition(source),
          getSource: () => getVideoSource(getNodes, sourceNodeId),
          capture: registration.capture,
          setNodes,
          takeSnapshot,
        })
        showIngestMessage('Extracted frame to new image card.', 'info')
      } catch (error) {
        showIngestMessage(getExtractFrameErrorMessage(error), 'error')
      } finally {
        cleanup()
      }
    },
    [cleanup, getFrameCapture, getNodes, setNodes, showIngestMessage, takeSnapshot],
  )

  const startCaptureForDrag = useCallback(
    async (sourceNodeId: string) => {
      const registration = getFrameCapture(sourceNodeId)

      if (!registration?.canExtract()) {
        showIngestMessage(
          'Pause the video and wait for it to be ready before extracting a frame.',
          'error',
        )
        cleanup()
        return
      }

      phaseRef.current = 'capturing'

      try {
        const captured = await registration.capture()

        if (cancelledRef.current) {
          cleanup()
          return
        }

        if (!captured) {
          showIngestMessage('Could not capture the current frame.', 'error')
          cleanup()
          return
        }

        capturedRef.current = captured

        const source = getVideoSource(getNodes, sourceNodeId)

        if (!source) {
          cleanup()
          return
        }

        const previewUrl = URL.createObjectURL(captured.blob)
        previewUrlRef.current = previewUrl

        const nodeDimensions = getExtractFrameImageNodeDimensions(
          source,
          captured.naturalWidth,
          captured.naturalHeight,
        )
        const ghostSize = getExtractFrameGhostSize(
          nodeDimensions.width,
          nodeDimensions.height,
        )
        const pointer = lastPointerRef.current
        const drop = pendingDropRef.current

        if (drop) {
          pendingDropRef.current = null
          await commitCapturedFrame(
            sourceNodeId,
            captured,
            drop.x,
            drop.y,
          )
          return
        }

        phaseRef.current = 'dragging'
        setGhost({
          previewUrl,
          pointerX: pointer.x,
          pointerY: pointer.y,
          width: ghostSize.width,
          height: ghostSize.height,
        })
      } catch (error) {
        showIngestMessage(getExtractFrameErrorMessage(error), 'error')
        cleanup()
      }
    },
    [
      cleanup,
      commitCapturedFrame,
      getFrameCapture,
      getNodes,
      showIngestMessage,
    ],
  )

  const beginFrameExtractFromButton = useCallback(
    (
      sourceNodeId: string,
      button: HTMLElement,
      event: ReactPointerEvent<HTMLButtonElement>,
    ) => {
      if (phaseRef.current !== 'idle') {
        return
      }

      const registration = getFrameCapture(sourceNodeId)

      if (!registration?.canExtract()) {
        return
      }

      event.preventDefault()
      button.setPointerCapture(event.pointerId)

      phaseRef.current = 'armed'
      sourceNodeIdRef.current = sourceNodeId
      pointerIdRef.current = event.pointerId
      captureTargetRef.current = button
      buttonRectRef.current = button.getBoundingClientRect()
      cancelledRef.current = false
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
    },
    [getFrameCapture],
  )

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (
        event.pointerId !== pointerIdRef.current ||
        phaseRef.current === 'idle' ||
        phaseRef.current === 'committing'
      ) {
        return
      }

      const sourceNodeId = sourceNodeIdRef.current
      const buttonRect = buttonRectRef.current

      if (!sourceNodeId || !buttonRect) {
        return
      }

      lastPointerRef.current = { x: event.clientX, y: event.clientY }

      if (phaseRef.current === 'armed') {
        if (isPointInsideRect(event.clientX, event.clientY, buttonRect)) {
          return
        }

        void startCaptureForDrag(sourceNodeId)
        return
      }

      if (phaseRef.current === 'dragging') {
        setGhost((current) =>
          current
            ? {
                ...current,
                pointerX: event.clientX,
                pointerY: event.clientY,
              }
            : current,
        )
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (
        event.pointerId !== pointerIdRef.current ||
        phaseRef.current === 'idle' ||
        phaseRef.current === 'committing'
      ) {
        return
      }

      const sourceNodeId = sourceNodeIdRef.current

      if (!sourceNodeId) {
        cleanup()
        return
      }

      if (phaseRef.current === 'armed') {
        void commitDefaultPlacement(sourceNodeId)
        return
      }

      if (phaseRef.current === 'capturing') {
        pendingDropRef.current = {
          x: event.clientX,
          y: event.clientY,
        }
        return
      }

      if (phaseRef.current === 'dragging') {
        const captured = capturedRef.current

        if (!captured) {
          cleanup()
          return
        }

        void commitCapturedFrame(
          sourceNodeId,
          captured,
          event.clientX,
          event.clientY,
        )
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (
        phaseRef.current === 'armed' ||
        phaseRef.current === 'capturing' ||
        phaseRef.current === 'dragging'
      ) {
        event.preventDefault()
        cancelledRef.current = true
        cleanup()
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    cleanup,
    commitCapturedFrame,
    commitDefaultPlacement,
    startCaptureForDrag,
  ])

  const value = useMemo(
    (): FrameExtractDragContextValue => ({
      beginFrameExtractFromButton,
    }),
    [beginFrameExtractFromButton],
  )

  return (
    <FrameExtractDragContext.Provider value={value}>
      {children}
      {ghost
        ? createPortal(
            <div
              className="frame-extract-ghost"
              style={{
                left: ghost.pointerX - ghost.width / 2,
                top: ghost.pointerY - ghost.height / 2,
                width: ghost.width,
                height: ghost.height,
              }}
            >
              <img
                src={ghost.previewUrl}
                alt=""
                draggable={false}
                className="frame-extract-ghost__image"
              />
            </div>,
            document.body,
          )
        : null}
    </FrameExtractDragContext.Provider>
  )
}

export function useFrameExtractDrag(): FrameExtractDragContextValue {
  const context = useContext(FrameExtractDragContext)

  if (!context) {
    throw new Error(
      'useFrameExtractDrag must be used within FrameExtractDragProvider',
    )
  }

  return context
}
