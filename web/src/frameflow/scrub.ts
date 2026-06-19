import {
  REFERENCE_SCRUB_FPS,
  SCRUB_FAST_PLAYBACK_RATE,
  SCRUB_SLOW_PLAYBACK_RATE,
  MAX_FORWARD_SEEK_FRAMES_AT_REF,
  MAX_BACKWARD_SEEK_FRAMES_AT_REF,
} from './constants'
import type { MotionSpeed } from './types'

export function scaleFramesToReferenceFps(
  framesAtRef: number,
  videoFps: number,
): number {
  return Math.max(
    1,
    Math.round((framesAtRef * videoFps) / REFERENCE_SCRUB_FPS),
  )
}

export function getSlowScrubStepFrames(videoFps: number): number {
  return scaleFramesToReferenceFps(1, videoFps)
}

export function getMaxForwardSeekFrames(videoFps: number): number {
  return Math.max(
    getSlowScrubStepFrames(videoFps),
    scaleFramesToReferenceFps(MAX_FORWARD_SEEK_FRAMES_AT_REF, videoFps),
  )
}

export function getMaxBackwardSeekFrames(videoFps: number): number {
  return scaleFramesToReferenceFps(
    MAX_BACKWARD_SEEK_FRAMES_AT_REF,
    videoFps,
  )
}

export function getNextFrameIndex(
  current: number,
  direction: 'left' | 'right',
  totalFrames: number,
  step = 1,
): number {
  return direction === 'right'
    ? Math.min(current + step, totalFrames - 1)
    : Math.max(current - step, 0)
}

export function getScrubInterval(tier: MotionSpeed, videoFps: number): number {
  const frameMs = 1000 / videoFps
  const rate =
    tier === 'fast' ? SCRUB_FAST_PLAYBACK_RATE : SCRUB_SLOW_PLAYBACK_RATE
  return frameMs / rate
}

export function computeTimeBasedScrubTargetFrame(
  anchorFrame: number,
  anchorWallTime: number,
  direction: 'left' | 'right',
  playbackRate: number,
  videoFps: number,
  totalFrames: number,
): number {
  const elapsedSec = (performance.now() - anchorWallTime) / 1000
  const sign = direction === 'right' ? 1 : -1
  const delta = Math.round(elapsedSec * videoFps * playbackRate * sign)
  return Math.max(0, Math.min(anchorFrame + delta, totalFrames - 1))
}

export function getFrameIndexFromMediaTime(
  mediaTime: number,
  videoFps: number,
): number {
  return Math.round(mediaTime * videoFps)
}

export function clampFastScrubTarget(
  current: number,
  target: number,
  direction: 'left' | 'right',
  videoFps: number,
): number {
  if (direction === 'right') {
    return Math.min(target, current + getMaxForwardSeekFrames(videoFps))
  }
  return Math.max(target, current - getMaxBackwardSeekFrames(videoFps))
}
