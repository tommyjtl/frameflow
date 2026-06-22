import { useCallback, useEffect, useRef } from 'react'
import {
  startUrlImport,
  StoryboardApiError,
  subscribeImportJobEvents,
  type ImportCompletePayload,
} from './storyboardApi'
import {
  createImageNode,
  createUrlImportPlaceholderNode,
  createVideoNode,
  getImageNodeDimensions,
  getVideoNodeDimensions,
  STORYBOARD_URL_IMPORT_BODY_SIZE,
  isVideoNodeData,
  type MediaCardNodeType,
  type StoryboardNodeType,
} from './storyboardTypes'

type UseUrlImportOptions = {
  enabled: boolean
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  getViewportCenterFlowPosition: () => { x: number; y: number }
  onMessage: (text: string, type: 'error' | 'info') => void
  takeSnapshot?: () => void
}

function patchImportNode(
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

function replaceNodeWithImportComplete(
  nodeId: string,
  node: MediaCardNodeType,
  complete: ImportCompletePayload,
): StoryboardNodeType {
  const shared = {
    label: complete.title || node.data.label || 'Imported media',
    src: complete.url,
    assetId: complete.assetId,
    sourceUrl: node.data.sourceUrl,
    platform: node.data.platform,
    importJobId: node.data.importJobId,
  }

  if (complete.kind === 'image') {
    const naturalWidth = complete.naturalWidth ?? STORYBOARD_URL_IMPORT_BODY_SIZE
    const naturalHeight = complete.naturalHeight ?? STORYBOARD_URL_IMPORT_BODY_SIZE
    const dimensions =
      complete.naturalWidth && complete.naturalHeight
        ? getImageNodeDimensions(complete.naturalWidth, complete.naturalHeight)
        : {
            width: STORYBOARD_URL_IMPORT_BODY_SIZE,
            height: STORYBOARD_URL_IMPORT_BODY_SIZE,
          }

    return createImageNode(
      nodeId,
      node.position,
      {
        ...shared,
        naturalWidth,
        naturalHeight,
      },
      dimensions,
    )
  }

  const dimensions = getVideoNodeDimensions(
    complete.naturalWidth,
    complete.naturalHeight,
  )

  return createVideoNode(
    nodeId,
    node.position,
    {
      ...shared,
      lastFrame: isVideoNodeData(node.data) ? node.data.lastFrame : undefined,
    },
    dimensions,
  )
}

export function useUrlImport({
  enabled,
  setNodes,
  getViewportCenterFlowPosition,
  onMessage,
  takeSnapshot,
}: UseUrlImportOptions) {
  const subscriptionsRef = useRef(new Map<string, () => void>())

  const unsubscribeJob = useCallback((jobId: string) => {
    const unsubscribe = subscriptionsRef.current.get(jobId)

    if (unsubscribe) {
      unsubscribe()
      subscriptionsRef.current.delete(jobId)
    }
  }, [])

  const subscribeToJob = useCallback(
    (jobId: string, nodeId: string) => {
      unsubscribeJob(jobId)

      const unsubscribe = subscribeImportJobEvents(jobId, {
        onMetadata: ({ title }) => {
          setNodes(
            patchImportNode(nodeId, {
              importTitle: title ?? undefined,
              label: title ?? 'Importing…',
            }),
          )
        },
        onProgress: ({ percent, title }) => {
          setNodes(
            patchImportNode(nodeId, {
              importProgress: percent,
              importStatus: 'downloading',
              ...(title
                ? { importTitle: title, label: title }
                : {}),
            }),
          )
        },
        onComplete: (complete) => {
          setNodes((nodes) => {
            const node = nodes.find(
              (item): item is MediaCardNodeType =>
                item.id === nodeId && item.type === 'mediaCard',
            )

            if (!node) {
              return nodes
            }

            const nextNode = replaceNodeWithImportComplete(nodeId, node, complete)

            return nodes.map((item) => (item.id === nodeId ? nextNode : item))
          })
          unsubscribeJob(jobId)
          onMessage('Import complete.', 'info')
        },
        onError: ({ message }) => {
          setNodes(
            patchImportNode(nodeId, {
              importStatus: 'error',
              importErrorMessage: message,
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

  const reconnectUrlImports = useCallback(
    (nodes: StoryboardNodeType[]) => {
      for (const node of nodes) {
        if (node.type !== 'mediaCard') {
          continue
        }

        const { importJobId, importStatus, assetId } = node.data

        if (!importJobId || assetId || importStatus === 'error') {
          continue
        }

        subscribeToJob(importJobId, node.id)
      }
    },
    [subscribeToJob],
  )

  const startUrlImportFlow = useCallback(
    async (url: string) => {
      if (!enabled) {
        throw new Error('Import is unavailable right now.')
      }

      const nodeId = crypto.randomUUID()
      const position = getViewportCenterFlowPosition()
      const placeholder = createUrlImportPlaceholderNode(nodeId, position, {
        sourceUrl: url,
        platform: 'youtube',
      })

      takeSnapshot?.()
      setNodes((nodes) => [...nodes, placeholder])

      try {
        const response = await startUrlImport({ url, nodeId })

        setNodes(
          patchImportNode(nodeId, {
            importJobId: response.jobId,
            platform: response.platform,
            sourceUrl: url,
            importTitle: response.title ?? undefined,
            label: response.title ?? 'Importing…',
          }),
        )

        subscribeToJob(response.jobId, nodeId)
      } catch (error) {
        setNodes((nodes) => nodes.filter((node) => node.id !== nodeId))

        throw error instanceof StoryboardApiError
          ? error
          : new Error('Could not start import.')
      }
    },
    [enabled, getViewportCenterFlowPosition, setNodes, subscribeToJob, takeSnapshot],
  )

  useEffect(() => {
    const subscriptions = subscriptionsRef.current

    return () => {
      for (const unsubscribe of subscriptions.values()) {
        unsubscribe()
      }

      subscriptions.clear()
    }
  }, [])

  return {
    startUrlImport: startUrlImportFlow,
    reconnectUrlImports,
  }
}
