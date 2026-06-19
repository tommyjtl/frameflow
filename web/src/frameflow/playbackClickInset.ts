import type { PlaybackClickInset } from './types'

export function isInsidePlaybackClickSafeRect(
  x: number,
  y: number,
  overlayWidth: number,
  overlayHeight: number,
  inset: PlaybackClickInset,
): boolean {
  return (
    x >= inset.left &&
    x <= overlayWidth - inset.right &&
    y >= inset.top &&
    y <= overlayHeight - inset.bottom
  )
}

export function isPlaybackClickAllowed(
  pointerDown: { localX: number; localY: number },
  pointerUp: { localX: number; localY: number },
  overlayWidth: number,
  overlayHeight: number,
  inset: PlaybackClickInset | undefined,
): boolean {
  if (!inset) {
    return true
  }

  return (
    isInsidePlaybackClickSafeRect(
      pointerDown.localX,
      pointerDown.localY,
      overlayWidth,
      overlayHeight,
      inset,
    ) &&
    isInsidePlaybackClickSafeRect(
      pointerUp.localX,
      pointerUp.localY,
      overlayWidth,
      overlayHeight,
      inset,
    )
  )
}
