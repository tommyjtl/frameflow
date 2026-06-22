import { nanoid } from 'nanoid'
import type { ClipJobRecord } from '../types'
import {
  createAndStartClipJob,
  cancelClipJob,
  ensureClipJobRunning,
  replayClipJobEvents,
  subscribeToClipJob,
  type ClipJobEvent,
} from '../clipExtract/jobRunner'
import { getClipJobById } from '../clipExtract/jobStore'

class ClipExtractValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClipExtractValidationError'
  }
}

function serializeJob(job: ClipJobRecord) {
  return {
    id: job.id,
    sourceNodeId: job.sourceNodeId,
    outputNodeId: job.outputNodeId,
    sourceAssetId: job.sourceAssetId,
    startFrame: job.startFrame,
    endFrame: job.endFrame,
    fps: job.fps,
    label: job.label,
    status: job.status,
    progress: job.progress,
    assetId: job.assetId,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

function serializeEvent(event: ClipJobEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}

function validateStartClipExtract(body: {
  sourceNodeId?: string
  outputNodeId?: string
  sourceAssetId?: string
  startFrame?: number
  endFrame?: number
  fps?: number
  label?: string
}): {
  sourceNodeId: string
  outputNodeId: string
  sourceAssetId: string
  startFrame: number
  endFrame: number
  fps: number
  label: string
} {
  const {
    sourceNodeId,
    outputNodeId,
    sourceAssetId,
    startFrame,
    endFrame,
    fps,
    label,
  } = body

  if (
    !sourceNodeId ||
    !outputNodeId ||
    !sourceAssetId ||
    startFrame == null ||
    endFrame == null ||
    fps == null ||
    !label?.trim()
  ) {
    throw new ClipExtractValidationError(
      'sourceNodeId, outputNodeId, sourceAssetId, startFrame, endFrame, fps, and label are required.',
    )
  }

  if (
    !Number.isFinite(startFrame) ||
    !Number.isFinite(endFrame) ||
    !Number.isFinite(fps)
  ) {
    throw new ClipExtractValidationError('Invalid clip frame range or frame rate.')
  }

  const start = Math.floor(startFrame)
  const end = Math.floor(endFrame)

  if (start < 0 || end < start || end - start + 1 < 2) {
    throw new ClipExtractValidationError('Clip must span at least 2 frames.')
  }

  if (fps <= 0) {
    throw new ClipExtractValidationError('Invalid video frame rate.')
  }

  return {
    sourceNodeId,
    outputNodeId,
    sourceAssetId,
    startFrame: start,
    endFrame: end,
    fps,
    label: label.trim(),
  }
}

export async function handleStartClipExtract(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Parameters<typeof validateStartClipExtract>[0]
    const input = validateStartClipExtract(body)

    const result = createAndStartClipJob({
      jobId: nanoid(),
      ...input,
    })

    return Response.json(result)
  } catch (error) {
    if (error instanceof ClipExtractValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error(error)
    return Response.json({ error: 'Failed to start clip extraction.' }, { status: 500 })
  }
}

export function handleGetClipJob(jobId: string): Response {
  const job = getClipJobById(jobId)

  if (!job) {
    return Response.json({ error: 'Clip job not found.' }, { status: 404 })
  }

  return Response.json(serializeJob(job))
}

export function handleCancelClipJob(jobId: string): Response {
  const job = getClipJobById(jobId)

  if (!job) {
    return Response.json({ error: 'Clip job not found.' }, { status: 404 })
  }

  if (job.status === 'complete') {
    return Response.json({ error: 'Clip job already completed.' }, { status: 409 })
  }

  cancelClipJob(jobId)
  return Response.json({ ok: true })
}

export function handleClipJobStream(jobId: string): Response {
  const job = getClipJobById(jobId)

  if (!job) {
    return Response.json({ error: 'Clip job not found.' }, { status: 404 })
  }

  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: ClipJobEvent) => {
        controller.enqueue(encoder.encode(serializeEvent(event)))
      }

      replayClipJobEvents(jobId, send)

      unsubscribe = subscribeToClipJob(jobId, send)

      if (job.status === 'processing' || job.status === 'queued') {
        ensureClipJobRunning(jobId)
      }
    },
    cancel() {
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
