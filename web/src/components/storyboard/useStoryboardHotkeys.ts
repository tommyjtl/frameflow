import { useHotkeys } from 'react-hotkeys-hook'
import { STORYBOARD_HOTKEY_OPTIONS } from './storyboardHotkeys'
import type { BoardInteractionMode } from './storyboardTypes'

type UseStoryboardHotkeysOptions = {
  enabled: boolean
  interactionMode: BoardInteractionMode
  contextMenuOpen: boolean
  editingTextNodeId: string | null
  croppingNodeId: string | null
  clipExtractActive: boolean
  hasSelectedTextNode: boolean
  selectedTextNodeId: string | null
  onInteractionModeChange: (mode: BoardInteractionMode) => void
  onCloseContextMenu: () => void
  onExitTextEditing: () => void
  onCancelCrop: () => void
  onCancelClipExtract: () => void
  onApplyCrop: () => void
  onDeselectAllNodes: () => void
  onSelectAllNodes: () => void
  onEnterTextEditing: (nodeId: string) => void
  onManualSave?: () => void
  onCopy?: () => boolean
  onPaste?: () => boolean
  onUndo?: () => boolean
  onRedo?: () => boolean
  canUndo?: boolean
  canRedo?: boolean
}

export function useStoryboardHotkeys({
  enabled,
  interactionMode,
  contextMenuOpen,
  editingTextNodeId,
  croppingNodeId,
  clipExtractActive,
  hasSelectedTextNode,
  selectedTextNodeId,
  onInteractionModeChange,
  onCloseContextMenu,
  onExitTextEditing,
  onCancelCrop,
  onCancelClipExtract,
  onApplyCrop,
  onDeselectAllNodes,
  onSelectAllNodes,
  onEnterTextEditing,
  onManualSave,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
}: UseStoryboardHotkeysOptions) {
  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()

      if (contextMenuOpen) {
        onCloseContextMenu()
        return
      }

      if (clipExtractActive) {
        onCancelClipExtract()
        return
      }

      if (croppingNodeId) {
        onCancelCrop()
        return
      }

      if (editingTextNodeId) {
        onExitTextEditing()
        return
      }

      if (hasSelectedTextNode) {
        onDeselectAllNodes()
        return
      }

      if (interactionMode === 'draw' || interactionMode === 'text') {
        onInteractionModeChange('select')
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled:
        enabled &&
        (contextMenuOpen ||
          clipExtractActive ||
          croppingNodeId != null ||
          editingTextNodeId != null ||
          hasSelectedTextNode ||
          interactionMode === 'draw' ||
          interactionMode === 'text'),
    },
    [
      clipExtractActive,
      contextMenuOpen,
      croppingNodeId,
      editingTextNodeId,
      enabled,
      hasSelectedTextNode,
      interactionMode,
      onCancelClipExtract,
      onCancelCrop,
      onCloseContextMenu,
      onDeselectAllNodes,
      onExitTextEditing,
      onInteractionModeChange,
    ],
  )

  useHotkeys(
    'enter',
    (event) => {
      if (croppingNodeId) {
        event.preventDefault()
        void onApplyCrop()
        return
      }

      if (!selectedTextNodeId || editingTextNodeId) {
        return
      }

      event.preventDefault()
      onEnterTextEditing(selectedTextNodeId)
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled:
        enabled &&
        interactionMode === 'select' &&
        !contextMenuOpen &&
        (croppingNodeId != null ||
          (selectedTextNodeId != null && editingTextNodeId == null)),
    },
    [
      contextMenuOpen,
      croppingNodeId,
      editingTextNodeId,
      enabled,
      interactionMode,
      onApplyCrop,
      onEnterTextEditing,
      selectedTextNodeId,
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

  useHotkeys(
    't',
    (event) => {
      event.preventDefault()

      if (contextMenuOpen) {
        onCloseContextMenu()
      }

      if (interactionMode !== 'text') {
        onInteractionModeChange('text')
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled,
    },
    [contextMenuOpen, enabled, interactionMode, onCloseContextMenu, onInteractionModeChange],
  )

  useHotkeys(
    'mod+s',
    (event) => {
      event.preventDefault()
      onManualSave?.()
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: enabled && onManualSave != null,
    },
    [enabled, onManualSave],
  )

  const clipboardHotkeysEnabled =
    enabled &&
    interactionMode === 'select' &&
    !contextMenuOpen &&
    editingTextNodeId == null &&
    croppingNodeId == null

  useHotkeys(
    'mod+a',
    (event) => {
      event.preventDefault()
      onSelectAllNodes()
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: clipboardHotkeysEnabled,
    },
    [clipboardHotkeysEnabled, onSelectAllNodes],
  )

  useHotkeys(
    'mod+c',
    (event) => {
      if (onCopy?.()) {
        event.preventDefault()
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: clipboardHotkeysEnabled && onCopy != null,
    },
    [clipboardHotkeysEnabled, onCopy],
  )

  useHotkeys(
    'mod+v',
    (event) => {
      if (onPaste?.()) {
        event.preventDefault()
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: clipboardHotkeysEnabled && onPaste != null,
    },
    [clipboardHotkeysEnabled, onPaste],
  )

  useHotkeys(
    'mod+z',
    (event) => {
      if (onUndo?.()) {
        event.preventDefault()
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: clipboardHotkeysEnabled && onUndo != null,
    },
    [clipboardHotkeysEnabled, onUndo],
  )

  useHotkeys(
    'mod+shift+z',
    (event) => {
      if (onRedo?.()) {
        event.preventDefault()
      }
    },
    {
      ...STORYBOARD_HOTKEY_OPTIONS,
      enabled: clipboardHotkeysEnabled && onRedo != null,
    },
    [clipboardHotkeysEnabled, onRedo],
  )
}
