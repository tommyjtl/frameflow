import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, NodeChange } from '@xyflow/react'
import {
  cloneStoryboardSnapshot,
  STORYBOARD_HISTORY_LIMIT,
  type StoryboardFlowSnapshot,
} from './storyboardHistory'
import type { StoryboardNodeType } from './storyboardTypes'

type UseStoryboardUndoRedoOptions = {
  enabled: boolean
  nodes: StoryboardNodeType[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<StoryboardNodeType[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
}

export function useStoryboardUndoRedo({
  enabled,
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseStoryboardUndoRedoOptions) {
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const enabledRef = useRef(enabled)
  const isRestoringRef = useRef(false)
  const pastRef = useRef<StoryboardFlowSnapshot[]>([])
  const futureRef = useRef<StoryboardFlowSnapshot[]>([])
  const dragCountRef = useRef(0)
  const dragSnapshotRef = useRef<StoryboardFlowSnapshot | null>(null)
  const resizeSnapshotRef = useRef<StoryboardFlowSnapshot | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [])

  const resetHistory = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    dragCountRef.current = 0
    dragSnapshotRef.current = null
    resizeSnapshotRef.current = null
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const takeSnapshot = useCallback(() => {
    if (!enabledRef.current || isRestoringRef.current) {
      return
    }

    pastRef.current.push(
      cloneStoryboardSnapshot(nodesRef.current, edgesRef.current),
    )

    if (pastRef.current.length > STORYBOARD_HISTORY_LIMIT) {
      pastRef.current.shift()
    }

    futureRef.current = []
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const restoreSnapshot = useCallback(
    (snapshot: StoryboardFlowSnapshot) => {
      isRestoringRef.current = true
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      isRestoringRef.current = false
      syncHistoryFlags()
    },
    [setEdges, setNodes, syncHistoryFlags],
  )

  const undo = useCallback((): boolean => {
    if (!enabledRef.current || pastRef.current.length === 0) {
      return false
    }

    futureRef.current.unshift(
      cloneStoryboardSnapshot(nodesRef.current, edgesRef.current),
    )

    const previous = pastRef.current.pop()

    if (!previous) {
      return false
    }

    restoreSnapshot(previous)
    return true
  }, [restoreSnapshot])

  const redo = useCallback((): boolean => {
    if (!enabledRef.current || futureRef.current.length === 0) {
      return false
    }

    pastRef.current.push(
      cloneStoryboardSnapshot(nodesRef.current, edgesRef.current),
    )

    const next = futureRef.current.shift()

    if (!next) {
      return false
    }

    restoreSnapshot(next)
    return true
  }, [restoreSnapshot])

  const beginDragHistory = useCallback(() => {
    if (!enabledRef.current || isRestoringRef.current) {
      return
    }

    dragCountRef.current += 1

    if (dragCountRef.current === 1) {
      dragSnapshotRef.current = cloneStoryboardSnapshot(
        nodesRef.current,
        edgesRef.current,
      )
    }
  }, [])

  const commitDragHistory = useCallback(() => {
    if (dragCountRef.current === 0) {
      return
    }

    dragCountRef.current -= 1

    if (dragCountRef.current > 0 || !dragSnapshotRef.current) {
      return
    }

    if (!enabledRef.current || isRestoringRef.current) {
      dragSnapshotRef.current = null
      return
    }

    pastRef.current.push(dragSnapshotRef.current)

    if (pastRef.current.length > STORYBOARD_HISTORY_LIMIT) {
      pastRef.current.shift()
    }

    futureRef.current = []
    dragSnapshotRef.current = null
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const handleNodesChange = useCallback(
    (changes: NodeChange<StoryboardNodeType>[]) => {
      if (!isRestoringRef.current && enabledRef.current) {
        for (const change of changes) {
          if (change.type !== 'dimensions') {
            continue
          }

          if (change.resizing) {
            if (!resizeSnapshotRef.current) {
              resizeSnapshotRef.current = cloneStoryboardSnapshot(
                nodesRef.current,
                edgesRef.current,
              )
            }
            continue
          }

          if (resizeSnapshotRef.current) {
            pastRef.current.push(resizeSnapshotRef.current)

            if (pastRef.current.length > STORYBOARD_HISTORY_LIMIT) {
              pastRef.current.shift()
            }

            futureRef.current = []
            resizeSnapshotRef.current = null
            syncHistoryFlags()
          }
        }
      }

      return changes
    },
    [syncHistoryFlags],
  )

  const handleBeforeDelete = useCallback(async () => {
    takeSnapshot()
    return true
  }, [takeSnapshot])

  return {
    canUndo,
    canRedo,
    takeSnapshot,
    undo,
    redo,
    resetHistory,
    beginDragHistory,
    commitDragHistory,
    handleNodesChange,
    handleBeforeDelete,
    isRestoringRef,
  }
}
