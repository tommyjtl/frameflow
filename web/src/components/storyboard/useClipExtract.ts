import { useCallback, useEffect, useRef } from 'react'
import {
  cancelClipExtract,
  startClipExtract,
  subscribeClipJobEvents,
  type ClipCompletePayload,
} from './storyboardApi'
import {
  createClipExtractPlaceholderNode,
  createVideoNode,
  isVideoNodeData,
  type MediaCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'
import {
  getClipExtractNodeDimensions,
  getClipLabel,
  getDefaultExtractClipPosition,
  resolveVideoAssetId,
} from './clipExtractPlacement'

type UseClipExtractOptions = {
  enabled: boolean
  getNodes: () => StoryboardNodeType[]
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  onMessage: (text: string, type: 'error' | 'info') => void
  takeSnapshot?: () => void
}

function patchClipExtractNode(
  nodeId: string,
  patch: Partial<MediaCardNodeType['data']>,
): (nodes: StoryboardNodeType[]) => StoryboardNodeType[] {
  return (nodes) =>
    nodes.map((node) => {
      if (node.id !== nodeId || node.type !== 'mediaCard') {
        return node
      }

      return {
        ...node,
        data: {
          ...node.data,
          ...patch,
        },
      }
    })
}

function removeNodeById(
  nodeId: string,
): (nodes: StoryboardNodeType[]) => StoryboardNodeType[] {
  return (nodes) => nodes.filter((node) => node.id !== nodeId)
}

function replaceNodeWithClipComplete(
  nodeId: string,
  node: MediaCardNodeType,
  complete: ClipCompletePayload,
): StoryboardNodeType {
  const dimensions = getClipExtractNodeDimensions(node)

  return createVideoNode(
    nodeId,
    node.position,
    {
      label: complete.title,
      src: complete.url,
      assetId: complete.assetId,
      naturalWidth: complete.naturalWidth,
      naturalHeight: complete.naturalHeight,
      sourceClipStartFrame: complete.sourceClipStartFrame,
      sourceClipEndFrame: complete.sourceClipEndFrame,
      extractedFromNodeId: complete.extractedFromNodeId,
    },
    dimensions,
  )
}

/** Mark orphaned processing placeholders (no job id) as failed after reload. */
export function repairStaleClipExtractNodes(
  nodes: StoryboardNodeType[],
): StoryboardNodeType[] {
  let changed = false

  const nextNodes = nodes.map((node) => {
    if (
      node.type !== 'mediaCard' ||
      !isVideoNodeData(node.data) ||
      node.data.clipExtractStatus !== 'processing' ||
      node.data.clipExtractJobId
    ) {
      return node
    }

    changed = true

    return {
      ...node,
      data: {
        ...node.data,
        clipExtractStatus: 'error' as const,
        clipExtractErrorMessage:
          'Clip extraction was interrupted before the job started.',
      },
    }
  })

  return changed ? nextNodes : nodes
}

export function useClipExtract({
  enabled,
  getNodes,
  setNodes,
  onMessage,
  takeSnapshot,
}: UseClipExtractOptions) {
  const subscriptionsRef = useRef(new Map<string, () => void>())
  const getNodesRef = useRef(getNodes)

  getNodesRef.current = getNodes

  const unsubscribeJob = useCallback((jobId: string) => {
    const unsubscribe = subscriptionsRef.current.get(jobId)

    if (unsubscribe) {
      unsubscribe()
      subscriptionsRef.current.delete(jobId)
    }
  }, [])

  const subscribeToJob = useCallback(
    (jobId: string, outputNodeId: string) => {
      unsubscribeJob(jobId)

      const unsubscribe = subscribeClipJobEvents(jobId, {
        onProgress: ({ percent }) => {
          setNodes(
            patchClipExtractNode(outputNodeId, {
              clipExtractProgress: percent,
              clipExtractStatus: 'processing',
            }),
          )
        },
        onComplete: (complete) => {
          setNodes((nodes) => {
            const node = nodes.find(
              (item): item is MediaCardNodeType =>
                item.id === outputNodeId && item.type === 'mediaCard',
            )

            if (!node) {
              return nodes
            }

            const nextNode = replaceNodeWithClipComplete(
              outputNodeId,
              node,
              complete,
            )

            return nodes.map((item) =>
              item.id === outputNodeId ? { ...nextNode, selected: true } : item,
            )
          })
          unsubscribeJob(jobId)
          onMessage('Extracted clip to new video card.', 'info')
        },
        onError: ({ message }) => {
          const isCancelled = message === 'Clip extraction cancelled.'

          if (isCancelled) {
            unsubscribeJob(jobId)
            return
          }

          setNodes(
            patchClipExtractNode(outputNodeId, {
              clipExtractStatus: 'error',
              clipExtractErrorMessage: message,
            }),
          )
          unsubscribeJob(jobId)
          onMessage(message, 'error')
        },
      })

      subscriptionsRef.current.set(jobId, unsubscribe)
    },
    [onMessage, setNodes, unsubscribeJob],
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    return () => {
      for (const unsubscribe of subscriptionsRef.current.values()) {
        unsubscribe()
      }
      subscriptionsRef.current.clear()
    }
  }, [enabled])

  const resumePendingJobs = useCallback(
    (nodes: StoryboardNodeType[]) => {
      for (const node of nodes) {
        if (
          node.type !== 'mediaCard' ||
          !isVideoNodeData(node.data) ||
          node.data.clipExtractStatus !== 'processing' ||
          !node.data.clipExtractJobId
        ) {
          continue
        }

        subscribeToJob(node.data.clipExtractJobId, node.id)
      }
    },
    [subscribeToJob],
  )

  const startClipExtractJob = useCallback(
    async (input: {
      source: MediaCardNodeType
      startFrame: number
      endFrame: number
      fps: number
    }) => {
      const { source, startFrame, endFrame, fps } = input
      const sourceAssetId = resolveVideoAssetId(source.data)

      if (!isVideoNodeData(source.data) || !sourceAssetId) {
        throw new Error(
          'Clip extraction requires a video stored in the project. Import or upload the video first.',
        )
      }

      const outputNodeId = crypto.randomUUID()
      const label = getClipLabel(source.data.label, startFrame, endFrame)
      const position = getDefaultExtractClipPosition(source)
      const dimensions = getClipExtractNodeDimensions(source)

      const placeholder = createClipExtractPlaceholderNode(
        outputNodeId,
        position,
        {
          label,
          clipExtractJobId: '',
          sourceNodeId: source.id,
          startFrame,
          endFrame,
        },
        dimensions,
      )

      takeSnapshot?.()
      setNodes((currentNodes) => [
        ...currentNodes.map((node) =>
          node.id === source.id ? { ...node, selected: false } : node,
        ),
        { ...placeholder, selected: true },
      ])

      try {
        const { jobId } = await startClipExtract({
          sourceNodeId: source.id,
          outputNodeId,
          sourceAssetId,
          startFrame,
          endFrame,
          fps,
          label,
        })

        setNodes(
          patchClipExtractNode(outputNodeId, {
            clipExtractJobId: jobId,
          }),
        )

        subscribeToJob(jobId, outputNodeId)
      } catch (error) {
        setNodes(removeNodeById(outputNodeId))
        throw error
      }
    },
    [setNodes, subscribeToJob, takeSnapshot],
  )

  const cancelClipExtractJob = useCallback(
    async (outputNodeId: string) => {
      const node = getNodesRef.current().find(
        (item): item is MediaCardNodeType =>
          item.id === outputNodeId && item.type === 'mediaCard',
      )

      if (!node || !isVideoNodeData(node.data)) {
        return
      }

      const jobId = node.data.clipExtractJobId

      if (jobId) {
        unsubscribeJob(jobId)

        try {
          await cancelClipExtract(jobId)
        } catch {
          // Job may already be finished; still remove the placeholder card.
        }
      }

      takeSnapshot?.()
      setNodes(removeNodeById(outputNodeId))
      onMessage('Clip extraction cancelled.', 'info')
    },
    [onMessage, setNodes, takeSnapshot, unsubscribeJob],
  )

  const dismissClipExtractCard = useCallback(
    (outputNodeId: string) => {
      const node = getNodesRef.current().find((item) => item.id === outputNodeId)

      if (
        !node ||
        node.type !== 'mediaCard' ||
        !isVideoNodeData(node.data) ||
        node.data.clipExtractStatus !== 'error'
      ) {
        return
      }

      if (node.data.clipExtractJobId) {
        unsubscribeJob(node.data.clipExtractJobId)
      }

      takeSnapshot?.()
      setNodes(removeNodeById(outputNodeId))
    },
    [setNodes, takeSnapshot, unsubscribeJob],
  )

  return {
    resumePendingJobs,
    startClipExtractJob,
    cancelClipExtractJob,
    dismissClipExtractCard,
  }
}
