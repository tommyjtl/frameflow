import type { MouseEvent } from 'react'
import { PlatformIcon } from './PlatformIcon'

type ImageCardBodyProps = {
  src: string
  alt: string
  platform?: 'youtube' | 'instagram'
  sourceUrl?: string
  importing?: boolean
  onDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void
}

export function ImageCardBody({
  src,
  alt,
  platform,
  sourceUrl,
  importing = false,
  onDoubleClick,
}: ImageCardBodyProps) {
  if (importing || !src) {
    return (
      <div className="image-card-body image-card-body--importing">
        <div className="media-card__import-placeholder" aria-hidden>
          <span className="media-card__import-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="image-card-body" onDoubleClick={onDoubleClick}>
      {platform && sourceUrl ? (
        <span className="image-card-body__platform-badge" aria-hidden>
          <PlatformIcon platform={platform} />
        </span>
      ) : null}
      <img
        className="image-card-body__preview"
        src={src}
        alt={alt}
        draggable={false}
      />
    </div>
  )
}
