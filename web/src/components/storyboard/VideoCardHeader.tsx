import { Camera, Check, ExternalLink, Pause, Play, Repeat, Scissors, X } from 'lucide-react'
import { type MouseEvent, type PointerEvent } from 'react'
import { useNodeId, useReactFlow } from '@xyflow/react'
import { useFrameflowVideoContext } from '../../frameflow'
import { PlatformIcon } from './PlatformIcon'
import { useMediaCardRename } from './useMediaCardRename'
import { useFrameExtractDrag } from './FrameExtractDragProvider'
import { useClipExtractModeOptional } from './ClipExtractProvider'
import { canExtractClipFromVideo } from './clipExtractPlacement'
import type { MediaCardNodeType } from './storyboardTypes'

type ImportVideoCardHeaderProps = {
  label: string
  platform?: 'youtube' | 'instagram'
  importStatus?: 'downloading' | 'error'
  importProgress?: number
  importTitle?: string
  clipExtractStatus?: 'processing' | 'error'
  clipExtractProgress?: number
  onCancelClipExtract?: () => void
  onDismissClipExtract?: () => void
}

export function ImportVideoCardHeader({
  label,
  platform,
  importStatus = 'downloading',
  importProgress,
  importTitle,
  clipExtractStatus,
  clipExtractProgress,
  onCancelClipExtract,
  onDismissClipExtract,
}: ImportVideoCardHeaderProps) {
  const displayLabel = importTitle ?? label
  const isImportError = importStatus === 'error'
  const isClipError = clipExtractStatus === 'error'
  const isClipProcessing = clipExtractStatus === 'processing'

  return (
    <header className="media-card__header dragHandle">
      <div className="media-card__header-main">
        {platform ? (
          <span className="media-card__platform-icon" aria-hidden>
            <PlatformIcon platform={platform} />
          </span>
        ) : null}
        <span className="media-card__label">
          {isImportError || isClipError ? label : displayLabel}
        </span>
      </div>

      <div className="media-card__header-actions nodrag nopan">
        {isClipProcessing ? (
          <>
            <span className="media-card__import-progress">
              Extracting clip {Math.round(clipExtractProgress ?? 0)}%
            </span>
            {onCancelClipExtract ? (
              <button
                type="button"
                className="media-card__header-btn media-card__header-btn--clip-cancel"
                title="Cancel clip extraction"
                aria-label="Cancel clip extraction"
                onClick={(event) => {
                  event.stopPropagation()
                  onCancelClipExtract()
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <X size={15} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </>
        ) : isClipError ? (
          <>
            <span className="media-card__import-progress media-card__import-progress--error">
              Failed
            </span>
            {onDismissClipExtract ? (
              <button
                type="button"
                className="media-card__header-btn media-card__header-btn--clip-cancel"
                title="Dismiss failed clip card"
                aria-label="Dismiss failed clip card"
                onClick={(event) => {
                  event.stopPropagation()
                  onDismissClipExtract()
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <X size={15} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </>
        ) : isImportError ? (
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
  src: string
  assetId?: string | null
  loopPlayback?: boolean
}

export function VideoCardHeader({
  label,
  platform,
  sourceUrl,
  src,
  assetId,
  loopPlayback = false,
}: VideoCardHeaderProps) {
  const nodeId = useNodeId()
  const { setNodes } = useReactFlow<MediaCardNodeType>()
  const { isPlaying, isReady, currentFrame, videoFps } = useFrameflowVideoContext()
  const { beginFrameExtractFromButton } = useFrameExtractDrag()
  const clipMode = useClipExtractModeOptional()
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

  const canExtractFrame =
    isReady &&
    !isPlaying &&
    currentFrame !== null &&
    nodeId != null

  const canExtractClip =
    canExtractFrame && canExtractClipFromVideo({ assetId, src })

  const clipModeActive = nodeId != null && (clipMode?.isClipModeActive(nodeId) ?? false)
  const canCommitClip = nodeId != null && (clipMode?.canCommitClip(nodeId) ?? false)

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

    if (!nodeId || !canExtractFrame || clipModeActive) {
      return
    }

    beginFrameExtractFromButton(nodeId, event.currentTarget, event)
  }

  const handleClipEnterClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!nodeId || !canExtractClip || !clipMode || clipModeActive) {
      return
    }

    if (currentFrame != null) {
      clipMode.enterClipMode(nodeId, currentFrame)
    }
  }

  const handleClipCancelClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    clipMode?.exitClipMode()
  }

  const handleClipCommitClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!nodeId || !canCommitClip || !clipMode || videoFps == null) {
      return
    }

    void clipMode.commitClipExtract(nodeId, videoFps)
  }

  const handleOpenSourceClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!sourceUrl) {
      return
    }

    window.open(sourceUrl, '_blank', 'noopener,noreferrer')
  }

  const handleLoopToggleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (!nodeId || !isReady) {
      return
    }

    const nextLoopPlayback = !loopPlayback

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'mediaCard' || node.data.kind !== 'video') {
          return node
        }

        return {
          ...node,
          data: {
            ...node.data,
            loopPlayback: nextLoopPlayback,
          },
        }
      }),
    )
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
          className={[
            'media-card__header-btn',
            loopPlayback ? 'media-card__header-btn--loop-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          disabled={!isReady}
          title={
            loopPlayback
              ? 'Loop playback on (plays start to end repeatedly)'
              : 'Loop playback off'
          }
          aria-label={loopPlayback ? 'Disable loop playback' : 'Enable loop playback'}
          aria-pressed={loopPlayback}
          onClick={handleLoopToggleClick}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Repeat size={15} strokeWidth={2} aria-hidden />
        </button>
        {clipModeActive ? (
          <>
            <button
              type="button"
              className="media-card__header-btn media-card__header-btn--clip-cancel"
              title="Cancel clip extraction"
              aria-label="Cancel clip extraction"
              onClick={handleClipCancelClick}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <X size={15} strokeWidth={2} aria-hidden />
            </button>
            {canCommitClip ? (
              <button
                type="button"
                className="media-card__header-btn media-card__header-btn--clip-ready"
                title="Extract clip"
                aria-label="Extract clip"
                onClick={handleClipCommitClick}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Check size={15} strokeWidth={2.5} aria-hidden />
              </button>
            ) : (
              <span
                className="media-card__header-btn media-card__header-btn--clip-active"
                title="Scrub to set clip end"
                aria-label="Clip mode active"
              >
                <Scissors size={15} strokeWidth={2} aria-hidden />
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            className="media-card__header-btn"
            disabled={!canExtractClip}
            title={
              canExtractClip
                ? 'Extract clip from video'
                : 'Import or upload the video to extract clips'
            }
            aria-label="Extract clip from video"
            onClick={handleClipEnterClick}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Scissors size={15} strokeWidth={2} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className="media-card__header-btn"
          aria-disabled={!canExtractFrame || clipModeActive}
          title={
            canExtractFrame && !clipModeActive
              ? 'Extract frame'
              : clipModeActive
                ? 'Exit clip mode to extract a frame'
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
