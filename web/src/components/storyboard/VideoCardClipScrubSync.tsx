import { useEffect, useRef } from 'react'
import { useNodeId } from '@xyflow/react'
import { useFrameflowVideoContext } from '../../frameflow'
import { useClipExtractModeOptional } from './ClipExtractProvider'

/** Keeps clip out-point in sync with scrubbing while clip mode is active. */
export function VideoCardClipScrubSync() {
  const nodeId = useNodeId()
  const clipMode = useClipExtractModeOptional()
  const { currentFrame, seekCommitToken } = useFrameflowVideoContext()
  const updateOutFrameRef = useRef(clipMode?.updateOutFrame)

  updateOutFrameRef.current = clipMode?.updateOutFrame

  const clipModeActive =
    nodeId != null && (clipMode?.isClipModeActive(nodeId) ?? false)

  useEffect(() => {
    if (!clipModeActive || currentFrame == null) {
      return
    }

    updateOutFrameRef.current?.(currentFrame)
  }, [clipModeActive, currentFrame, seekCommitToken])

  return null
}
