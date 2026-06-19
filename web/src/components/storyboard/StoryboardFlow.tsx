import { useCallback, type DragEvent } from 'react'
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { FreehandDrawLayer } from './FreehandDrawLayer'
import { FreehandDrawNode } from './FreehandDrawNode'
import { MediaCardNode } from './MediaCardNode'
import { StoryboardDropOverlay } from './StoryboardDropOverlay'
import {
  StoryboardContextMenu,
  type StoryboardContextMenuState,
} from './StoryboardContextMenu'
import { StoryboardModeToggle } from './StoryboardModeToggle'
import {
  FREEHAND_DRAW_NODE_TYPE,
  MEDIA_CARD_NODE_TYPE,
  type BoardInteractionMode,
  type FreehandDrawNodeType,
  type MediaNodeData,
  type StoryboardNodeType,
} from './storyboardTypes'

const nodeTypes: NodeTypes = {
  [MEDIA_CARD_NODE_TYPE]: MediaCardNode,
  [FREEHAND_DRAW_NODE_TYPE]: FreehandDrawNode,
}

const INGEST_FILE_ACCEPT =
  '.mp4,.mov,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,video/mp4,video/quicktime,image/*'

const STORYBOARD_PANEL_BUTTON_CLASS =
  'w-full border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--text-h)] text-xs font-medium shadow-none hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-bg)]'

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
  onPaneClick: () => void
  onCloseContextMenu: () => void
  onAddShot: () => void
  onRetryLoad: () => void
  onDrop: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onInteractionModeChange: (mode: BoardInteractionMode) => void
  onStrokeComplete: (node: FreehandDrawNodeType) => void
  fitViewReady: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  fitViewSlot: React.ReactNode
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
  onPaneClick,
  onCloseContextMenu,
  onAddShot,
  onRetryLoad,
  onDrop,
  onDragOver,
  onInteractionModeChange,
  onStrokeComplete,
  fitViewReady,
  fileInputRef,
  onFileInputChange,
  fitViewSlot,
}: StoryboardFlowProps) {
  const isDrawMode = interactionMode === 'draw'
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [fileInputRef])

  return (
    <ReactFlow
      ref={flowRef}
      className={isDrawMode ? 'react-flow--draw-mode' : undefined}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={isDrawMode ? undefined : onConnect}
      onNodeContextMenu={isDrawMode ? undefined : onNodeContextMenu}
      onPaneClick={onPaneClick}
      onDrop={isDrawMode ? undefined : onDrop}
      onDragOver={isDrawMode ? undefined : onDragOver}
      panOnDrag={isDrawMode ? [2] : true}
      nodesDraggable={!isDrawMode}
      nodesConnectable={!isDrawMode}
      elementsSelectable={!isDrawMode}
      selectionOnDrag={false}
      deleteKeyCode={isDrawMode ? null : ['Backspace', 'Delete']}
      defaultEdgeOptions={{
        type: 'default',
        style: { strokeWidth: 2 },
      }}
      connectionRadius={28}
      colorMode="dark"
      fitView={false}
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
      {!isDrawMode && <StoryboardDropOverlay active={dragActive} />}
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
              onClick={onAddShot}
              disabled={loadState !== 'ready' || isDrawMode}
            >
              Add shot
            </Button>

            <Button
              type="button"
              size="xs"
              variant="outline"
              className={STORYBOARD_PANEL_BUTTON_CLASS}
              onClick={openFilePicker}
              disabled={loadState !== 'ready' || isDrawMode}
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
