import { COMMON_FPS, FPS_FALLBACK } from './constants'

export function estimateFpsFromDeltas(deltas: number[]): number {
  const sorted = [...deltas].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  if (median <= 0) {
    return FPS_FALLBACK
  }

  const raw = 1 / median
  return COMMON_FPS.reduce(
    (best, value) =>
      Math.abs(value - raw) < Math.abs(best - raw) ? value : best,
    COMMON_FPS[0],
  )
}

export function fallbackFps(video: HTMLVideoElement): number {
  if ('getVideoPlaybackQuality' in video) {
    const quality = video.getVideoPlaybackQuality()
    if (quality.totalVideoFrames > 0 && video.duration > 0) {
      return Math.round(quality.totalVideoFrames / video.duration)
    }
  }
  return FPS_FALLBACK
}
