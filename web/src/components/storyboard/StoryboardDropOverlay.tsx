type StoryboardDropOverlayProps = {
  active: boolean
}

export function StoryboardDropOverlay({ active }: StoryboardDropOverlayProps) {
  if (!active) {
    return null
  }

  return (
    <div className="storyboard-drop-overlay" aria-hidden={!active}>
      <div className="storyboard-drop-overlay__content">
        <p className="storyboard-drop-overlay__title">Drop to add media</p>
        <p className="storyboard-drop-overlay__hint">
          Video (.mp4, .mov) or image (JPEG, PNG, WebP, GIF, AVIF, SVG)
        </p>
      </div>
    </div>
  )
}
