import { useReactFlow } from '@xyflow/react'
import { useStoryboardCardActions } from './StoryboardCardActionsContext'
import { isVideoNodeData, type MediaCardNodeType } from './storyboardTypes'

export type StoryboardContextMenuState = {
  nodeId: string
  top: number
  left: number
} | null

type StoryboardContextMenuProps = {
  menu: StoryboardContextMenuState
  onClose: () => void
}

export function StoryboardContextMenu({
  menu,
  onClose,
}: StoryboardContextMenuProps) {
  const {
    requestRename,
    duplicateNode,
    deleteNode,
    canExtractFrame,
    extractFrame,
  } = useStoryboardCardActions()
  const { getNode } = useReactFlow<MediaCardNodeType>()

  if (!menu) {
    return null
  }

  const node = getNode(menu.nodeId)
  const isVideo = node != null && isVideoNodeData(node.data)
  const extractReady = canExtractFrame(menu.nodeId)

  const runAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div
      className="storyboard-context-menu"
      style={{ top: menu.top, left: menu.left }}
      role="menu"
      aria-label="Card actions"
    >
      <button
        type="button"
        className="storyboard-context-menu__item"
        role="menuitem"
        onClick={() => runAction(() => requestRename(menu.nodeId))}
      >
        Rename
      </button>
      {isVideo ? (
        <button
          type="button"
          className="storyboard-context-menu__item"
          role="menuitem"
          disabled={!extractReady}
          title={
            extractReady
              ? undefined
              : 'Pause the video and wait for it to be ready before extracting a frame.'
          }
          onClick={() => runAction(() => void extractFrame(menu.nodeId))}
        >
          Extract frame
        </button>
      ) : null}
      <button
        type="button"
        className="storyboard-context-menu__item"
        role="menuitem"
        onClick={() => runAction(() => duplicateNode(menu.nodeId))}
      >
        Duplicate
      </button>
      <button
        type="button"
        className="storyboard-context-menu__item storyboard-context-menu__item--danger"
        role="menuitem"
        onClick={() => runAction(() => deleteNode(menu.nodeId))}
      >
        Delete
      </button>
    </div>
  )
}
