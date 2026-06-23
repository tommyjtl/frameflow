import { useCallback, useState, type DragEvent } from 'react'
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  SelectionMode,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnBeforeDelete,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type SelectionDragHandler,
} from '@xyflow/react'
import { Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportFromUrlDialog } from './ImportFromUrlDialog'
import { FreehandDrawLayer } from './FreehandDrawLayer'
import { FreehandDrawNode } from './FreehandDrawNode'
import { MediaCardNode } from './MediaCardNode'
import { TextNoteNode } from './TextNoteNode'
import { StoryboardDropOverlay } from './StoryboardDropOverlay'
import {
  StoryboardContextMenu,
  type StoryboardContextMenuState,
} from './StoryboardContextMenu'
import { StoryboardModeToggle } from './StoryboardModeToggle'
import {
  FREEHAND_DRAW_NODE_TYPE,
  MEDIA_CARD_NODE_TYPE,
  TEXT_NOTE_NODE_TYPE,
  type BoardInteractionMode,
  type FreehandDrawNodeType,
  type MediaNodeData,
  type StoryboardNodeType,
} from './storyboardTypes'

const nodeTypes: NodeTypes = {
  [MEDIA_CARD_NODE_TYPE]: MediaCardNode,
  [FREEHAND_DRAW_NODE_TYPE]: FreehandDrawNode,
  [TEXT_NOTE_NODE_TYPE]: TextNoteNode,
}

const INGEST_FILE_ACCEPT =
  '.mp4,.mov,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,video/mp4,video/quicktime,image/*'

const STORYBOARD_PANEL_BUTTON_CLASS =
  'w-full border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--text-h)] text-xs font-medium shadow-none hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-bg)]'

const STORYBOARD_PANEL_ICON_BUTTON_CLASS =
  'flex-1 border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--text-h)] text-xs font-medium shadow-none hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-bg)]'

type StoryboardFlowProps = {
  nodes: StoryboardNodeType[]
  edges: Edge[]
  interactionMode: BoardInteractionMode
  loadState: 'loading' | 'ready' | 'error'
  loadError: string | null
  statusMessage: string | null
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  ingestMessage: { text: string; type: 'error' | 'info' } | null
  contextMenu: StoryboardContextMenuState
  flowRef: React.RefObject<HTMLDivElement | null>
  dragActive: boolean
  onNodesChange: OnNodesChange<StoryboardNodeType>
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (connection: Connection) => void
  onNodeContextMenu: NodeMouseHandler<StoryboardNodeType>
  onNodeClick?: NodeMouseHandler<StoryboardNodeType>
  onPaneClick: (event: React.MouseEvent) => void
  onCloseContextMenu: () => void
  onImportFromUrl: (url: string) => Promise<void>
  onRetryLoad: () => void
  onDrop: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onInteractionModeChange: (mode: BoardInteractionMode) => void
  onStrokeComplete: (node: FreehandDrawNodeType) => void
  onNodeDragStart?: OnNodeDrag<StoryboardNodeType>
  onNodeDragStop?: OnNodeDrag<StoryboardNodeType>
  onSelectionDragStart?: SelectionDragHandler<StoryboardNodeType>
  onSelectionDragStop?: SelectionDragHandler<StoryboardNodeType>
  onBeforeDelete?: OnBeforeDelete<StoryboardNodeType, Edge>
  canUndo: boolean
  canRedo: boolean
  onUndo: () => boolean
  onRedo: () => boolean
  fitViewReady: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  fitViewSlot: React.ReactNode
  croppingNodeId?: string | null
}

export function StoryboardFlow({
  nodes,
  edges,
  interactionMode,
  loadState,
  loadError,
  statusMessage,
  saveState,
  ingestMessage,
  contextMenu,
  flowRef,
  dragActive,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeContextMenu,
  onNodeClick,
  onPaneClick,
  onCloseContextMenu,
  onImportFromUrl,
  onRetryLoad,
  onDrop,
  onDragOver,
  onInteractionModeChange,
  onStrokeComplete,
  onNodeDragStart,
  onNodeDragStop,
  onSelectionDragStart,
  onSelectionDragStop,
  onBeforeDelete,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  fitViewReady,
  fileInputRef,
  onFileInputChange,
  fitViewSlot,
  croppingNodeId = null,
}: StoryboardFlowProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const isDrawMode = interactionMode === 'draw'
  const isTextMode = interactionMode === 'text'
  const isSelectMode = interactionMode === 'select'
  const isCropMode = croppingNodeId != null
  const isToolMode = isDrawMode || isTextMode
  const isInteractiveSelectMode = isSelectMode && !isCropMode
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [fileInputRef])

  return (
    <ReactFlow
      ref={flowRef}
      className={
        isDrawMode
          ? 'react-flow--draw-mode'
          : isTextMode
            ? 'react-flow--text-mode'
            : isCropMode
              ? 'react-flow--crop-mode'
              : undefined
      }
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={isInteractiveSelectMode ? onConnect : undefined}
      onNodeDragStart={isInteractiveSelectMode ? onNodeDragStart : undefined}
      onNodeDragStop={isInteractiveSelectMode ? onNodeDragStop : undefined}
      onSelectionDragStart={isInteractiveSelectMode ? onSelectionDragStart : undefined}
      onSelectionDragStop={isInteractiveSelectMode ? onSelectionDragStop : undefined}
      onBeforeDelete={isInteractiveSelectMode ? onBeforeDelete : undefined}
      onNodeContextMenu={isInteractiveSelectMode ? onNodeContextMenu : undefined}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onDrop={isInteractiveSelectMode ? onDrop : undefined}
      onDragOver={isInteractiveSelectMode ? onDragOver : undefined}
      panOnDrag={isCropMode ? false : isDrawMode ? [2] : [1, 2]}
      panOnScroll={isInteractiveSelectMode}
      panActivationKeyCode={isToolMode || isCropMode ? null : 'Space'}
      zoomOnDoubleClick={false}
      zoomOnScroll={!isCropMode}
      selectionOnDrag={isInteractiveSelectMode}
      selectionMode={isInteractiveSelectMode ? SelectionMode.Partial : undefined}
      nodesDraggable={isInteractiveSelectMode}
      nodesConnectable={isInteractiveSelectMode}
      elementsSelectable={isInteractiveSelectMode}
      deleteKeyCode={isToolMode || isCropMode ? null : ['Backspace', 'Delete']}
      defaultEdgeOptions={{
        type: 'default',
        style: { strokeWidth: 2 },
      }}
      connectionRadius={28}
      colorMode="dark"
      fitView={false}
      elevateNodesOnSelect={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} />
      <StoryboardModeToggle
        mode={interactionMode}
        onModeChange={onInteractionModeChange}
      />
      <Controls />
      {isDrawMode && <FreehandDrawLayer onStrokeComplete={onStrokeComplete} />}
      {fitViewReady ? fitViewSlot : null}
      {!isToolMode && <StoryboardDropOverlay active={dragActive} />}
      <StoryboardContextMenu menu={contextMenu} onClose={onCloseContextMenu} />

      <Panel position="top-left">
        <div className="storyboard-panel">
          <h2 className="storyboard-panel__title">Storyboard</h2>
          <p className="storyboard-panel__hint">
            Drop video or image files onto the board. Paste images with the board
            focused. Double-click a header to rename; right-click for more
            actions. Use Drawing Mode to sketch on the canvas.
          </p>

          <p
            className={[
              'storyboard-panel__status',
              loadState === 'error' || saveState === 'error'
                ? 'storyboard-panel__status--error'
                : saveState === 'saved'
                  ? 'storyboard-panel__status--saved'
                  : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-live="polite"
          >
            {loadState === 'loading'
              ? 'Loading board…'
              : loadState === 'error'
                ? loadError
                : statusMessage}
          </p>

          {ingestMessage && (
            <p
              className={[
                'storyboard-panel__status',
                ingestMessage.type === 'error'
                  ? 'storyboard-panel__status--error'
                  : 'storyboard-panel__status--info',
              ].join(' ')}
              aria-live="polite"
            >
              {ingestMessage.text}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className={STORYBOARD_PANEL_ICON_BUTTON_CLASS}
                onClick={() => onUndo()}
                disabled={loadState !== 'ready' || isToolMode || isCropMode || !canUndo}
                aria-label="Undo"
                title="Undo (⌘Z)"
              >
                <Undo2 aria-hidden />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className={STORYBOARD_PANEL_ICON_BUTTON_CLASS}
                onClick={() => onRedo()}
                disabled={loadState !== 'ready' || isToolMode || isCropMode || !canRedo}
                aria-label="Redo"
                title="Redo (⌘⇧Z)"
              >
                <Redo2 aria-hidden />
              </Button>
            </div>

            {loadState === 'error' && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                className={STORYBOARD_PANEL_BUTTON_CLASS}
                onClick={onRetryLoad}
              >
                Retry load
              </Button>
            )}

            <Button
              type="button"
              size="xs"
              variant="outline"
              className={STORYBOARD_PANEL_BUTTON_CLASS}
              onClick={() => setImportDialogOpen(true)}
              disabled={loadState !== 'ready' || isToolMode || isCropMode}
            >
              Import video from URL
            </Button>

            <ImportFromUrlDialog
              open={importDialogOpen}
              onOpenChange={setImportDialogOpen}
              disabled={loadState !== 'ready' || isToolMode || isCropMode}
              onSubmit={onImportFromUrl}
            />

            <Button
              type="button"
              size="xs"
              variant="outline"
              className={STORYBOARD_PANEL_BUTTON_CLASS}
              onClick={openFilePicker}
              disabled={loadState !== 'ready' || isToolMode || isCropMode}
            >
              Import media
            </Button>
          </div>

          <input
            ref={fileInputRef}
            className="storyboard-panel__file-input"
            type="file"
            accept={INGEST_FILE_ACCEPT}
            multiple
            onChange={onFileInputChange}
            tabIndex={-1}
            aria-hidden
          />
        </div>
      </Panel>
    </ReactFlow>
  )
}

export function isMediaCardContextMenuTarget(
  target: EventTarget | null,
  data: MediaNodeData,
): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (target.closest('.react-flow__handle')) {
    return false
  }

  if (target.closest('.media-card__header-btn')) {
    return false
  }

  if (data.kind === 'image') {
    return target.closest('.media-card__body--image') !== null
  }

  return target.closest('.media-card__header') !== null
}
