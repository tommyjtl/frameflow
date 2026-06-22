import { useReactFlow } from '@xyflow/react'
import { useStoryboardCardActions } from './StoryboardCardActionsContext'
import {
  canEnterImageCrop,
  isImageNodeData,
  isVideoNodeData,
  type MediaCardNodeType,
} from './storyboardTypes'

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
    enterCropMode,
  } = useStoryboardCardActions()
  const { getNode } = useReactFlow<MediaCardNodeType>()

  if (!menu) {
    return null
  }

  const node = getNode(menu.nodeId)
  const isVideo = node != null && isVideoNodeData(node.data)
  const imageData =
    node != null && isImageNodeData(node.data) ? node.data : null
  const extractReady = canExtractFrame(menu.nodeId)
  const cropReady = imageData != null && canEnterImageCrop(imageData)

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
      {imageData != null ? (
        <button
          type="button"
          className="storyboard-context-menu__item"
          role="menuitem"
          disabled={!cropReady}
          title={
            cropReady
              ? undefined
              : 'Wait for the image to finish loading before cropping.'
          }
          onClick={() => runAction(() => enterCropMode(menu.nodeId))}
        >
          Crop
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
