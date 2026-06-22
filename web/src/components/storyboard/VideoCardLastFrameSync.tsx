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
  const { isReady, isPlaying, isScrubbing, currentFrame, totalFrames, seekToFrame } =
    useFrameflowVideoContext()
  const restoredSrcRef = useRef<string | null>(null)

  useEffect(() => {
    restoredSrcRef.current = null
  }, [src])

  useEffect(() => {
    if (!isReady || !src || totalFrames == null || restoredSrcRef.current === src) {
      return
    }

    restoredSrcRef.current = src

    if (lastFrame != null && lastFrame > 0) {
      seekToFrame(Math.min(lastFrame, totalFrames - 1))
    }
  }, [isReady, seekToFrame, src, totalFrames])

  useEffect(() => {
    if (!nodeId || currentFrame == null || isPlaying || isScrubbing) {
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
  }, [currentFrame, isPlaying, isScrubbing, nodeId, setNodes])

  return null
}
