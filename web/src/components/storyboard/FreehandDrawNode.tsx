import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import type { FreehandDrawNodeType } from './storyboardTypes'

function FreehandDrawNodeComponent({
  data,
  width,
  height,
  selected,
}: NodeProps<FreehandDrawNodeType>) {
  const nodeWidth = width ?? 1
  const nodeHeight = height ?? 1

  return (
    <div
      className={[
        'freehand-draw-node',
        selected ? 'freehand-draw-node--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        className="freehand-draw-node__svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${nodeWidth} ${nodeHeight}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path className="freehand-draw-node__path" d={data.path} fill={data.color} />
      </svg>
    </div>
  )
}

export const FreehandDrawNode = memo(FreehandDrawNodeComponent)
