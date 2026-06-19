import { type MouseEvent } from 'react'
import { useMediaCardRename } from './useMediaCardRename'

type MediaCardHeaderProps = {
  label: string
}

export function MediaCardHeader({ label }: MediaCardHeaderProps) {
  const {
    isEditing,
    draft,
    setDraft,
    inputRef,
    commitRename,
    startEditing,
    handleInputKeyDown,
  } = useMediaCardRename(label)

  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    startEditing()
  }

  return (
    <header
      className="media-card__header dragHandle"
      onDoubleClick={handleDoubleClick}
    >
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
    </header>
  )
}
