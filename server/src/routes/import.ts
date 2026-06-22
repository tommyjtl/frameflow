import { nanoid } from 'nanoid'
import type { ImportJobRecord } from '../types'
import {
  createAndStartImportJob,
  ensureImportJobRunning,
  replayImportJobEvents,
  subscribeToImportJob,
  type ImportJobEvent,
} from '../import/jobRunner'
import { getImportJobById } from '../import/jobStore'
import { ImportUrlValidationError } from '../import/urlValidation'

function serializeJob(job: ImportJobRecord) {
  return {
    id: job.id,
    nodeId: job.nodeId,
    sourceUrl: job.sourceUrl,
    platform: job.platform,
    status: job.status,
    progress: job.progress,
    title: job.title,
    assetId: job.assetId,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

function serializeEvent(event: ImportJobEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}

export async function handleStartImportUrl(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { url?: string; nodeId?: string }

    if (!body?.url || !body?.nodeId) {
      return Response.json(
        { error: 'url and nodeId are required.' },
        { status: 400 },
      )
    }

    const result = createAndStartImportJob({
      jobId: nanoid(),
      nodeId: body.nodeId,
      url: body.url,
    })

    return Response.json(result)
  } catch (error) {
    if (error instanceof ImportUrlValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error(error)
    return Response.json({ error: 'Failed to start import.' }, { status: 500 })
  }
}

export function handleGetImportJob(jobId: string): Response {
  const job = getImportJobById(jobId)

  if (!job) {
    return Response.json({ error: 'Import job not found.' }, { status: 404 })
  }

  return Response.json(serializeJob(job))
}

export function handleImportJobStream(jobId: string): Response {
  const job = getImportJobById(jobId)

  if (!job) {
    return Response.json({ error: 'Import job not found.' }, { status: 404 })
  }

  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: ImportJobEvent) => {
        controller.enqueue(encoder.encode(serializeEvent(event)))
      }

      replayImportJobEvents(jobId, send)

      unsubscribe = subscribeToImportJob(jobId, send)

      if (job.status === 'downloading' || job.status === 'queued') {
        ensureImportJobRunning(jobId)
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
