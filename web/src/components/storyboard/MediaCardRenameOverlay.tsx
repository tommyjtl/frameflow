import { useMediaCardRename } from './useMediaCardRename'

type MediaCardRenameOverlayProps = {
  label: string
}

export function MediaCardRenameOverlay({ label }: MediaCardRenameOverlayProps) {
  const {
    isEditing,
    draft,
    setDraft,
    inputRef,
    commitRename,
    handleInputKeyDown,
  } = useMediaCardRename(label)

  if (!isEditing) {
    return null
  }

  return (
    <div className="media-card__rename-overlay nodrag">
      <input
        ref={inputRef}
        className="media-card__rename-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitRename}
        onKeyDown={handleInputKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        aria-label="Rename card"
      />
    </div>
  )
}
