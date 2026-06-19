import { useEffect, useRef } from 'react'
import { useNodeId, useReactFlow } from '@xyflow/react'
import { useFrameflowVideoContext } from '../../frameflow'
import type { MediaCardNodeType } from './storyboardTypes'

const PERSIST_DEBOUNCE_MS = 400

type VideoCardLastFrameSyncProps = {
  lastFrame?: number
  src: string
}

/** Restores and persists the scrub/playback frame for a storyboard video card. */
export function VideoCardLastFrameSync({
  lastFrame,
  src,
}: VideoCardLastFrameSyncProps) {
  const nodeId = useNodeId()
  const { setNodes } = useReactFlow<MediaCardNodeType>()
  const { isReady, currentFrame, totalFrames, seekToFrame } =
    useFrameflowVideoContext()
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    hasRestoredRef.current = false
  }, [lastFrame, src])

  useEffect(() => {
    if (!isReady || hasRestoredRef.current || lastFrame == null) {
      if (isReady && !hasRestoredRef.current && lastFrame == null) {
        hasRestoredRef.current = true
      }
      return
    }

    const maxFrame = totalFrames != null ? totalFrames - 1 : lastFrame
    seekToFrame(Math.min(lastFrame, maxFrame))
    hasRestoredRef.current = true
  }, [isReady, lastFrame, seekToFrame, totalFrames])

  useEffect(() => {
    if (!hasRestoredRef.current || !nodeId || currentFrame == null) {
      return
    }

    const timer = window.setTimeout(() => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== nodeId || node.data.kind !== 'video') {
            return node
          }

          if (node.data.lastFrame === currentFrame) {
            return node
          }

          return {
            ...node,
            data: {
              ...node.data,
              lastFrame: currentFrame,
            },
          }
        }),
      )
    }, PERSIST_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [currentFrame, nodeId, setNodes])

  return null
}
