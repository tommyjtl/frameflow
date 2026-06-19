import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useNodeId, useReactFlow } from '@xyflow/react'
import { useStoryboardCardActions } from './StoryboardCardActionsContext'
import type { MediaCardNodeType } from './storyboardTypes'

export function useMediaCardRename(label: string) {
  const nodeId = useNodeId()
  const { setNodes } = useReactFlow<MediaCardNodeType>()
  const { pendingRenameNodeId, clearRenameRequest } = useStoryboardCardActions()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(label)
  }, [label])

  useEffect(() => {
    if (pendingRenameNodeId !== nodeId) {
      return
    }

    setIsEditing(true)
    clearRenameRequest()
  }, [clearRenameRequest, nodeId, pendingRenameNodeId])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const commitRename = useCallback(() => {
    const trimmed = draft.trim()

    if (!nodeId) {
      setDraft(label)
      setIsEditing(false)
      return
    }

    if (trimmed && trimmed !== label) {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, label: trimmed } }
            : node,
        ),
      )
    } else {
      setDraft(label)
    }

    setIsEditing(false)
  }, [draft, label, nodeId, setNodes])

  const cancelRename = useCallback(() => {
    setDraft(label)
    setIsEditing(false)
  }, [label])

  const startEditing = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation()

      if (event.key === 'Enter') {
        event.preventDefault()
        commitRename()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRename()
      }
    },
    [cancelRename, commitRename],
  )

  return {
    isEditing,
    draft,
    setDraft,
    inputRef,
    commitRename,
    startEditing,
    handleInputKeyDown,
  }
}
