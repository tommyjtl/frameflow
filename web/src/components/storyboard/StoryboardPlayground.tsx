import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeMouseHandler,
} from '@xyflow/react'
import { DEFAULT_SAMPLE_VIDEO } from '../../frameflow'
import {
  boardToFlow,
  createDefaultStoryboard,
  flowToBoardPayload,
} from './boardMapping'
import { StoryboardCardActionsProvider } from './StoryboardCardActionsContext'
import { StoryboardFlow, isMediaCardContextMenuTarget } from './StoryboardFlow'
import { type StoryboardContextMenuState } from './StoryboardContextMenu'
import { deleteAsset, fetchBoard, saveBoard, StoryboardApiError, uploadAsset } from './storyboardApi'
import type { FrameCaptureRegistration } from './storyboardFrameCapture'
import { useStoryboardIngest } from './useStoryboardIngest'
import { useStoryboardHotkeys } from './useStoryboardHotkeys'
import {
  STORYBOARD_DEFAULT_NODE_WIDTH,
  STORYBOARD_DUPLICATE_OFFSET,
  STORYBOARD_EXTRACT_FRAME_GAP,
  STORYBOARD_NODE_X_GAP,
  STORYBOARD_NODE_Y,
  createImageNode,
  createVideoNode,
  getCanvasDimensions,
  isFreehandDrawNode,
  isImageNodeData,
  isVideoNodeData,
  normalizeImageNodeDimensions,
  type BoardInteractionMode,
  type FreehandDrawNodeType,
  MEDIA_CARD_NODE_TYPE,
  type MediaCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'
import '@xyflow/react/dist/style.css'
import './storyboard.css'

const SAVE_DEBOUNCE_MS = 500
const CONTEXT_MENU_ESTIMATED_HEIGHT = 168
const INGEST_MESSAGE_MS = 5000

type LoadState = 'loading' | 'ready' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function FitViewWhenReady({ ready }: { ready: boolean }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!ready) {
      return
    }

    void fitView({ padding: 0.2 })
  }, [ready, fitView])

  return null
}

function StoryboardPlaygroundInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StoryboardNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [interactionMode, setInteractionMode] =
    useState<BoardInteractionMode>('select')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ingestMessage, setIngestMessage] = useState<{
    text: string
    type: 'error' | 'info'
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<StoryboardContextMenuState>(null)
  const isHydratedRef = useRef(false)
  const saveRequestRef = useRef(0)
  const flowRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const ingestMessageTimerRef = useRef<number | null>(null)
  const frameCaptureRegistryRef = useRef(new Map<string, FrameCaptureRegistration>())
  const { screenToFlowPosition, getNodes: getFlowNodes } =
    useReactFlow<StoryboardNodeType>()
  const getNodes = useCallback(() => getFlowNodes(), [getFlowNodes])

  const handleNodesChange = useCallback(
    (changes: NodeChange<StoryboardNodeType>[]) => {
      const normalizedChanges = changes.map((change) => {
        if (
          change.type !== 'dimensions' ||
          change.dimensions?.width == null ||
          change.dimensions.height == null
        ) {
          return change
        }

        const node = getNodes().find((item) => item.id === change.id)

        if (
          !node ||
          isFreehandDrawNode(node) ||
          !isImageNodeData(node.data) ||
          !node.data.naturalWidth ||
          !node.data.naturalHeight
        ) {
          return change
        }

        const normalized = normalizeImageNodeDimensions(
          change.dimensions.width,
          change.dimensions.height,
          node.data.naturalWidth,
          node.data.naturalHeight,
        )

        return {
          ...change,
          dimensions: {
            ...change.dimensions,
            width: normalized.width,
            height: normalized.height,
          },
        }
      })

      onNodesChange(normalizedChanges)
    },
    [getNodes, onNodesChange],
  )

  const showIngestMessage = useCallback((text: string, type: 'error' | 'info') => {
    setIngestMessage({ text, type })

    if (ingestMessageTimerRef.current !== null) {
      window.clearTimeout(ingestMessageTimerRef.current)
    }

    ingestMessageTimerRef.current = window.setTimeout(() => {
      setIngestMessage(null)
      ingestMessageTimerRef.current = null
    }, INGEST_MESSAGE_MS)
  }, [])

  const hydrateBoard = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    isHydratedRef.current = false

    try {
      const board = await fetchBoard()

      if (board.nodes.length === 0) {
        const seeded = createDefaultStoryboard()
        setNodes(seeded.nodes)
        setEdges(seeded.edges)
        await saveBoard(flowToBoardPayload(seeded.nodes, seeded.edges))
      } else {
        const flow = boardToFlow(board)
        setNodes(flow.nodes)
        setEdges(flow.edges)
      }

      isHydratedRef.current = true
      setLoadState('ready')
      setSaveState('saved')
    } catch (error) {
      isHydratedRef.current = false
      setLoadState('error')
      setLoadError(
        error instanceof StoryboardApiError
          ? error.message
          : 'Could not load the storyboard.',
      )
    }
  }, [setEdges, setNodes])

  useEffect(() => {
    void hydrateBoard()
  }, [hydrateBoard])

  useEffect(() => {
    if (!isHydratedRef.current || loadState !== 'ready') {
      return
    }

    const requestId = ++saveRequestRef.current
    setSaveState('saving')
    setSaveError(null)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveBoard(flowToBoardPayload(nodes, edges))

          if (saveRequestRef.current !== requestId) {
            return
          }

          setSaveState('saved')
        } catch (error) {
          if (saveRequestRef.current !== requestId) {
            return
          }

          setSaveState('error')
          setSaveError(
            error instanceof StoryboardApiError
              ? error.message
              : 'Could not save the storyboard.',
          )
        }
      })()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [edges, loadState, nodes])

  const {
    dragActive,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    ingestFilesAt,
    getViewportCenterFlowPosition,
  } = useStoryboardIngest({
    enabled: loadState === 'ready' && interactionMode === 'select',
    setNodes,
    getNodes,
    screenToFlowPosition,
    onMessage: showIngestMessage,
    playgroundRef,
  })

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: 'default' }, currentEdges),
      )
    },
    [setEdges],
  )

  const duplicateNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => {
        const source = currentNodes.find((node) => node.id === nodeId)

        if (!source || isFreehandDrawNode(source)) {
          return currentNodes
        }

        const duplicate: MediaCardNodeType = {
          ...source,
          id: crypto.randomUUID(),
          position: {
            x: source.position.x + STORYBOARD_DUPLICATE_OFFSET.x,
            y: source.position.y + STORYBOARD_DUPLICATE_OFFSET.y,
          },
          data: { ...source.data },
          selected: true,
        }

        return [
          ...currentNodes.map((node) =>
            node.id === nodeId ? { ...node, selected: false } : node,
          ),
          duplicate,
        ]
      })
    },
    [setNodes],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((node) => node.id === nodeId)

      if (!target) {
        return
      }

      const nextNodes = nodes.filter((node) => node.id !== nodeId)

      setNodes(nextNodes)
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      )

      if (isFreehandDrawNode(target)) {
        return
      }

      const assetId = target.data.assetId ?? null

      if (
        assetId &&
        !nextNodes.some((node) => {
          if (isFreehandDrawNode(node)) {
            return false
          }

          return node.data.assetId === assetId
        })
      ) {
        void deleteAsset(assetId).catch(() => {
          // Best-effort cleanup; board save is the source of truth.
        })
      }
    },
    [nodes, setEdges, setNodes],
  )

  const registerFrameCapture = useCallback(
    (nodeId: string, registration: FrameCaptureRegistration) => {
      frameCaptureRegistryRef.current.set(nodeId, registration)
    },
    [],
  )

  const unregisterFrameCapture = useCallback((nodeId: string) => {
    frameCaptureRegistryRef.current.delete(nodeId)
  }, [])

  const canExtractFrame = useCallback((nodeId: string) => {
    return frameCaptureRegistryRef.current.get(nodeId)?.canExtract() ?? false
  }, [])

  const extractFrame = useCallback(
    async (nodeId: string) => {
      const source = getNodes().find((node) => node.id === nodeId)

      if (!source || isFreehandDrawNode(source) || !isVideoNodeData(source.data)) {
        return
      }

      const registration = frameCaptureRegistryRef.current.get(nodeId)

      if (!registration?.canExtract()) {
        showIngestMessage(
          'Pause the video and wait for it to be ready before extracting a frame.',
          'error',
        )
        return
      }

      try {
        const captured = await registration.capture()

        if (!captured) {
          showIngestMessage('Could not capture the current frame.', 'error')
          return
        }

        const { blob, frameIndex } = captured
        const file = new File(
          [blob],
          `${source.data.label}-frame-${frameIndex}.png`,
          { type: 'image/png' },
        )
        const asset = await uploadAsset(file)
        const canvas = getCanvasDimensions(source.width, source.height)
        const dimensions = { width: canvas.width, height: canvas.height }
        const sourceWidth = source.width ?? STORYBOARD_DEFAULT_NODE_WIDTH
        const imageNodeId = crypto.randomUUID()
        const imageNode = createImageNode(
          imageNodeId,
          {
            x: source.position.x + sourceWidth + STORYBOARD_EXTRACT_FRAME_GAP,
            y: source.position.y,
          },
          {
            label: `${source.data.label} — frame ${frameIndex}`,
            src: asset.url,
            assetId: asset.id,
            naturalWidth: canvas.width,
            naturalHeight: canvas.height,
            sourceFrameIndex: frameIndex,
            extractedFromNodeId: nodeId,
          },
          dimensions,
        )

        setNodes((currentNodes) => [
          ...currentNodes.map((node) =>
            node.id === nodeId ? { ...node, selected: false } : node,
          ),
          { ...imageNode, selected: true },
        ])
        showIngestMessage('Extracted frame to new image card.', 'info')
      } catch (error) {
        showIngestMessage(
          error instanceof StoryboardApiError
            ? error.message
            : 'Could not extract the current frame.',
          'error',
        )
      }
    },
    [getNodes, setNodes, showIngestMessage],
  )

  const handleStrokeComplete = useCallback(
    (node: FreehandDrawNodeType) => {
      setNodes((currentNodes) => [...currentNodes, node])
    },
    [setNodes],
  )

  const handleInteractionModeChange = useCallback(
    (mode: BoardInteractionMode) => {
      setInteractionMode(mode)
      closeContextMenu()
    },
    [closeContextMenu],
  )

  useStoryboardHotkeys({
    enabled: loadState === 'ready',
    interactionMode,
    contextMenuOpen: contextMenu !== null,
    onInteractionModeChange: handleInteractionModeChange,
    onCloseContextMenu: closeContextMenu,
  })

  const onNodeContextMenu: NodeMouseHandler<StoryboardNodeType> = useCallback(
    (event, node) => {
      if (node.type !== MEDIA_CARD_NODE_TYPE) {
        return
      }

      if (!isMediaCardContextMenuTarget(event.target, node.data)) {
        return
      }

      event.preventDefault()

      const pane = flowRef.current?.getBoundingClientRect()
      const top =
        pane && event.clientY > pane.height - CONTEXT_MENU_ESTIMATED_HEIGHT
          ? event.clientY - CONTEXT_MENU_ESTIMATED_HEIGHT
          : event.clientY
      const left = event.clientX

      setContextMenu({
        nodeId: node.id,
        top,
        left,
      })
    },
    [],
  )

  const addShot = useCallback(() => {
    setNodes((currentNodes) => {
      const maxX = currentNodes.reduce(
        (max, node) => Math.max(max, node.position.x),
        0,
      )

      const nextShot = createVideoNode(
        crypto.randomUUID(),
        { x: maxX + STORYBOARD_NODE_X_GAP, y: STORYBOARD_NODE_Y },
        {
          label: `Shot ${currentNodes.length + 1}`,
          src: DEFAULT_SAMPLE_VIDEO,
        },
      )

      return [...currentNodes, nextShot]
    })
  }, [setNodes])

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? [...event.target.files] : []
      event.target.value = ''

      if (files.length === 0) {
        return
      }

      void ingestFilesAt(files, getViewportCenterFlowPosition())
    },
    [getViewportCenterFlowPosition, ingestFilesAt],
  )

  const statusMessage =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? saveError
        : 'Saved'

  return (
    <StoryboardCardActionsProvider
      duplicateNode={duplicateNode}
      deleteNode={deleteNode}
      registerFrameCapture={registerFrameCapture}
      unregisterFrameCapture={unregisterFrameCapture}
      canExtractFrame={canExtractFrame}
      extractFrame={extractFrame}
    >
      <div
        ref={playgroundRef}
        className="storyboard-playground"
        tabIndex={0}
        onDragEnter={interactionMode === 'select' ? handleDragEnter : undefined}
        onDragLeave={interactionMode === 'select' ? handleDragLeave : undefined}
        onDragOver={interactionMode === 'select' ? handleDragOver : undefined}
      >
        <StoryboardFlow
          nodes={nodes}
          edges={edges}
          interactionMode={interactionMode}
          loadState={loadState}
          loadError={loadError}
          statusMessage={statusMessage}
          saveState={saveState}
          ingestMessage={ingestMessage}
          contextMenu={contextMenu}
          flowRef={flowRef}
          dragActive={dragActive}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={closeContextMenu}
          onCloseContextMenu={closeContextMenu}
          onAddShot={addShot}
          onRetryLoad={() => void hydrateBoard()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onInteractionModeChange={handleInteractionModeChange}
          onStrokeComplete={handleStrokeComplete}
          fitViewReady={loadState === 'ready'}
          fileInputRef={fileInputRef}
          onFileInputChange={handleFileInputChange}
          fitViewSlot={<FitViewWhenReady ready={loadState === 'ready'} />}
        />
      </div>
    </StoryboardCardActionsProvider>
  )
}

export function StoryboardPlayground() {
  return (
    <ReactFlowProvider>
      <StoryboardPlaygroundInner />
    </ReactFlowProvider>
  )
}
