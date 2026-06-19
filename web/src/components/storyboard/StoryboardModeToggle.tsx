import { Panel } from '@xyflow/react'
import { PenLine, Pencil } from 'lucide-react'
import type { BoardInteractionMode } from './storyboardTypes'

type StoryboardModeToggleProps = {
  mode: BoardInteractionMode
  onModeChange: (mode: BoardInteractionMode) => void
}

export function StoryboardModeToggle({
  mode,
  onModeChange,
}: StoryboardModeToggleProps) {
  const isDrawMode = mode === 'draw'

  return (
    <Panel position="bottom-left" className="storyboard-draw-tool-panel">
      <div
        className="react-flow__controls storyboard-draw-tool"
        role="group"
        aria-label="Drawing tools"
      >
        <button
          type="button"
          className={[
            'react-flow__controls-button',
            isDrawMode ? 'storyboard-draw-tool__button--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-pressed={isDrawMode}
          aria-label={
            isDrawMode
              ? 'Drawing mode (V or Escape to exit)'
              : 'Freehand draw (D)'
          }
          title={
            isDrawMode
              ? 'Drawing mode (V or Escape to exit)'
              : 'Freehand draw (D)'
          }
          onClick={() => onModeChange(isDrawMode ? 'select' : 'draw')}
        >
          {isDrawMode ? (
            <Pencil aria-hidden strokeWidth={2} />
          ) : (
            <PenLine aria-hidden strokeWidth={2} />
          )}
        </button>
      </div>
    </Panel>
  )
}
