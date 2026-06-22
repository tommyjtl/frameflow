import { useCallback, useEffect, useRef } from 'react'
import { useNodeId, useReactFlow } from '@xyflow/react'
import { useFrameflowVideoContext } from '../../frameflow'
import type { MediaCardNodeType } from './storyboardTypes'

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
  const {
    isReady,
    isPlaying,
    isSeeking,
    seekCommitToken,
    currentFrame,
    totalFrames,
    seekToFrame,
  } = useFrameflowVideoContext()
  const restoredSrcRef = useRef<string | null>(null)
  const wasPlayingRef = useRef(isPlaying)
  const currentFrameRef = useRef(currentFrame)
  const persistGenerationRef = useRef(0)

  currentFrameRef.current = currentFrame

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
  }, [isReady, lastFrame, seekToFrame, src, totalFrames])

  const persistLastFrame = useCallback(
    (frame: number) => {
      if (!nodeId) {
        return
      }

      const generation = ++persistGenerationRef.current

      setNodes((nodes) => {
        if (generation !== persistGenerationRef.current) {
          return nodes
        }

        return nodes.map((node) => {
          if (node.id !== nodeId || node.data.kind !== 'video') {
            return node
          }

          if (node.data.lastFrame === frame) {
            return node
          }

          return {
            ...node,
            data: {
              ...node.data,
              lastFrame: frame,
            },
          }
        })
      })
    },
    [nodeId, setNodes],
  )

  useEffect(() => {
    if (seekCommitToken === 0) {
      return
    }

    const frame = currentFrameRef.current

    if (frame == null) {
      return
    }

    persistLastFrame(frame)
  }, [persistLastFrame, seekCommitToken])

  useEffect(() => {
    const wasPlaying = wasPlayingRef.current
    wasPlayingRef.current = isPlaying

    if (!wasPlaying || isPlaying || isSeeking) {
      return
    }

    const frame = currentFrameRef.current

    if (frame == null) {
      return
    }

    persistLastFrame(frame)
  }, [isPlaying, isSeeking, persistLastFrame])

  return null
}
