import type { FrameflowDebugSnapshot, DragDirection, MotionSpeed, FpsProbeStatus } from './types'

type BuildDebugSnapshotInput = {
  frameCallbackMetadata: VideoFrameCallbackMetadata
  fps: string
  currentFrame: number | null
  totalFrames: number | null
  probedVideoFps: number | null
  fpsProbeStatus: FpsProbeStatus
  isPlaying: boolean
  isScrubbing: boolean
  scrubThroughput: string | null
  dragDirection: DragDirection
  velocitySpeed: MotionSpeed | null
  dragVelocity: number | null
}

export function buildDebugSnapshot(
  input: BuildDebugSnapshotInput,
): FrameflowDebugSnapshot {
  const parsedPaintFps = Number.parseFloat(input.fps)
  const canvasPaintRateFps =
    Number.isFinite(parsedPaintFps) && parsedPaintFps > 0
      ? parsedPaintFps
      : null

  const parsedScrubThroughput =
    input.scrubThroughput !== null
      ? Number.parseFloat(input.scrubThroughput)
      : null

  return {
    frameCallback: input.frameCallbackMetadata,
    debug: {
      canvasPaintRateFps,
      frame: {
        current: input.currentFrame,
        total: input.totalFrames,
      },
      probedVideoFps: input.probedVideoFps,
      fpsProbeStatus: input.fpsProbeStatus,
      isPlaying: input.isPlaying,
      scrub: {
        active: input.isScrubbing,
        throughputFps:
          input.isScrubbing &&
          parsedScrubThroughput !== null &&
          Number.isFinite(parsedScrubThroughput)
            ? parsedScrubThroughput
            : null,
        direction: input.isScrubbing ? input.dragDirection : null,
        tier: input.isScrubbing ? input.velocitySpeed : null,
        velocityPxPerSec:
          input.isScrubbing && input.dragVelocity !== null
            ? Math.round(input.dragVelocity * 100) / 100
            : null,
      },
    },
  }
}
