import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getClipExtractErrorMessage, clipRangesEqual, normalizeClipRange } from './clipExtractPlacement'

type ClipRange = {
  start: number
  end: number
}

type ClipExtractContextValue = {
  activeNodeId: string | null
  anchorFrame: number | null
  range: ClipRange | null
  isClipModeActive: (nodeId: string) => boolean
  canCommitClip: (nodeId: string) => boolean
  enterClipMode: (nodeId: string, anchorFrame: number) => void
  exitClipMode: () => void
  updateOutFrame: (frame: number) => void
  setClipRange: (start: number, end: number) => void
  commitClipExtract: (nodeId: string, fps: number) => Promise<void>
}

const ClipExtractContext = createContext<ClipExtractContextValue | null>(null)

type ClipExtractProviderProps = {
  children: ReactNode
  startClipExtractJob: (input: {
    sourceNodeId: string
    startFrame: number
    endFrame: number
    fps: number
  }) => Promise<void>
  onMessage: (text: string, type: 'error' | 'info') => void
}

export function ClipExtractProvider({
  children,
  startClipExtractJob,
  onMessage,
}: ClipExtractProviderProps) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [anchorFrame, setAnchorFrame] = useState<number | null>(null)
  const [range, setRange] = useState<ClipRange | null>(null)

  const exitClipMode = useCallback(() => {
    setActiveNodeId(null)
    setAnchorFrame(null)
    setRange(null)
  }, [])

  const enterClipMode = useCallback(
    (nodeId: string, frame: number) => {
      if (activeNodeId === nodeId) {
        exitClipMode()
        return
      }

      setActiveNodeId(nodeId)
      setAnchorFrame(frame)
      setRange(null)
    },
    [activeNodeId, exitClipMode],
  )

  const updateOutFrame = useCallback(
    (frame: number) => {
      if (activeNodeId == null || anchorFrame == null) {
        return
      }

      const nextRange = normalizeClipRange(anchorFrame, frame)
      setRange((current) =>
        clipRangesEqual(current, nextRange) ? current : nextRange,
      )
    },
    [activeNodeId, anchorFrame],
  )

  const setClipRange = useCallback((start: number, end: number) => {
    const normalized = normalizeClipRange(start, end)
    setRange((current) =>
      clipRangesEqual(current, normalized) ? current : normalized,
    )
  }, [])

  const isClipModeActive = useCallback(
    (nodeId: string) => activeNodeId === nodeId,
    [activeNodeId],
  )

  const canCommitClip = useCallback(
    (nodeId: string) => activeNodeId === nodeId && range != null,
    [activeNodeId, range],
  )

  const commitClipExtract = useCallback(
    async (nodeId: string, fps: number) => {
      if (activeNodeId !== nodeId || !range) {
        return
      }

      if (!Number.isFinite(fps) || fps <= 0) {
        onMessage('Wait for the video frame rate probe to finish.', 'error')
        return
      }

      try {
        await startClipExtractJob({
          sourceNodeId: nodeId,
          startFrame: range.start,
          endFrame: range.end,
          fps,
        })
        exitClipMode()
      } catch (error) {
        onMessage(getClipExtractErrorMessage(error), 'error')
      }
    },
    [activeNodeId, exitClipMode, onMessage, range, startClipExtractJob],
  )

  const value = useMemo(
    (): ClipExtractContextValue => ({
      activeNodeId,
      anchorFrame,
      range,
      isClipModeActive,
      canCommitClip,
      enterClipMode,
      exitClipMode,
      updateOutFrame,
      setClipRange,
      commitClipExtract,
    }),
    [
      activeNodeId,
      anchorFrame,
      range,
      isClipModeActive,
      canCommitClip,
      enterClipMode,
      exitClipMode,
      updateOutFrame,
      setClipRange,
      commitClipExtract,
    ],
  )

  return (
    <ClipExtractContext.Provider value={value}>
      {children}
    </ClipExtractContext.Provider>
  )
}

export function useClipExtractMode(): ClipExtractContextValue {
  const context = useContext(ClipExtractContext)

  if (!context) {
    throw new Error('useClipExtractMode must be used within ClipExtractProvider')
  }

  return context
}

export function useClipExtractModeOptional(): ClipExtractContextValue | null {
  return useContext(ClipExtractContext)
}
