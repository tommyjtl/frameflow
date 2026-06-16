export type DragDirection = 'left' | 'right' | 'neutral'
export type MotionSpeed = 'slow' | 'fast'
export type FpsProbeStatus = 'pending' | 'probing' | 'ready' | 'needs-play'

export type MotionSample = {
  x: number
  t: number
}

/** Raw frame callback fields plus debug readouts. */
export type FrameflowDebugSnapshot = {
  frameCallback: VideoFrameCallbackMetadata
  debug: {
    canvasPaintRateFps: number | null
    frame: {
      current: number | null
      total: number | null
    }
    probedVideoFps: number | null
    fpsProbeStatus: FpsProbeStatus
    isPlaying: boolean
    scrub: {
      active: boolean
      throughputFps: number | null
      direction: DragDirection | null
      tier: MotionSpeed | null
      velocityPxPerSec: number | null
    }
  }
}

export type FrameflowScrubHandlers = {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
}
