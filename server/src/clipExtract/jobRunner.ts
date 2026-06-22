import path from 'node:path'
import { mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { nanoid } from 'nanoid'
import { assetFileName, validateAssetByExtension } from '../assets'
import { ASSETS_DIR } from '../config'
import { findAssetById, insertAssetRecord } from '../routes/board'
import type { ClipCompletePayload } from '../types'
import { createClipJob, getClipJobById, updateClipJob } from './jobStore'
import { ClipTrimError, trimVideoWithFfmpeg } from './ffmpeg'
import { probeMediaDimensions } from '../import/ytdlp'

export type ClipJobEvent =
  | { type: 'progress'; data: { percent: number } }
  | { type: 'complete'; data: ClipCompletePayload }
  | { type: 'error'; data: { message: string } }

type Subscriber = (event: ClipJobEvent) => void

const subscribers = new Map<string, Set<Subscriber>>()
const runningJobs = new Set<string>()
const clipProcessKillers = new Map<string, () => void>()

export function cancelClipJob(jobId: string): boolean {
  const job = getClipJobById(jobId)

  if (!job || job.status === 'complete') {
    return false
  }

  clipProcessKillers.get(jobId)?.()
  clipProcessKillers.delete(jobId)
  runningJobs.delete(jobId)

  if (job.status !== 'error') {
    updateClipJob(jobId, {
      status: 'error',
      errorMessage: 'Clip extraction cancelled.',
    })
  }

  emit(jobId, {
    type: 'error',
    data: { message: 'Clip extraction cancelled.' },
  })

  return true
}

function emit(jobId: string, event: ClipJobEvent): void {
  const jobSubscribers = subscribers.get(jobId)

  if (!jobSubscribers) {
    return
  }

  for (const subscriber of jobSubscribers) {
    subscriber(event)
  }
}

export function subscribeToClipJob(
  jobId: string,
  subscriber: Subscriber,
): () => void {
  let jobSubscribers = subscribers.get(jobId)

  if (!jobSubscribers) {
    jobSubscribers = new Set()
    subscribers.set(jobId, jobSubscribers)
  }

  jobSubscribers.add(subscriber)

  return () => {
    jobSubscribers?.delete(subscriber)
    if (jobSubscribers && jobSubscribers.size === 0) {
      subscribers.delete(jobId)
    }
  }
}

export function createAndStartClipJob(input: {
  jobId: string
  sourceNodeId: string
  outputNodeId: string
  sourceAssetId: string
  startFrame: number
  endFrame: number
  fps: number
  label: string
}): { jobId: string } {
  createClipJob({
    id: input.jobId,
    sourceNodeId: input.sourceNodeId,
    outputNodeId: input.outputNodeId,
    sourceAssetId: input.sourceAssetId,
    startFrame: input.startFrame,
    endFrame: input.endFrame,
    fps: input.fps,
    label: input.label,
  })
  void runClipJob(input.jobId)
  return { jobId: input.jobId }
}

async function buildCompletePayload(
  job: NonNullable<ReturnType<typeof getClipJobById>>,
  asset: NonNullable<ReturnType<typeof findAssetById>>,
): Promise<ClipCompletePayload> {
  const filePath = path.join(ASSETS_DIR, assetFileName(asset.id, asset.extension))
  const dimensions = await probeMediaDimensions(filePath)

  return {
    assetId: asset.id,
    url: asset.url,
    kind: 'video',
    title: job.label,
    naturalWidth: dimensions?.width,
    naturalHeight: dimensions?.height,
    sourceClipStartFrame: job.startFrame,
    sourceClipEndFrame: job.endFrame,
    extractedFromNodeId: job.sourceNodeId,
  }
}

export function ensureClipJobRunning(jobId: string): void {
  const job = getClipJobById(jobId)

  if (!job) {
    return
  }

  if (job.status === 'complete' || job.status === 'error') {
    return
  }

  if (runningJobs.has(jobId)) {
    return
  }

  void runClipJob(jobId)
}

async function runClipJob(jobId: string): Promise<void> {
  if (runningJobs.has(jobId)) {
    return
  }

  const job = getClipJobById(jobId)

  if (!job) {
    return
  }

  if (job.status === 'complete') {
    if (job.assetId) {
      const asset = findAssetById(job.assetId)
      if (asset) {
        emit(jobId, {
          type: 'complete',
          data: await buildCompletePayload(job, asset),
        })
      }
    }
    return
  }

  if (job.status === 'error') {
    emit(jobId, {
      type: 'error',
      data: { message: job.errorMessage ?? 'Clip extraction failed.' },
    })
    return
  }

  // Server restarted mid-job after the asset was already written.
  if (job.status === 'processing' && job.assetId) {
    const asset = findAssetById(job.assetId)

    if (asset) {
      updateClipJob(jobId, { status: 'complete', progress: 100 })
      emit(jobId, {
        type: 'complete',
        data: await buildCompletePayload(job, asset),
      })
      return
    }
  }

  runningJobs.add(jobId)

  const tmpDir = path.join(ASSETS_DIR, '.tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmpOutput = path.join(tmpDir, `${jobId}.mp4`)

  try {
    updateClipJob(jobId, { status: 'processing', progress: 0, errorMessage: null })

    const sourceAsset = findAssetById(job.sourceAssetId)

    if (!sourceAsset) {
      throw new ClipTrimError('Source video asset not found.')
    }

    const inputPath = path.join(
      ASSETS_DIR,
      assetFileName(sourceAsset.id, sourceAsset.extension),
    )

    await trimVideoWithFfmpeg({
      inputPath,
      outputPath: tmpOutput,
      startFrame: job.startFrame,
      endFrame: job.endFrame,
      fps: job.fps,
      onProgress: ({ percent }) => {
        updateClipJob(jobId, { progress: percent })
        emit(jobId, { type: 'progress', data: { percent } })
      },
      onProcess: (kill) => {
        clipProcessKillers.set(jobId, kill)
      },
    })

    clipProcessKillers.delete(jobId)

    const latestJob = getClipJobById(jobId)

    if (!latestJob || latestJob.status === 'error') {
      return
    }

    const validated = validateAssetByExtension(tmpOutput)
    const assetId = nanoid()
    const destination = path.join(
      ASSETS_DIR,
      assetFileName(assetId, validated.extension),
    )

    try {
      unlinkSync(destination)
    } catch {
      // ignore if missing
    }

    renameSync(tmpOutput, destination)

    const dimensions = await probeMediaDimensions(destination)

    const asset = insertAssetRecord({
      id: assetId,
      mimeType: validated.mimeType,
      extension: validated.extension,
      originalName: job.label,
      kind: validated.kind,
      createdAt: new Date().toISOString(),
    })

    updateClipJob(jobId, {
      status: 'complete',
      progress: 100,
      assetId: asset.id,
      errorMessage: null,
    })

    emit(jobId, {
      type: 'complete',
      data: {
        assetId: asset.id,
        url: asset.url,
        kind: asset.kind,
        title: job.label,
        naturalWidth: dimensions?.width,
        naturalHeight: dimensions?.height,
        sourceClipStartFrame: job.startFrame,
        sourceClipEndFrame: job.endFrame,
        extractedFromNodeId: job.sourceNodeId,
      },
    })
  } catch (error) {
    clipProcessKillers.delete(jobId)

    const latestJob = getClipJobById(jobId)

    if (latestJob?.errorMessage === 'Clip extraction cancelled.') {
      return
    }

    const message =
      error instanceof ClipTrimError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Clip extraction failed unexpectedly.'

    updateClipJob(jobId, {
      status: 'error',
      errorMessage: message,
    })

    emit(jobId, {
      type: 'error',
      data: { message },
    })

    try {
      unlinkSync(tmpOutput)
    } catch {
      // ignore cleanup errors
    }
  } finally {
    clipProcessKillers.delete(jobId)
    runningJobs.delete(jobId)
  }
}

export function replayClipJobEvents(jobId: string, subscriber: Subscriber): void {
  const job = getClipJobById(jobId)

  if (!job) {
    return
  }

  if (job.status === 'processing' || job.status === 'queued') {
    subscriber({
      type: 'progress',
      data: { percent: job.progress },
    })
    ensureClipJobRunning(jobId)
    return
  }

  if (job.status === 'complete' && job.assetId) {
    const asset = findAssetById(job.assetId)

    if (!asset) {
      subscriber({
        type: 'error',
        data: { message: 'Extracted clip asset is missing.' },
      })
      return
    }

    void (async () => {
      subscriber({
        type: 'complete',
        data: await buildCompletePayload(job, asset),
      })
    })()
    return
  }

  if (job.status === 'error') {
    subscriber({
      type: 'error',
      data: { message: job.errorMessage ?? 'Clip extraction failed.' },
    })
  }
}
