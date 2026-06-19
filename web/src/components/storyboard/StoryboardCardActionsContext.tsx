import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { FrameCaptureRegistration } from './storyboardFrameCapture'

type StoryboardCardActionsContextValue = {
  pendingRenameNodeId: string | null
  requestRename: (nodeId: string) => void
  clearRenameRequest: () => void
  duplicateNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  registerFrameCapture: (nodeId: string, registration: FrameCaptureRegistration) => void
  unregisterFrameCapture: (nodeId: string) => void
  canExtractFrame: (nodeId: string) => boolean
  extractFrame: (nodeId: string) => Promise<void>
}

const StoryboardCardActionsContext =
  createContext<StoryboardCardActionsContextValue | null>(null)

type StoryboardCardActionsProviderProps = {
  duplicateNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  registerFrameCapture: (nodeId: string, registration: FrameCaptureRegistration) => void
  unregisterFrameCapture: (nodeId: string) => void
  canExtractFrame: (nodeId: string) => boolean
  extractFrame: (nodeId: string) => Promise<void>
  children: ReactNode
}

export function StoryboardCardActionsProvider({
  duplicateNode,
  deleteNode,
  registerFrameCapture,
  unregisterFrameCapture,
  canExtractFrame,
  extractFrame,
  children,
}: StoryboardCardActionsProviderProps) {
  const [pendingRenameNodeId, setPendingRenameNodeId] = useState<string | null>(
    null,
  )

  const requestRename = useCallback((nodeId: string) => {
    setPendingRenameNodeId(nodeId)
  }, [])

  const clearRenameRequest = useCallback(() => {
    setPendingRenameNodeId(null)
  }, [])

  const value = useMemo(
    (): StoryboardCardActionsContextValue => ({
      pendingRenameNodeId,
      requestRename,
      clearRenameRequest,
      duplicateNode,
      deleteNode,
      registerFrameCapture,
      unregisterFrameCapture,
      canExtractFrame,
      extractFrame,
    }),
    [
      pendingRenameNodeId,
      requestRename,
      clearRenameRequest,
      duplicateNode,
      deleteNode,
      registerFrameCapture,
      unregisterFrameCapture,
      canExtractFrame,
      extractFrame,
    ],
  )

  return (
    <StoryboardCardActionsContext.Provider value={value}>
      {children}
    </StoryboardCardActionsContext.Provider>
  )
}

export function useStoryboardCardActions(): StoryboardCardActionsContextValue {
  const context = useContext(StoryboardCardActionsContext)

  if (!context) {
    throw new Error(
      'useStoryboardCardActions must be used within StoryboardCardActionsProvider',
    )
  }

  return context
}
