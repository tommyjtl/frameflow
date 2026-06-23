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
  type OnEdgesChange,
} from '@xyflow/react'
import { StoryboardCardActionsProvider } from './StoryboardCardActionsContext'
import { StoryboardHistoryProvider } from './StoryboardHistoryContext'
import { StoryboardTextEditingProvider, useStoryboardTextEditing } from './StoryboardTextEditingContext'
import {
  StoryboardImageCropProvider,
  useStoryboardImageCrop,
} from './StoryboardImageCropContext'
import {
  boardToFlow,
  createDefaultStoryboardWithAssets,
  flowToBoardPayload,
} from './boardMapping'
import {
  buildClipboardFromSelection,
  cloneClipboardItems,
  type StoryboardClipboard,
} from './storyboardClipboard'
import { StoryboardFlow, isMediaCardContextMenuTarget } from './StoryboardFlow'
import { FrameExtractDragProvider } from './FrameExtractDragProvider'
import { ClipExtractProvider, useClipExtractModeOptional } from './ClipExtractProvider'
import {
  extractFrameToPosition,
  getDefaultExtractFramePosition,
  getExtractFrameErrorMessage,
} from './frameExtractPlacement'
import { type StoryboardContextMenuState } from './StoryboardContextMenu'
import {
  deleteAsset,
  fetchBoard,
  saveBoard,
  StoryboardApiError,
  uploadAsset,
} from './storyboardApi'
import type { FrameCaptureRegistration } from './storyboardFrameCapture'
import { useStoryboardIngest } from './useStoryboardIngest'
import { useUrlImport } from './useUrlImport'
import {
  repairStaleClipExtractNodes,
  useClipExtract,
} from './useClipExtract'
import { useStoryboardHotkeys } from './useStoryboardHotkeys'
import { useStoryboardUndoRedo } from './useStoryboardUndoRedo'
import {
  STORYBOARD_DUPLICATE_OFFSET,
  isCopyableStoryboardNode,
  isFreehandDrawNode,
  isImageNodeData,
  isTextNoteNode,
  isVideoNodeData,
  normalizeImageNodeDimensions,
  getImageResizeAnchor,
  positionImageNodeForResizeAnchor,
  createTextNoteNode,
  type BoardInteractionMode,
  type FreehandDrawNodeType,
  MEDIA_CARD_NODE_TYPE,
  type MediaCardNodeType,
  type StoryboardCopyableNode,
  type StoryboardNodeType,
} from './storyboardTypes'
import '@xyflow/react/dist/style.css'
import './storyboard.css'

const SAVE_DEBOUNCE_MS = 500
const CONTEXT_MENU_ESTIMATED_HEIGHT = 168
const INGEST_MESSAGE_MS = 5000
const PANE_DOUBLE_CLICK_MS = 400
const PANE_DOUBLE_CLICK_PX = 10

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

type StoryboardPlaygroundCanvasProps = {
  nodes: StoryboardNodeType[]
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  edges: Edge[]
  interactionMode: BoardInteractionMode
  loadState: LoadState
  loadError: string | null
  saveState: SaveState
  saveError: string | null
  ingestMessage: { text: string; type: 'error' | 'info' } | null
  contextMenu: StoryboardContextMenuState
  flowRef: React.RefObject<HTMLDivElement | null>
  playgroundRef: React.RefObject<HTMLDivElement | null>
  dragActive: boolean
  handleNodesChange: (changes: NodeChange<StoryboardNodeType>[]) => void
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (connection: Connection) => void
  onNodeContextMenu: NodeMouseHandler<StoryboardNodeType>
  closeContextMenu: () => void
  handleInteractionModeChange: (mode: BoardInteractionMode) => void
  handleStrokeComplete: (node: FreehandDrawNodeType) => void
  beginDragHistory: () => void
  commitDragHistory: () => void
  handleBeforeDelete: () => Promise<boolean>
  canUndo: boolean
  canRedo: boolean
  undo: () => boolean
  redo: () => boolean
  takeSnapshot: () => void
  startUrlImport: (url: string) => Promise<void>
  hydrateBoard: () => Promise<void>
  handleDrop: (event: React.DragEvent) => void
  handleDragOver: (event: React.DragEvent) => void
  handleDragEnter: (event: React.DragEvent) => void
  handleDragLeave: (event: React.DragEvent) => void
  duplicateNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  registerFrameCapture: (nodeId: string, registration: FrameCaptureRegistration) => void
  unregisterFrameCapture: (nodeId: string) => void
  canExtractFrame: (nodeId: string) => boolean
  extractFrame: (nodeId: string) => Promise<void>
  cancelClipExtractJob: (outputNodeId: string) => Promise<void>
  dismissClipExtractCard: (outputNodeId: string) => void
  copySelectedNodes: () => boolean
  pasteClipboardNodes: () => boolean
  persistBoardNow: () => Promise<void>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

function StoryboardPlaygroundCanvas({
  nodes,
  setNodes,
  edges,
  interactionMode,
  loadState,
  loadError,
  saveState,
  saveError,
  ingestMessage,
  contextMenu,
  flowRef,
  playgroundRef,
  dragActive,
  handleNodesChange,
  onEdgesChange,
  onConnect,
  onNodeContextMenu,
  closeContextMenu,
  handleInteractionModeChange,
  handleStrokeComplete,
  beginDragHistory,
  commitDragHistory,
  handleBeforeDelete,
  canUndo,
  canRedo,
  undo,
  redo,
  takeSnapshot,
  startUrlImport,
  hydrateBoard,
  handleDrop,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  duplicateNode,
  deleteNode,
  registerFrameCapture,
  unregisterFrameCapture,
  canExtractFrame,
  extractFrame,
  cancelClipExtractJob,
  dismissClipExtractCard,
  copySelectedNodes,
  pasteClipboardNodes,
  persistBoardNow,
  fileInputRef,
  handleFileInputChange,
  screenToFlowPosition,
}: StoryboardPlaygroundCanvasProps) {
  const { editingTextNodeId, enterTextEditing, exitTextEditing } =
    useStoryboardTextEditing()
  const { croppingNodeId, enterCropMode, cancelCrop, applyCrop } =
    useStoryboardImageCrop()
  const clipMode = useClipExtractModeOptional()
  const lastPaneClickRef = useRef<{ time: number; x: number; y: number } | null>(
    null,
  )

  const createTextAtFlowPosition = useCallback(
    (position: { x: number; y: number }) => {
      const nodeId = crypto.randomUUID()
      const textNode = createTextNoteNode(nodeId, position, { text: '' })

      takeSnapshot()
      setNodes((currentNodes) => [
        ...currentNodes.map((node) => ({ ...node, selected: false })),
        textNode,
      ])
      enterTextEditing(nodeId)
    },
    [enterTextEditing, setNodes, takeSnapshot],
  )

  const deselectAllNodes = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.some((node) => node.selected)
        ? currentNodes.map((node) =>
            node.selected ? { ...node, selected: false } : node,
          )
        : currentNodes,
    )
  }, [setNodes])

  const selectAllNodes = useCallback(() => {
    setNodes((currentNodes) => {
      if (currentNodes.length === 0) {
        return currentNodes
      }

      if (currentNodes.every((node) => node.selected)) {
        return currentNodes
      }

      return currentNodes.map((node) =>
        node.selected ? node : { ...node, selected: true },
      )
    })
  }, [setNodes])

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      closeContextMenu()

      if (loadState !== 'ready') {
        return
      }

      const isPaneDoubleClick = (() => {
        if (event.detail === 2) {
          return true
        }

        const lastClick = lastPaneClickRef.current
        lastPaneClickRef.current = {
          time: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
        }

        if (!lastClick) {
          return false
        }

        return (
          event.timeStamp - lastClick.time < PANE_DOUBLE_CLICK_MS &&
          Math.hypot(
            event.clientX - lastClick.x,
            event.clientY - lastClick.y,
          ) < PANE_DOUBLE_CLICK_PX
        )
      })()

      if (isPaneDoubleClick && interactionMode === 'select') {
        if (croppingNodeId) {
          cancelCrop()
          return
        }

        createTextAtFlowPosition(
          screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        )
        lastPaneClickRef.current = null
        return
      }

      if (event.detail > 1) {
        return
      }

      if (interactionMode === 'select' && croppingNodeId) {
        cancelCrop()
        return
      }

      if (interactionMode === 'select' && editingTextNodeId) {
        exitTextEditing()
        return
      }

      if (interactionMode !== 'text') {
        return
      }

      createTextAtFlowPosition(
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      )
    },
    [
      cancelCrop,
      closeContextMenu,
      createTextAtFlowPosition,
      croppingNodeId,
      editingTextNodeId,
      exitTextEditing,
      interactionMode,
      loadState,
      screenToFlowPosition,
    ],
  )

  const handleNodeClick = useCallback<NodeMouseHandler<StoryboardNodeType>>(
    (_event, node) => {
      if (interactionMode !== 'select' || !croppingNodeId) {
        return
      }

      if (node.id !== croppingNodeId) {
        cancelCrop()
      }
    },
    [cancelCrop, croppingNodeId, interactionMode],
  )

  const hasSelectedTextNode = nodes.some(
    (node) => isTextNoteNode(node) && node.selected,
  )

  useStoryboardHotkeys({
    enabled: loadState === 'ready',
    interactionMode,
    contextMenuOpen: contextMenu !== null,
    editingTextNodeId,
    croppingNodeId,
    clipExtractActive: clipMode?.activeNodeId != null,
    hasSelectedTextNode,
    onInteractionModeChange: handleInteractionModeChange,
    onCloseContextMenu: closeContextMenu,
    onExitTextEditing: exitTextEditing,
    onCancelCrop: cancelCrop,
    onCancelClipExtract: () => clipMode?.exitClipMode(),
    onApplyCrop: applyCrop,
    onDeselectAllNodes: deselectAllNodes,
    onSelectAllNodes: selectAllNodes,
    onEnterTextEditing: enterTextEditing,
    selectedTextNodeId:
      nodes.find((node) => isTextNoteNode(node) && node.selected)?.id ?? null,
    onManualSave: () => void persistBoardNow(),
    onCopy: copySelectedNodes,
    onPaste: pasteClipboardNodes,
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
  })

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
      enterCropMode={enterCropMode}
      cancelClipExtractJob={cancelClipExtractJob}
      dismissClipExtractCard={dismissClipExtractCard}
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
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onCloseContextMenu={closeContextMenu}
          onImportFromUrl={startUrlImport}
          onRetryLoad={() => void hydrateBoard()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onInteractionModeChange={handleInteractionModeChange}
          onStrokeComplete={handleStrokeComplete}
          onNodeDragStart={beginDragHistory}
          onNodeDragStop={commitDragHistory}
          onSelectionDragStart={beginDragHistory}
          onSelectionDragStop={commitDragHistory}
          onBeforeDelete={handleBeforeDelete}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          fitViewReady={loadState === 'ready'}
          fileInputRef={fileInputRef}
          onFileInputChange={handleFileInputChange}
          fitViewSlot={<FitViewWhenReady ready={loadState === 'ready'} />}
          croppingNodeId={croppingNodeId}
        />
      </div>
    </StoryboardCardActionsProvider>
  )
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
  const contextMenuRef = useRef(contextMenu)
  contextMenuRef.current = contextMenu
  const isHydratedRef = useRef(false)
  const saveRequestRef = useRef(0)
  const saveDebounceTimerRef = useRef<number | null>(null)
  const clipboardRef = useRef<StoryboardClipboard | null>(null)
  const pasteCountRef = useRef(0)
  const flowRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const ingestMessageTimerRef = useRef<number | null>(null)
  const frameCaptureRegistryRef = useRef(new Map<string, FrameCaptureRegistration>())
  const { screenToFlowPosition, getNodes: getFlowNodes } =
    useReactFlow<StoryboardNodeType>()
  const getNodes = useCallback(() => getFlowNodes(), [getFlowNodes])

  const {
    canUndo,
    canRedo,
    takeSnapshot,
    undo,
    redo,
    resetHistory,
    beginDragHistory,
    commitDragHistory,
    handleNodesChange: historyNodesChange,
    handleBeforeDelete,
  } = useStoryboardUndoRedo({
    enabled: loadState === 'ready',
    nodes,
    edges,
    setNodes,
    setEdges,
  })

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleNodesChange = useCallback(
    (changes: NodeChange<StoryboardNodeType>[]) => {
      const menu = contextMenuRef.current

      if (menu) {
        for (const change of changes) {
          if (
            change.type === 'select' &&
            change.selected &&
            change.id !== menu.nodeId
          ) {
            closeContextMenu()
            break
          }
        }
      }

      historyNodesChange(changes)

      const positionChangeById = new Map<
        string,
        Extract<NodeChange<StoryboardNodeType>, { type: 'position' }>
      >()

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          positionChangeById.set(change.id, change)
        }
      }

      const correctedPositions = new Map<string, { x: number; y: number }>()
      const normalizedChanges: NodeChange<StoryboardNodeType>[] = []

      for (const change of changes) {
        if (
          change.type !== 'dimensions' ||
          change.dimensions?.width == null ||
          change.dimensions.height == null
        ) {
          normalizedChanges.push(change)
          continue
        }

        const node = getNodes().find((item) => item.id === change.id)

        if (
          !node ||
          node.type !== MEDIA_CARD_NODE_TYPE ||
          isFreehandDrawNode(node) ||
          !isImageNodeData(node.data) ||
          !node.data.naturalWidth ||
          !node.data.naturalHeight
        ) {
          normalizedChanges.push(change)
          continue
        }

        const prevWidth = node.width ?? 0
        const prevHeight = node.height ?? 0
        const prevBox = {
          x: node.position.x,
          y: node.position.y,
          width: prevWidth,
          height: prevHeight,
        }
        const positionChange = positionChangeById.get(change.id)
        const rfX = positionChange?.position?.x ?? prevBox.x
        const rfY = positionChange?.position?.y ?? prevBox.y
        const rfWidth = change.dimensions.width
        const rfHeight = change.dimensions.height

        const normalized = normalizeImageNodeDimensions(
          rfWidth,
          rfHeight,
          node.data.naturalWidth,
          node.data.naturalHeight,
        )
        const anchor = getImageResizeAnchor(prevBox, {
          x: rfX,
          y: rfY,
          width: rfWidth,
          height: rfHeight,
        })
        const correctedPosition = positionImageNodeForResizeAnchor(
          anchor,
          prevBox,
          normalized,
        )

        correctedPositions.set(change.id, correctedPosition)
        normalizedChanges.push({
          ...change,
          dimensions: {
            ...change.dimensions,
            width: normalized.width,
            height: normalized.height,
          },
        })
      }

      for (const change of normalizedChanges) {
        if (change.type !== 'position' || !change.position) {
          continue
        }

        const correctedPosition = correctedPositions.get(change.id)

        if (!correctedPosition) {
          continue
        }

        change.position = correctedPosition
      }

      for (const [nodeId, correctedPosition] of correctedPositions) {
        if (positionChangeById.has(nodeId)) {
          continue
        }

        const node = getNodes().find((item) => item.id === nodeId)

        if (!node) {
          continue
        }

        if (
          correctedPosition.x === node.position.x &&
          correctedPosition.y === node.position.y
        ) {
          continue
        }

        normalizedChanges.push({
          id: nodeId,
          type: 'position',
          position: correctedPosition,
        })
      }

      onNodesChange(normalizedChanges)
    },
    [closeContextMenu, getNodes, historyNodesChange, onNodesChange],
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
    takeSnapshot,
  })

  const { startUrlImport, reconnectUrlImports } = useUrlImport({
    enabled: loadState === 'ready' && interactionMode === 'select',
    setNodes,
    getViewportCenterFlowPosition,
    onMessage: showIngestMessage,
    takeSnapshot,
  })

  const { resumePendingJobs: resumePendingClipJobs, startClipExtractJob, cancelClipExtractJob, dismissClipExtractCard } =
    useClipExtract({
      enabled: loadState === 'ready',
      getNodes,
      setNodes,
      onMessage: showIngestMessage,
      takeSnapshot,
    })

  const handleStartClipExtractJob = useCallback(
    async (input: {
      sourceNodeId: string
      startFrame: number
      endFrame: number
      fps: number
    }) => {
      const source = getNodes().find((node) => node.id === input.sourceNodeId)

      if (
        !source ||
        source.type !== MEDIA_CARD_NODE_TYPE ||
        !isVideoNodeData(source.data)
      ) {
        throw new Error('Source video card is no longer available.')
      }

      await startClipExtractJob({
        source,
        startFrame: input.startFrame,
        endFrame: input.endFrame,
        fps: input.fps,
      })
    },
    [getNodes, startClipExtractJob],
  )

  const hydrateBoard = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    isHydratedRef.current = false

    try {
      const board = await fetchBoard()

      if (board.nodes.length === 0) {
        const seeded = await createDefaultStoryboardWithAssets(uploadAsset)
        setNodes(seeded.nodes)
        setEdges(seeded.edges)
        await saveBoard(flowToBoardPayload(seeded.nodes, seeded.edges))
      } else {
        const flow = boardToFlow(board)
        const repairedNodes = repairStaleClipExtractNodes(flow.nodes)
        setNodes(repairedNodes)
        setEdges(flow.edges)
        reconnectUrlImports(repairedNodes)
        resumePendingClipJobs(repairedNodes)
      }

      isHydratedRef.current = true
      setLoadState('ready')
      setSaveState('saved')
      resetHistory()
    } catch (error) {
      isHydratedRef.current = false
      setLoadState('error')
      setLoadError(
        error instanceof StoryboardApiError
          ? error.message
          : 'Could not load the storyboard.',
      )
    }
  }, [setEdges, setNodes, reconnectUrlImports, resumePendingClipJobs, resetHistory])

  useEffect(() => {
    void hydrateBoard()
  }, [hydrateBoard])

  const persistBoardNow = useCallback(async () => {
    if (!isHydratedRef.current || loadState !== 'ready') {
      return
    }

    if (saveDebounceTimerRef.current !== null) {
      window.clearTimeout(saveDebounceTimerRef.current)
      saveDebounceTimerRef.current = null
    }

    const requestId = ++saveRequestRef.current
    setSaveState('saving')
    setSaveError(null)

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
  }, [edges, loadState, nodes])

  useEffect(() => {
    if (!isHydratedRef.current || loadState !== 'ready') {
      return
    }

    const requestId = ++saveRequestRef.current
    setSaveState('saving')
    setSaveError(null)

    const timer = window.setTimeout(() => {
      saveDebounceTimerRef.current = null

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

    saveDebounceTimerRef.current = timer

    return () => {
      window.clearTimeout(timer)

      if (saveDebounceTimerRef.current === timer) {
        saveDebounceTimerRef.current = null
      }
    }
  }, [edges, loadState, nodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot()
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: 'default' }, currentEdges),
      )
    },
    [setEdges, takeSnapshot],
  )

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodes.find((node) => node.id === nodeId)

      if (!source || isFreehandDrawNode(source)) {
        return
      }

      takeSnapshot()

      if (isTextNoteNode(source)) {
        setNodes((currentNodes) => {
          const duplicate = createTextNoteNode(
            crypto.randomUUID(),
            {
              x: source.position.x + STORYBOARD_DUPLICATE_OFFSET.x,
              y: source.position.y + STORYBOARD_DUPLICATE_OFFSET.y,
            },
            {
              text: source.data.text,
              fontSize: source.data.fontSize,
              scale: source.data.scale,
              referenceWidth: source.data.referenceWidth,
            },
            {
              width: source.width,
              height: source.height,
            },
          )

          return [
            ...currentNodes.map((node) =>
              node.id === nodeId ? { ...node, selected: false } : node,
            ),
            duplicate,
          ]
        })
        return
      }

      setNodes((currentNodes) => {
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
    [nodes, setNodes, takeSnapshot],
  )

  const copySelectedNodes = useCallback((): boolean => {
    if (loadState !== 'ready' || interactionMode !== 'select') {
      return false
    }

    const selected = getNodes().filter(
      (node): node is StoryboardCopyableNode =>
        node.selected === true && isCopyableStoryboardNode(node),
    )

    const clipboard = buildClipboardFromSelection(selected, edges)

    if (!clipboard) {
      return false
    }

    clipboardRef.current = clipboard
    pasteCountRef.current = 0
    return true
  }, [edges, getNodes, interactionMode, loadState])

  const pasteClipboardNodes = useCallback((): boolean => {
    if (loadState !== 'ready' || interactionMode !== 'select') {
      return false
    }

    const clipboard = clipboardRef.current

    if (!clipboard) {
      return false
    }

    pasteCountRef.current += 1

    const { nodes: pastedNodes, edges: pastedEdges } = cloneClipboardItems(
      clipboard,
      pasteCountRef.current,
    )

    takeSnapshot()
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      ...pastedNodes,
    ])
    setEdges((currentEdges) => [...currentEdges, ...pastedEdges])
    return true
  }, [interactionMode, loadState, setEdges, setNodes, takeSnapshot])

  const deleteNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((node) => node.id === nodeId)

      if (!target) {
        return
      }

      takeSnapshot()

      const nextNodes = nodes.filter((node) => node.id !== nodeId)

      setNodes(nextNodes)
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      )

      if (target.type !== MEDIA_CARD_NODE_TYPE) {
        return
      }

      const assetId = target.data.assetId ?? null

      if (
        assetId &&
        !nextNodes.some((node) => {
          if (node.type !== MEDIA_CARD_NODE_TYPE) {
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
    [nodes, setEdges, setNodes, takeSnapshot],
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
      const registration = frameCaptureRegistryRef.current.get(nodeId)

      if (!registration?.canExtract()) {
        showIngestMessage(
          'Pause the video and wait for it to be ready before extracting a frame.',
          'error',
        )
        return
      }

      const source = getNodes().find((node) => node.id === nodeId)

      if (
        !source ||
        source.type !== MEDIA_CARD_NODE_TYPE ||
        !isVideoNodeData(source.data)
      ) {
        return
      }

      try {
        await extractFrameToPosition({
          sourceNodeId: nodeId,
          position: getDefaultExtractFramePosition(source),
          getSource: () => {
            const current = getNodes().find((node) => node.id === nodeId)

            if (
              !current ||
              current.type !== MEDIA_CARD_NODE_TYPE ||
              !isVideoNodeData(current.data)
            ) {
              return undefined
            }

            return current
          },
          capture: registration.capture,
          setNodes,
          takeSnapshot,
        })
        showIngestMessage('Extracted frame to new image card.', 'info')
      } catch (error) {
        showIngestMessage(getExtractFrameErrorMessage(error), 'error')
      }
    },
    [getNodes, setNodes, showIngestMessage, takeSnapshot],
  )

  const handleStrokeComplete = useCallback(
    (node: FreehandDrawNodeType) => {
      takeSnapshot()
      setNodes((currentNodes) => [...currentNodes, node])
    },
    [setNodes, takeSnapshot],
  )

  const handleInteractionModeChange = useCallback(
    (mode: BoardInteractionMode) => {
      setInteractionMode(mode)
      closeContextMenu()
    },
    [closeContextMenu],
  )

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

  return (
    <StoryboardHistoryProvider takeSnapshot={takeSnapshot}>
      <StoryboardTextEditingProvider
        nodes={nodes}
        setNodes={setNodes}
        takeSnapshot={takeSnapshot}
        interactionMode={interactionMode}
      >
        <FrameExtractDragProvider
          getNodes={getNodes}
          setNodes={setNodes}
          takeSnapshot={takeSnapshot}
          showIngestMessage={showIngestMessage}
          screenToFlowPosition={screenToFlowPosition}
          getFrameCapture={(nodeId) =>
            frameCaptureRegistryRef.current.get(nodeId)
          }
        >
          <ClipExtractProvider
            startClipExtractJob={handleStartClipExtractJob}
            onMessage={showIngestMessage}
          >
          <StoryboardImageCropProvider
            nodes={nodes}
            setNodes={setNodes}
            takeSnapshot={takeSnapshot}
            interactionMode={interactionMode}
            onCloseContextMenu={closeContextMenu}
            showMessage={showIngestMessage}
          >
            <StoryboardPlaygroundCanvas
          nodes={nodes}
          setNodes={setNodes}
          edges={edges}
          interactionMode={interactionMode}
          loadState={loadState}
          loadError={loadError}
          saveState={saveState}
          saveError={saveError}
          ingestMessage={ingestMessage}
          contextMenu={contextMenu}
          flowRef={flowRef}
          playgroundRef={playgroundRef}
          dragActive={dragActive}
          handleNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeContextMenu={onNodeContextMenu}
          closeContextMenu={closeContextMenu}
          handleInteractionModeChange={handleInteractionModeChange}
          handleStrokeComplete={handleStrokeComplete}
          beginDragHistory={beginDragHistory}
          commitDragHistory={commitDragHistory}
          handleBeforeDelete={handleBeforeDelete}
          canUndo={canUndo}
          canRedo={canRedo}
          undo={undo}
          redo={redo}
          takeSnapshot={takeSnapshot}
          startUrlImport={startUrlImport}
          hydrateBoard={hydrateBoard}
          handleDrop={handleDrop}
          handleDragOver={handleDragOver}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
          duplicateNode={duplicateNode}
          deleteNode={deleteNode}
          registerFrameCapture={registerFrameCapture}
          unregisterFrameCapture={unregisterFrameCapture}
          canExtractFrame={canExtractFrame}
          extractFrame={extractFrame}
          cancelClipExtractJob={cancelClipExtractJob}
          dismissClipExtractCard={dismissClipExtractCard}
          copySelectedNodes={copySelectedNodes}
          pasteClipboardNodes={pasteClipboardNodes}
          persistBoardNow={persistBoardNow}
          fileInputRef={fileInputRef}
          handleFileInputChange={handleFileInputChange}
          screenToFlowPosition={screenToFlowPosition}
        />
          </StoryboardImageCropProvider>
          </ClipExtractProvider>
        </FrameExtractDragProvider>
      </StoryboardTextEditingProvider>
    </StoryboardHistoryProvider>
  )
}

export function StoryboardPlayground() {
  return (
    <ReactFlowProvider>
      <StoryboardPlaygroundInner />
    </ReactFlowProvider>
  )
}
