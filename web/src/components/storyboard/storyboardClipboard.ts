import type { Edge } from '@xyflow/react'
import {
  STORYBOARD_DUPLICATE_OFFSET,
  type StoryboardCopyableNode,
} from './storyboardTypes'

export type StoryboardClipboard = {
  nodes: StoryboardCopyableNode[]
  edges: Edge[]
}

export function buildClipboardFromSelection(
  nodes: StoryboardCopyableNode[],
  edges: Edge[],
): StoryboardClipboard | null {
  if (nodes.length === 0) {
    return null
  }

  const nodeIds = new Set(nodes.map((node) => node.id))
  const clipboardEdges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  )

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data },
    })) as StoryboardCopyableNode[],
    edges: clipboardEdges.map((edge) => ({ ...edge })),
  }
}

export function cloneClipboardItems(
  clipboard: StoryboardClipboard,
  pasteIndex: number,
): { nodes: StoryboardCopyableNode[]; edges: Edge[] } {
  const offset = {
    x: STORYBOARD_DUPLICATE_OFFSET.x * pasteIndex,
    y: STORYBOARD_DUPLICATE_OFFSET.y * pasteIndex,
  }

  const idMap = new Map<string, string>()

  for (const node of clipboard.nodes) {
    idMap.set(node.id, crypto.randomUUID())
  }

  const nodes = clipboard.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id)!,
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    },
    data: { ...node.data },
    selected: true,
  })) as StoryboardCopyableNode[]

  const edges = clipboard.edges.map((edge) => ({
    ...edge,
    id: crypto.randomUUID(),
    source: idMap.get(edge.source)!,
    target: idMap.get(edge.target)!,
    selected: false,
  }))

  return { nodes, edges }
}
