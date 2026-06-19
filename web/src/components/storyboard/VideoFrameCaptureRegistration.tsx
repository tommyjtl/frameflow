import { useEffect, useRef } from 'react'
import { useNodeId } from '@xyflow/react'
import { useFrameflowVideoContext } from '../../frameflow'
import { useStoryboardCardActions } from './StoryboardCardActionsContext'

export function VideoFrameCaptureRegistration() {
  const nodeId = useNodeId()
  const { registerFrameCapture, unregisterFrameCapture } = useStoryboardCardActions()
  const { captureCurrentFramePng, isReady, isPlaying, currentFrame } =
    useFrameflowVideoContext()
  const stateRef = useRef({ isReady, isPlaying, currentFrame })

  stateRef.current = { isReady, isPlaying, currentFrame }

  useEffect(() => {
    if (!nodeId) {
      return
    }

    registerFrameCapture(nodeId, {
      canExtract: () => {
        const state = stateRef.current
        return state.isReady && !state.isPlaying && state.currentFrame !== null
      },
      capture: captureCurrentFramePng,
    })

    return () => {
      unregisterFrameCapture(nodeId)
    }
  }, [
    nodeId,
    registerFrameCapture,
    unregisterFrameCapture,
    captureCurrentFramePng,
  ])

  return null
}
