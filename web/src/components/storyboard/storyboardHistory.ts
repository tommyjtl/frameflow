import type { Edge } from '@xyflow/react'
import type { StoryboardNodeType } from './storyboardTypes'

export type StoryboardFlowSnapshot = {
  nodes: StoryboardNodeType[]
  edges: Edge[]
}

export const STORYBOARD_HISTORY_LIMIT = 100

export function cloneStoryboardSnapshot(
  nodes: StoryboardNodeType[],
  edges: Edge[],
): StoryboardFlowSnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  }
}
