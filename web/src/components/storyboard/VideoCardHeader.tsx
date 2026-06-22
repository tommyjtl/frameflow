import { type MouseEvent, type PointerEvent } from 'react'
import { useNodeId } from '@xyflow/react'
import { Camera, ExternalLink, Pause, Play } from 'lucide-react'
import { useFrameflowVideoContext } from '../../frameflow'
import { PlatformIcon } from './PlatformIcon'
import { useMediaCardRename } from './useMediaCardRename'
import { useFrameExtractDrag } from './FrameExtractDragProvider'

type ImportVideoCardHeaderProps = {
  label: string
  platform?: 'youtube' | 'instagram'
  importStatus?: 'downloading' | 'error'
  importProgress?: number
  importTitle?: string
}

export function ImportVideoCardHeader({
  label,
  platform,
  importStatus = 'downloading',
  importProgress,
  importTitle,
}: ImportVideoCardHeaderProps) {
  const displayLabel = importTitle ?? label
  const isImportError = importStatus === 'error'

  return (
    <header className="media-card__header dragHandle">
      <div className="media-card__header-main">
        {platform ? (
          <span className="media-card__platform-icon" aria-hidden>
            <PlatformIcon platform={platform} />
          </span>
        ) : null}
        <span className="media-card__label">
          {isImportError ? (importTitle ?? label) : displayLabel}
        </span>
      </div>

      <div className="media-card__header-actions nodrag nopan">
        {isImportError ? (
          <span className="media-card__import-progress media-card__import-progress--error">
            Failed
          </span>
        ) : (
          <span className="media-card__import-progress">
            Downloading {Math.round(importProgress ?? 0)}%
          </span>
        )}
      </div>
    </header>
  )
}

type VideoCardHeaderProps = {
  label: string
  platform?: 'youtube' | 'instagram'
  sourceUrl?: string
}

export function VideoCardHeader({
  label,
  platform,
  sourceUrl,
}: VideoCardHeaderProps) {
  const nodeId = useNodeId()
  const { isPlaying, isReady, currentFrame } = useFrameflowVideoContext()
  const { beginFrameExtractFromButton } = useFrameExtractDrag()
  const showPlatformIcon = Boolean(platform && sourceUrl)
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

  const canOpenSource = Boolean(sourceUrl)
  const openSourceLabel =
    platform === 'youtube'
      ? 'Open on YouTube'
      : platform === 'instagram'
        ? 'Open on Instagram'
        : 'Open original'

  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    startEditing()
  }

  const handleExtractPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!nodeId || !canExtract) {
      return
    }

    beginFrameExtractFromButton(nodeId, event.currentTarget, event)
  }

  const handleOpenSourceClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!sourceUrl) {
      return
    }

    window.open(sourceUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <header
      className="media-card__header dragHandle"
      onDoubleClick={handleDoubleClick}
    >
      <div className="media-card__header-main">
        {showPlatformIcon && platform ? (
          <span className="media-card__platform-icon" aria-hidden>
            <PlatformIcon platform={platform} />
          </span>
        ) : null}

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
        {canOpenSource ? (
          <button
            type="button"
            className="media-card__header-btn"
            title={openSourceLabel}
            aria-label={openSourceLabel}
            onClick={handleOpenSourceClick}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <ExternalLink size={15} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
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
          onPointerDown={handleExtractPointerDown}
        >
          <Camera size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </header>
  )
}
