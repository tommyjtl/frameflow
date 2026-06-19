import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildDebugSnapshot } from './buildDebugSnapshot'
import {
  FPS_FALLBACK,
  FPS_PROBE_SAMPLES,
  MOTION_IDLE_MS,
  POINTER_CLICK_TOLERANCE_PX,
  FRAMEFLOW_SUPPORTED,
  SCRUB_CONFIG,
  SCRUB_FAST_PLAYBACK_RATE,
} from './constants'
import { estimateFpsFromDeltas, fallbackFps } from './fps'
import {
  getDirectionFromVelocity,
  getVelocitySpeed,
  updateMotionSample,
} from './motion'
import {
  clampFastScrubTarget,
  computeTimeBasedScrubTargetFrame,
  getFrameIndexFromMediaTime,
  getNextFrameIndex,
  getScrubInterval,
  getSlowScrubStepFrames,
} from './scrub'
import type {
  DragDirection,
  FpsProbeStatus,
  MotionSample,
  MotionSpeed,
  FrameflowDebugSnapshot,
  FrameflowScrubHandlers,
  PlaybackClickInset,
} from './types'
import { isPlaybackClickAllowed } from './playbackClickInset'

export type FrameCaptureResult = {
  blob: Blob
  frameIndex: number
}

export type FrameflowVideoContextValue = {
  src: string
  setSrc: (src: string) => void
  fpsProbeStatus: FpsProbeStatus
  isPlaying: boolean
  isReady: boolean
  isScrubbing: boolean
  currentFrame: number | null
  totalFrames: number | null
  dragDirection: DragDirection
  dragVelocity: number | null
  velocitySpeed: MotionSpeed | null
  debugSnapshot: FrameflowDebugSnapshot | null
  frameflowSupported: boolean
  togglePlayback: () => void
  seekToFrame: (frame: number) => void
  scrubHandlers: FrameflowScrubHandlers
  registerCanvas: (canvas: HTMLCanvasElement | null) => void
  resetForNewSource: () => void
  captureCurrentFramePng: () => Promise<FrameCaptureResult | null>
  playbackClickInset?: PlaybackClickInset
}

const FrameflowVideoContext = createContext<FrameflowVideoContextValue | null>(null)

export function useFrameflowVideoContext(): FrameflowVideoContextValue {
  const ctx = useContext(FrameflowVideoContext)
  if (!ctx) {
    throw new Error('useFrameflowVideoContext must be used within FrameflowVideoProvider')
  }
  return ctx
}

type FrameflowVideoProviderProps = {
  src: string
  children: ReactNode
  onDebugSnapshot?: (snapshot: FrameflowDebugSnapshot) => void
  /** When set, play/pause clicks must start and end inside this inset. */
  playbackClickInset?: PlaybackClickInset
}

type PointerOrigin = {
  clientX: number
  clientY: number
  localX: number
  localY: number
}

export function FrameflowVideoProvider({
  src: srcProp,
  children,
  onDebugSnapshot,
  playbackClickInset,
}: FrameflowVideoProviderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const callbackIdRef = useRef<number | null>(null)
  const paintCountRef = useRef(0)
  const startTimeRef = useRef(0)
  const motionSampleRef = useRef<MotionSample | null>(null)
  const pointerOriginRef = useRef<PointerOrigin | null>(null)
  const pointerExceededToleranceRef = useRef(false)
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const videoFpsRef = useRef<number | null>(null)
  const totalFramesRef = useRef(0)
  const frameIndexRef = useRef(0)
  const isScrubbingRef = useRef(false)
  const scrubDirectionRef = useRef<DragDirection>('neutral')
  const scrubTierRef = useRef<MotionSpeed>('slow')
  const lastSeekedAtRef = useRef(0)
  const deferredScrubStepRef = useRef(false)
  const pendingScrubFrameRef = useRef<number | null>(null)
  const scrubChainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fastScrubAnchorFrameRef = useRef(0)
  const fastScrubAnchorWallTimeRef = useRef(0)
  const lastFastScrubDirectionRef = useRef<DragDirection>('neutral')
  const lastScrubPresentedFrameRef = useRef<number | null>(null)
  const scrubPresentedTimestampsRef = useRef<number[]>([])
  const wasPlayingBeforeScrubRef = useRef(false)
  const isProbingFpsRef = useRef(false)
  const fpsProbeDeltasRef = useRef<number[]>([])
  const lastProbeMediaTimeRef = useRef<number | null>(null)
  const frameLoopStartedRef = useRef(false)

  const [src, setSrcState] = useState(srcProp)
  const [fps, setFps] = useState('0')
  const [frameCallbackMetadata, setFrameCallbackMetadata] =
    useState<VideoFrameCallbackMetadata | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [dragDirection, setDragDirection] = useState<DragDirection>('neutral')
  const [dragVelocity, setDragVelocity] = useState<number | null>(null)
  const [currentFrame, setCurrentFrame] = useState<number | null>(null)
  const [totalFrames, setTotalFrames] = useState<number | null>(null)
  const [probedVideoFps, setProbedVideoFps] = useState<number | null>(null)
  const [fpsProbeStatus, setFpsProbeStatus] =
    useState<FpsProbeStatus>('pending')
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubThroughput, setScrubThroughput] = useState<string | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)

  useEffect(() => {
    setSrcState(srcProp)
  }, [srcProp])

  const setSrc = useCallback((next: string) => {
    setSrcState(next)
  }, [])

  const paintCurrentFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }, [])

  const registerCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas
      setCanvasReady(canvas !== null)
      if (canvas && videoRef.current?.videoWidth) {
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        paintCurrentFrame()
      }
    },
    [paintCurrentFrame],
  )

  const updateScrubThroughput = useCallback(() => {
    const now = performance.now()
    scrubPresentedTimestampsRef.current =
      scrubPresentedTimestampsRef.current.filter((t) => now - t < 1000)
    const rate = scrubPresentedTimestampsRef.current.length
    setScrubThroughput(rate > 0 ? rate.toFixed(1) : '0')
  }, [])

  const resetScrubThroughput = useCallback(() => {
    lastScrubPresentedFrameRef.current = null
    scrubPresentedTimestampsRef.current = []
    setScrubThroughput(null)
  }, [])

  const stopCallback = useCallback(() => {
    const video = videoRef.current
    if (video && callbackIdRef.current !== null) {
      video.cancelVideoFrameCallback(callbackIdRef.current)
      callbackIdRef.current = null
    }
  }, [])

  const applyVideoFps = useCallback((fpsValue: number) => {
    const video = videoRef.current
    if (!video) return

    videoFpsRef.current = fpsValue
    setProbedVideoFps(fpsValue)
    const frames = Math.max(1, Math.floor(video.duration * fpsValue))
    totalFramesRef.current = frames
    setTotalFrames(frames)
    setFpsProbeStatus('ready')

    const frame = Math.round(video.currentTime * fpsValue)
    frameIndexRef.current = frame
    setCurrentFrame(frame)
  }, [])

  const completeFpsProbe = useCallback(
    (deltas: number[]) => {
      const video = videoRef.current
      if (!video || !isProbingFpsRef.current) return

      isProbingFpsRef.current = false
      fpsProbeDeltasRef.current = []
      lastProbeMediaTimeRef.current = null

      const measured =
        deltas.length >= 3 ? estimateFpsFromDeltas(deltas) : fallbackFps(video)

      video.pause()
      video.currentTime = 0
      applyVideoFps(measured)
    },
    [applyVideoFps],
  )

  const clearScrubChainTimer = useCallback(() => {
    if (scrubChainTimerRef.current !== null) {
      clearTimeout(scrubChainTimerRef.current)
      scrubChainTimerRef.current = null
    }
  }, [])

  const resetFastScrubAnchor = useCallback(() => {
    fastScrubAnchorFrameRef.current = frameIndexRef.current
    fastScrubAnchorWallTimeRef.current = performance.now()
  }, [])

  const syncFastScrubAnchor = useCallback(
    (direction: DragDirection) => {
      if (direction !== lastFastScrubDirectionRef.current) {
        resetFastScrubAnchor()
        lastFastScrubDirectionRef.current = direction
      }
    },
    [resetFastScrubAnchor],
  )

  const getFastScrubTargetFrame = useCallback(
    (direction: 'left' | 'right', videoFps: number): number => {
      return computeTimeBasedScrubTargetFrame(
        fastScrubAnchorFrameRef.current,
        fastScrubAnchorWallTimeRef.current,
        direction,
        SCRUB_FAST_PLAYBACK_RATE,
        videoFps,
        totalFramesRef.current,
      )
    },
    [],
  )

  const seekToFrame = useCallback(
    (video: HTMLVideoElement, videoFps: number, frame: number) => {
      video.currentTime = frame / videoFps
    },
    [],
  )

  const seekToFrameByIndex = useCallback((frame: number) => {
    const video = videoRef.current
    const videoFps = videoFpsRef.current
    if (!video || !videoFps || totalFramesRef.current <= 0) {
      return
    }

    const clamped = Math.max(
      0,
      Math.min(frame, totalFramesRef.current - 1),
    )
    seekToFrame(video, videoFps, clamped)
  }, [seekToFrame])

  const scheduleNextScrubStep = useCallback(
    (delayMs?: number) => {
      clearScrubChainTimer()
      const tier = scrubTierRef.current
      const fps = videoFpsRef.current ?? FPS_FALLBACK
      const delay = delayMs ?? getScrubInterval(tier, fps)

      scrubChainTimerRef.current = setTimeout(() => {
        scrubChainTimerRef.current = null
        attemptScrubStepRef.current()
      }, delay)
    },
    [clearScrubChainTimer],
  )

  const attemptScrubStepRef = useRef<() => void>(() => {})

  const attemptScrubStep = useCallback(() => {
    if (!isScrubbingRef.current || videoFpsRef.current === null) {
      return
    }

    const direction = scrubDirectionRef.current
    if (direction !== 'left' && direction !== 'right') {
      return
    }

    const video = videoRef.current
    if (!video) {
      return
    }

    const videoFps = videoFpsRef.current
    const tier = scrubTierRef.current

    if (tier === 'fast' && SCRUB_CONFIG.fastTierTimeBased) {
      syncFastScrubAnchor(direction)
      const rawTarget = getFastScrubTargetFrame(direction, videoFps)
      const current = getFrameIndexFromMediaTime(video.currentTime, videoFps)
      const target = clampFastScrubTarget(current, rawTarget, direction, videoFps)

      if (video.seeking) {
        pendingScrubFrameRef.current = target
        scheduleNextScrubStep(getScrubInterval('fast', videoFps))
        return
      }

      if (target === current) {
        scheduleNextScrubStep(getScrubInterval('fast', videoFps))
        return
      }

      pendingScrubFrameRef.current = null
      seekToFrame(video, videoFps, target)
      return
    }

    if (video.seeking) {
      deferredScrubStepRef.current = true
      return
    }

    const interval = getScrubInterval('slow', videoFps)
    const elapsed = performance.now() - lastSeekedAtRef.current
    if (lastSeekedAtRef.current > 0 && elapsed < interval) {
      scheduleNextScrubStep(interval - elapsed)
      return
    }

    pendingScrubFrameRef.current = null
    const current = getFrameIndexFromMediaTime(video.currentTime, videoFps)
    const step = getSlowScrubStepFrames(videoFps)
    const next = getNextFrameIndex(
      current,
      direction,
      totalFramesRef.current,
      step,
    )

    if (next === current) {
      return
    }

    seekToFrame(video, videoFps, next)
  }, [
    getFastScrubTargetFrame,
    scheduleNextScrubStep,
    seekToFrame,
    syncFastScrubAnchor,
  ])

  attemptScrubStepRef.current = attemptScrubStep

  const handleVideoSeeked = useCallback(() => {
    lastSeekedAtRef.current = performance.now()

    const video = videoRef.current
    const videoFps = videoFpsRef.current
    if (!video || !videoFps) {
      return
    }

    const direction = scrubDirectionRef.current
    const isDirectional = direction === 'left' || direction === 'right'

    if (
      SCRUB_CONFIG.fastTierTimeBased &&
      scrubTierRef.current === 'fast' &&
      isScrubbingRef.current &&
      isDirectional
    ) {
      const current = getFrameIndexFromMediaTime(video.currentTime, videoFps)
      const rawTarget =
        pendingScrubFrameRef.current ??
        getFastScrubTargetFrame(direction, videoFps)
      pendingScrubFrameRef.current = null
      const target = clampFastScrubTarget(current, rawTarget, direction, videoFps)

      if (target !== current) {
        seekToFrame(video, videoFps, target)
        return
      }

      scheduleNextScrubStep(getScrubInterval('fast', videoFps))
      return
    }

    if (deferredScrubStepRef.current) {
      deferredScrubStepRef.current = false
      scheduleNextScrubStep()
      return
    }

    if (isScrubbingRef.current && isDirectional) {
      scheduleNextScrubStep()
    }
  }, [getFastScrubTargetFrame, scheduleNextScrubStep, seekToFrame])

  const startFramePaintLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !FRAMEFLOW_SUPPORTED || frameLoopStartedRef.current) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    frameLoopStartedRef.current = true
    stopCallback()
    paintCountRef.current = 0
    startTimeRef.current = 0

    const updateCanvas = (
      now: DOMHighResTimeStamp,
      frameMetadata: VideoFrameCallbackMetadata,
    ) => {
      if (isProbingFpsRef.current) {
        if (lastProbeMediaTimeRef.current !== null) {
          const delta =
            frameMetadata.mediaTime - lastProbeMediaTimeRef.current
          if (delta > 0) {
            fpsProbeDeltasRef.current.push(delta)
          }
        }
        lastProbeMediaTimeRef.current = frameMetadata.mediaTime

        if (fpsProbeDeltasRef.current.length >= FPS_PROBE_SAMPLES) {
          completeFpsProbe([...fpsProbeDeltasRef.current])
        }
      }

      if (videoFpsRef.current !== null) {
        const frame = getFrameIndexFromMediaTime(
          frameMetadata.mediaTime,
          videoFpsRef.current,
        )
        frameIndexRef.current = frame
        setCurrentFrame(frame)

        if (
          isScrubbingRef.current &&
          frame !== lastScrubPresentedFrameRef.current
        ) {
          lastScrubPresentedFrameRef.current = frame
          scrubPresentedTimestampsRef.current.push(performance.now())
          updateScrubThroughput()
        }
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      if (!video.paused) {
        if (startTimeRef.current === 0) {
          startTimeRef.current = now
        }

        const elapsed = (now - startTimeRef.current) / 1000
        paintCountRef.current += 1
        const measuredFps = paintCountRef.current / elapsed
        setFps(Number.isFinite(measuredFps) ? measuredFps.toFixed(3) : '0')
      }

      setFrameCallbackMetadata(frameMetadata)
      callbackIdRef.current = video.requestVideoFrameCallback(updateCanvas)
    }

    callbackIdRef.current = video.requestVideoFrameCallback(updateCanvas)
  }, [completeFpsProbe, stopCallback, updateScrubThroughput])

  const startFpsProbe = useCallback(async () => {
    const video = videoRef.current
    if (!video || videoFpsRef.current !== null || isProbingFpsRef.current) {
      return
    }

    isProbingFpsRef.current = true
    fpsProbeDeltasRef.current = []
    lastProbeMediaTimeRef.current = null
    setFpsProbeStatus('probing')

    video.muted = true
    startFramePaintLoop()

    try {
      await video.play()
    } catch {
      isProbingFpsRef.current = false
      applyVideoFps(fallbackFps(video))
      setFpsProbeStatus('needs-play')
      video.pause()
    }
  }, [applyVideoFps, startFramePaintLoop])

  const togglePlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }, [])

  const clearMotionIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
  }, [])

  const clearDragMetrics = useCallback(() => {
    scrubDirectionRef.current = 'neutral'
    setDragDirection('neutral')
    setDragVelocity(null)
    clearScrubChainTimer()
    deferredScrubStepRef.current = false
    pendingScrubFrameRef.current = null
    lastFastScrubDirectionRef.current = 'neutral'
  }, [clearScrubChainTimer])

  const resetForNewSource = useCallback(() => {
    stopCallback()
    clearMotionIdleTimeout()
    clearScrubChainTimer()
    clearDragMetrics()

    frameLoopStartedRef.current = false
    paintCountRef.current = 0
    startTimeRef.current = 0
    videoFpsRef.current = null
    totalFramesRef.current = 0
    frameIndexRef.current = 0
    isScrubbingRef.current = false
    scrubTierRef.current = 'slow'
    lastSeekedAtRef.current = 0
    deferredScrubStepRef.current = false
    pendingScrubFrameRef.current = null
    lastFastScrubDirectionRef.current = 'neutral'
    lastScrubPresentedFrameRef.current = null
    scrubPresentedTimestampsRef.current = []
    wasPlayingBeforeScrubRef.current = false
    isProbingFpsRef.current = false
    fpsProbeDeltasRef.current = []
    lastProbeMediaTimeRef.current = null
    motionSampleRef.current = null
    pointerOriginRef.current = null
    pointerExceededToleranceRef.current = false

    setFps('0')
    setFrameCallbackMetadata(null)
    setIsPlaying(false)
    setCurrentFrame(null)
    setTotalFrames(null)
    setProbedVideoFps(null)
    setFpsProbeStatus('pending')
    setIsScrubbing(false)
    setScrubThroughput(null)
  }, [
    clearDragMetrics,
    clearMotionIdleTimeout,
    clearScrubChainTimer,
    stopCallback,
  ])

  const resetMotionMetrics = useCallback(() => {
    clearDragMetrics()
    const sample = motionSampleRef.current
    if (sample) {
      motionSampleRef.current = { ...sample, t: performance.now() }
    }
  }, [clearDragMetrics])

  const scheduleMotionIdleReset = useCallback(() => {
    clearMotionIdleTimeout()
    idleTimeoutRef.current = setTimeout(() => {
      idleTimeoutRef.current = null
      resetMotionMetrics()
    }, MOTION_IDLE_MS)
  }, [clearMotionIdleTimeout, resetMotionMetrics])

  const beginScrubSession = useCallback(
    (clientX: number) => {
      const video = videoRef.current
      if (!video || videoFpsRef.current === null || !video.paused) {
        return
      }

      clearMotionIdleTimeout()
      clearScrubChainTimer()
      deferredScrubStepRef.current = false
      pendingScrubFrameRef.current = null
      lastFastScrubDirectionRef.current = 'neutral'
      resetScrubThroughput()

      wasPlayingBeforeScrubRef.current = !video.paused
      isScrubbingRef.current = true
      setIsScrubbing(true)
      resetFastScrubAnchor()

      motionSampleRef.current = {
        x: clientX,
        t: performance.now(),
      }
      clearDragMetrics()
    },
    [
      clearMotionIdleTimeout,
      clearDragMetrics,
      clearScrubChainTimer,
      resetFastScrubAnchor,
      resetScrubThroughput,
    ],
  )

  const maybeStartScrubFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const origin = pointerOriginRef.current
      if (!origin || pointerExceededToleranceRef.current) {
        return
      }

      const dx = Math.abs(clientX - origin.clientX)
      const dy = Math.abs(clientY - origin.clientY)
      if (
        dx <= POINTER_CLICK_TOLERANCE_PX &&
        dy <= POINTER_CLICK_TOLERANCE_PX
      ) {
        return
      }

      pointerExceededToleranceRef.current = true
      beginScrubSession(clientX)
    },
    [beginScrubSession],
  )

  const handleOverlayPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const video = videoRef.current
      if (!video || videoFpsRef.current === null) {
        return
      }

      event.currentTarget.setPointerCapture(event.pointerId)
      const rect = event.currentTarget.getBoundingClientRect()
      pointerOriginRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        localX: event.clientX - rect.left,
        localY: event.clientY - rect.top,
      }
      pointerExceededToleranceRef.current = false
      motionSampleRef.current = null
      clearMotionIdleTimeout()
    },
    [clearMotionIdleTimeout],
  )

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !pointerOriginRef.current ||
        !event.currentTarget.hasPointerCapture(event.pointerId) ||
        videoFpsRef.current === null
      ) {
        return
      }

      maybeStartScrubFromPointer(event.clientX, event.clientY)

      if (!isScrubbingRef.current || !motionSampleRef.current) {
        return
      }

      const { sample, velocity } = updateMotionSample(
        motionSampleRef.current,
        event.clientX,
        performance.now(),
      )
      motionSampleRef.current = sample

      if (velocity !== null) {
        const direction = getDirectionFromVelocity(velocity)
        const tier = getVelocitySpeed(velocity)

        setDragVelocity(velocity)
        setDragDirection(direction)
        scrubDirectionRef.current = direction
        scrubTierRef.current = tier

        if (tier === 'fast' && (direction === 'left' || direction === 'right')) {
          syncFastScrubAnchor(direction)
        } else if (tier === 'slow') {
          lastFastScrubDirectionRef.current = 'neutral'
        }

        if (direction === 'left' || direction === 'right') {
          attemptScrubStepRef.current()
        }
      }

      scheduleMotionIdleReset()
    },
    [maybeStartScrubFromPointer, scheduleMotionIdleReset, syncFastScrubAnchor],
  )

  const handleOverlayPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const wasScrubbing = isScrubbingRef.current
      const exceededTolerance = pointerExceededToleranceRef.current
      const pointerOrigin = pointerOriginRef.current

      clearMotionIdleTimeout()
      clearScrubChainTimer()
      deferredScrubStepRef.current = false
      pendingScrubFrameRef.current = null
      isScrubbingRef.current = false
      setIsScrubbing(false)
      resetScrubThroughput()
      motionSampleRef.current = null
      clearDragMetrics()
      pointerOriginRef.current = null
      pointerExceededToleranceRef.current = false

      if (!exceededTolerance) {
        const rect = event.currentTarget.getBoundingClientRect()
        const canTogglePlayback =
          pointerOrigin &&
          isPlaybackClickAllowed(
            pointerOrigin,
            {
              localX: event.clientX - rect.left,
              localY: event.clientY - rect.top,
            },
            rect.width,
            rect.height,
            playbackClickInset,
          )

        if (canTogglePlayback) {
          togglePlayback()
        }
      } else if (
        wasScrubbing &&
        SCRUB_CONFIG.resumeAfterScrub &&
        wasPlayingBeforeScrubRef.current
      ) {
        const video = videoRef.current
        if (video) {
          void video.play()
        }
      }
    },
    [
      clearMotionIdleTimeout,
      clearDragMetrics,
      clearScrubChainTimer,
      resetScrubThroughput,
      togglePlayback,
      playbackClickInset,
    ],
  )

  const scrubHandlers = useMemo(
    (): FrameflowScrubHandlers => ({
      onPointerDown: handleOverlayPointerDown,
      onPointerMove: handleOverlayPointerMove,
      onPointerUp: handleOverlayPointerUp,
    }),
    [
      handleOverlayPointerDown,
      handleOverlayPointerMove,
      handleOverlayPointerUp,
    ],
  )

  useEffect(() => {
    return () => {
      clearMotionIdleTimeout()
      clearScrubChainTimer()
      stopCallback()
    }
  }, [clearMotionIdleTimeout, clearScrubChainTimer, stopCallback])

  useEffect(() => {
    if (!canvasReady || !videoRef.current) {
      return
    }

    startFramePaintLoop()

    if (
      videoFpsRef.current === null &&
      !isProbingFpsRef.current &&
      videoRef.current.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      void startFpsProbe()
    }
  }, [canvasReady, src, startFramePaintLoop, startFpsProbe])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    resetForNewSource()

    const handlePlay = () => {
      setIsPlaying(true)
      startTimeRef.current = 0
      paintCountRef.current = 0
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleLoadedMetadata = () => {
      const canvas = canvasRef.current
      if (!canvas || !video.videoWidth) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      paintCurrentFrame()
    }

    const handleCanPlay = () => {
      startFramePaintLoop()
      if (videoFpsRef.current === null && !isProbingFpsRef.current) {
        void startFpsProbe()
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('seeked', handleVideoSeeked)

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      handleCanPlay()
    }

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('seeked', handleVideoSeeked)
    }
  }, [
    src,
    handleVideoSeeked,
    startFpsProbe,
    startFramePaintLoop,
    resetForNewSource,
    paintCurrentFrame,
  ])

  const velocitySpeed =
    dragVelocity === null ? null : getVelocitySpeed(dragVelocity)

  const debugSnapshot = useMemo((): FrameflowDebugSnapshot | null => {
    if (!frameCallbackMetadata) {
      return null
    }

    return buildDebugSnapshot({
      frameCallbackMetadata,
      fps,
      currentFrame,
      totalFrames,
      probedVideoFps,
      fpsProbeStatus,
      isPlaying,
      isScrubbing,
      scrubThroughput,
      dragDirection,
      velocitySpeed,
      dragVelocity,
    })
  }, [
    frameCallbackMetadata,
    fps,
    currentFrame,
    totalFrames,
    probedVideoFps,
    fpsProbeStatus,
    isPlaying,
    isScrubbing,
    scrubThroughput,
    dragDirection,
    velocitySpeed,
    dragVelocity,
  ])

  useEffect(() => {
    if (debugSnapshot && onDebugSnapshot) {
      onDebugSnapshot(debugSnapshot)
    }
  }, [debugSnapshot, onDebugSnapshot])

  const isReady = probedVideoFps !== null

  const captureCurrentFramePng = useCallback(async (): Promise<FrameCaptureResult | null> => {
    const video = videoRef.current

    if (
      !video ||
      videoFpsRef.current === null ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return null
    }

    const width = video.videoWidth
    const height = video.videoHeight

    if (width <= 0 || height <= 0) {
      return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      return null
    }

    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png')
    })

    if (!blob) {
      return null
    }

    return {
      blob,
      frameIndex: frameIndexRef.current,
    }
  }, [])

  const value = useMemo(
    (): FrameflowVideoContextValue => ({
      src,
      setSrc,
      fpsProbeStatus,
      isPlaying,
      isReady,
      isScrubbing,
      currentFrame,
      totalFrames,
      dragDirection,
      dragVelocity,
      velocitySpeed,
      debugSnapshot,
      frameflowSupported: FRAMEFLOW_SUPPORTED,
      togglePlayback,
      seekToFrame: seekToFrameByIndex,
      scrubHandlers,
      registerCanvas,
      resetForNewSource,
      captureCurrentFramePng,
      playbackClickInset,
    }),
    [
      src,
      setSrc,
      fpsProbeStatus,
      isPlaying,
      isReady,
      isScrubbing,
      currentFrame,
      totalFrames,
      dragDirection,
      dragVelocity,
      velocitySpeed,
      debugSnapshot,
      togglePlayback,
      seekToFrameByIndex,
      scrubHandlers,
      registerCanvas,
      resetForNewSource,
      captureCurrentFramePng,
      playbackClickInset,
    ],
  )

  return (
    <FrameflowVideoContext.Provider value={value}>
      <video
        ref={videoRef}
        src={src}
        hidden
        muted
        playsInline
        preload="auto"
        aria-hidden
      />
      {children}
    </FrameflowVideoContext.Provider>
  )
}

export function useFrameflowDebugSnapshot(): FrameflowDebugSnapshot | null {
  return useFrameflowVideoContext().debugSnapshot
}
