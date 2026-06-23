import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  TEXT_NOTE_NODE_TYPE,
  isTextNoteNode,
  type BoardInteractionMode,
  type StoryboardNodeType,
} from './storyboardTypes'

type StoryboardTextEditingContextValue = {
  editingTextNodeId: string | null
  interactionMode: BoardInteractionMode
  enterTextEditing: (nodeId: string) => void
  exitTextEditing: () => void
  clearTextEditing: () => void
}

const StoryboardTextEditingContext =
  createContext<StoryboardTextEditingContextValue | null>(null)

type StoryboardTextEditingProviderProps = {
  children: ReactNode
  nodes: StoryboardNodeType[]
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  takeSnapshot: () => void
  interactionMode: BoardInteractionMode
}

export function StoryboardTextEditingProvider({
  children,
  nodes,
  setNodes,
  takeSnapshot,
  interactionMode,
}: StoryboardTextEditingProviderProps) {
  const [editingTextNodeId, setEditingTextNodeId] = useState<string | null>(
    null,
  )
  const nodesRef = useRef(nodes)

  nodesRef.current = nodes

  useEffect(() => {
    if (
      editingTextNodeId &&
      !nodes.some((node) => node.id === editingTextNodeId)
    ) {
      setEditingTextNodeId(null)
    }
  }, [editingTextNodeId, nodes])

  const clearTextEditing = useCallback(() => {
    setEditingTextNodeId(null)
  }, [])

  const enterTextEditing = useCallback(
    (nodeId: string) => {
      if (interactionMode !== 'select' && interactionMode !== 'text') {
        return
      }

      setEditingTextNodeId(nodeId)
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type !== TEXT_NOTE_NODE_TYPE) {
            return node.selected ? { ...node, selected: false } : node
          }

          const isTarget = node.id === nodeId

          return {
            ...node,
            selected: isTarget,
            draggable: !isTarget,
          }
        }),
      )
    },
    [interactionMode, setNodes],
  )

  const exitTextEditing = useCallback(() => {
    const nodeId = editingTextNodeId

    if (!nodeId) {
      return
    }

    const node = nodesRef.current.find((item) => item.id === nodeId)

    if (node && isTextNoteNode(node)) {
      if (!node.data.text.trim()) {
        takeSnapshot()
        setNodes((currentNodes) =>
          currentNodes.filter((item) => item.id !== nodeId),
        )
        setEditingTextNodeId(null)
        return
      }

      const scale = node.data.scale ?? 1
      const width = node.width ?? 0
      const referenceWidth = width > 0 ? width / scale : undefined

      setNodes((currentNodes) =>
        currentNodes.map((item) => {
          if (item.id !== nodeId || item.type !== TEXT_NOTE_NODE_TYPE) {
            return item
          }

          return {
            ...item,
            draggable: true,
            selected: true,
            data: {
              ...item.data,
              referenceWidth: referenceWidth ?? item.data.referenceWidth,
            },
          }
        }),
      )
    }

    setEditingTextNodeId(null)
  }, [editingTextNodeId, setNodes, takeSnapshot])

  useEffect(() => {
    if (interactionMode === 'draw' && editingTextNodeId) {
      exitTextEditing()
    }
  }, [editingTextNodeId, exitTextEditing, interactionMode])

  const value = useMemo(
    (): StoryboardTextEditingContextValue => ({
      editingTextNodeId,
      interactionMode,
      enterTextEditing,
      exitTextEditing,
      clearTextEditing,
    }),
    [
      clearTextEditing,
      editingTextNodeId,
      enterTextEditing,
      exitTextEditing,
      interactionMode,
    ],
  )

  return (
    <StoryboardTextEditingContext.Provider value={value}>
      {children}
    </StoryboardTextEditingContext.Provider>
  )
}

export function useStoryboardTextEditing(): StoryboardTextEditingContextValue {
  const context = useContext(StoryboardTextEditingContext)

  if (!context) {
    throw new Error(
      'useStoryboardTextEditing must be used within StoryboardTextEditingProvider',
    )
  }

  return context
}
