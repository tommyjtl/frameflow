export const FRAMEFLOW_SUPPORTED =
  typeof HTMLVideoElement !== 'undefined' &&
  'requestVideoFrameCallback' in HTMLVideoElement.prototype

export const FPS_PROBE_SAMPLES = 15
export const FPS_FALLBACK = 24
export const COMMON_FPS = [24, 25, 30, 48, 50, 60]

export const REFERENCE_SCRUB_FPS = 24
export const SCRUB_SLOW_PLAYBACK_RATE = 1
export const SCRUB_FAST_PLAYBACK_RATE = 25
export const MAX_FORWARD_SEEK_FRAMES_AT_REF = 15
export const MAX_BACKWARD_SEEK_FRAMES_AT_REF = 120

export const SCRUB_CONFIG = {
  resumeAfterScrub: false,
  fastTierTimeBased: true,
} as const

export const VELOCITY_SPEED_TIERS: {
  speed: 'slow' | 'fast'
  minAbs: number
  maxAbs: number
}[] = [
    { speed: 'slow', minAbs: 0, maxAbs: 500 },
    { speed: 'fast', minAbs: 500, maxAbs: Number.POSITIVE_INFINITY },
  ]

export const SAMPLE_INTERVAL_MS = 64
export const MOTION_IDLE_MS = 50

/** Max pointer movement (px) to count as click vs scrub drag. */
export const POINTER_CLICK_TOLERANCE_PX = 8

/** Progress strip visuals and hit target at the top of the canvas. */
export const PROGRESS_BAR_HEIGHT_PX = 2
export const PROGRESS_BAR_HOVER_HEIGHT_PX = 10
export const PROGRESS_HIT_AREA_HEIGHT_PX = 5

export const DEFAULT_SAMPLE_VIDEO = '/videos/do-it-again.mp4'
