import { useHotkeys } from 'react-hotkeys-hook'
import { STORYBOARD_HOTKEY_OPTIONS } from './storyboardHotkeys'
import type { BoardInteractionMode } from './storyboardTypes'

type UseStoryboardHotkeysOptions = {
  enabled: boolean
  interactionMode: BoardInteractionMode
  contextMenuOpen: boolean
  onInteractionModeChange: (mode: BoardInteractionMode) => void
  onCloseContextMenu: () => void
}

export function useStoryboardHotkeys({
  enabled,
  interactionMode,
  contextMenuOpen,
  onInteractionModeChange,
  onCloseContextMenu,
}: UseStoryboardHotkeysOptions) {
  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()

      if (contextMenuOpen) {
        onCloseContextMenu()
        return
      }

      if (interactionMode === 'draw') {
        onInteractionModeChange('select')
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: enabled && (contextMenuOpen || interactionMode === 'draw'),
    },
    [
      contextMenuOpen,
      enabled,
      interactionMode,
      onCloseContextMenu,
      onInteractionModeChange,
    ],
  )

  useHotkeys(
    'v',
    (event) => {
      event.preventDefault()

      if (contextMenuOpen) {
        onCloseContextMenu()
      }

      if (interactionMode !== 'select') {
        onInteractionModeChange('select')
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled,
    },
    [contextMenuOpen, enabled, interactionMode, onCloseContextMenu, onInteractionModeChange],
  )

  useHotkeys(
    'd',
    (event) => {
      event.preventDefault()

      if (contextMenuOpen) {
        onCloseContextMenu()
      }

      if (interactionMode !== 'draw') {
        onInteractionModeChange('draw')
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled,
    },
    [contextMenuOpen, enabled, interactionMode, onCloseContextMenu, onInteractionModeChange],
  )
}
