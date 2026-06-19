import { type MouseEvent } from 'react'
import { useNodeId } from '@xyflow/react'
import { Camera, Pause, Play } from 'lucide-react'
import { useFrameflowVideoContext } from '../../frameflow'
import { useMediaCardRename } from './useMediaCardRename'
import { useStoryboardCardActions } from './StoryboardCardActionsContext'

type VideoCardHeaderProps = {
  label: string
}

export function VideoCardHeader({ label }: VideoCardHeaderProps) {
  const nodeId = useNodeId()
  const { isPlaying, isReady, currentFrame } = useFrameflowVideoContext()
  const { extractFrame } = useStoryboardCardActions()
  const {
    isEditing,
    draft,
    setDraft,
    inputRef,
    commitRename,
    startEditing,
    handleInputKeyDown,
  } = useMediaCardRename(label)

  const canExtract =
    isReady && !isPlaying && currentFrame !== null && nodeId != null

  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    startEditing()
  }

  const handleExtractClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!nodeId || !canExtract) {
      return
    }

    void extractFrame(nodeId)
  }

  return (
    <header
      className="media-card__header dragHandle"
      onDoubleClick={handleDoubleClick}
    >
      <div className="media-card__header-main">
        {isEditing ? (
          <input
            ref={inputRef}
            className="media-card__rename-input nodrag"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={handleInputKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            aria-label="Rename card"
          />
        ) : (
          <span className="media-card__label">{label}</span>
        )}
      </div>

      <div className="media-card__header-actions nodrag nopan">
        <span
          className="media-card__header-icon"
          aria-label={isPlaying ? 'Playing' : 'Paused'}
          title={isPlaying ? 'Playing' : 'Paused'}
        >
          {isPlaying ? (
            <Play size={15} strokeWidth={2} aria-hidden />
          ) : (
            <Pause size={15} strokeWidth={2} aria-hidden />
          )}
        </span>
        <button
          type="button"
          className="media-card__header-btn"
          disabled={!canExtract}
          title={
            canExtract
              ? 'Extract frame'
              : 'Pause on a frame to extract'
          }
          aria-label="Extract frame"
          onClick={handleExtractClick}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Camera size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </header>
  )
}
