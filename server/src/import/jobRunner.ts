import path from 'node:path'
import { readdirSync, renameSync, unlinkSync } from 'node:fs'
import { nanoid } from 'nanoid'
import { assetFileName, validateAssetByExtension } from '../assets'
import { ASSETS_DIR } from '../config'
import { findAssetById, insertAssetRecord } from '../routes/board'
import type { ImportCompletePayload, ImportPlatform } from '../types'
import { createImportJob, getImportJobById, updateImportJob } from './jobStore'
import {
  downloadWithYtdlp,
  fetchYtdlpTitle,
  formatImportError,
  IMPORT_TMP_DIR,
  probeMediaDimensions,
} from './ytdlp'
import { validateImportUrl } from './urlValidation'

export type ImportJobEvent =
  | { type: 'metadata'; data: { title: string | null; platform: ImportPlatform } }
  | { type: 'progress'; data: { percent: number; title: string | null } }
  | { type: 'complete'; data: ImportCompletePayload }
  | { type: 'error'; data: { message: string } }

type Subscriber = (event: ImportJobEvent) => void

const subscribers = new Map<string, Set<Subscriber>>()
const runningJobs = new Set<string>()

function emit(jobId: string, event: ImportJobEvent): void {
  const jobSubscribers = subscribers.get(jobId)

  if (!jobSubscribers) {
    return
  }

  for (const subscriber of jobSubscribers) {
    subscriber(event)
  }
}

export function subscribeToImportJob(
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

export function createAndStartImportJob(input: {
  jobId: string
  nodeId: string
  url: string
}): {
  jobId: string
  platform: ImportPlatform
  title: string | null
} {
  const { url, platform } = validateImportUrl(input.url)
  const job = createImportJob({
    id: input.jobId,
    nodeId: input.nodeId,
    sourceUrl: url,
    platform,
  })

  void runImportJob(job.id)

  return {
    jobId: job.id,
    platform: job.platform,
    title: job.title,
  }
}

async function buildCompletePayload(
  job: NonNullable<ReturnType<typeof getImportJobById>>,
  asset: NonNullable<ReturnType<typeof findAssetById>>,
): Promise<ImportCompletePayload> {
  const filePath = path.join(ASSETS_DIR, assetFileName(asset.id, asset.extension))
  const dimensions = await probeMediaDimensions(filePath)

  return {
    assetId: asset.id,
    url: asset.url,
    kind: asset.kind,
    title: job.title ?? asset.originalName ?? 'Imported media',
    naturalWidth: dimensions?.width,
    naturalHeight: dimensions?.height,
  }
}

export function ensureImportJobRunning(jobId: string): void {
  const job = getImportJobById(jobId)

  if (!job) {
    return
  }

  if (job.status === 'complete' || job.status === 'error') {
    return
  }

  if (runningJobs.has(jobId)) {
    return
  }

  void runImportJob(jobId)
}

async function runImportJob(jobId: string): Promise<void> {
  if (runningJobs.has(jobId)) {
    return
  }

  const job = getImportJobById(jobId)

  if (!job) {
    return
  }

  if (job.status === 'complete') {
    if (job.assetId) {
      const asset = findAssetById(job.assetId)
      if (asset) {
        const payload = await buildCompletePayload(job, asset)
        emit(jobId, {
          type: 'complete',
          data: payload,
        })
      }
    }
    return
  }

  if (job.status === 'error') {
    emit(jobId, {
      type: 'error',
      data: { message: job.errorMessage ?? 'Import failed.' },
    })
    return
  }

  runningJobs.add(jobId)

  try {
    updateImportJob(jobId, { status: 'downloading', progress: 0, errorMessage: null })

    let title = job.title

    if (!title) {
      title = await fetchYtdlpTitle(job.sourceUrl)
      updateImportJob(jobId, { title })
    }

    emit(jobId, {
      type: 'metadata',
      data: { title, platform: job.platform },
    })

    const download = await downloadWithYtdlp(
      job.sourceUrl,
      jobId,
      ({ percent }) => {
        updateImportJob(jobId, { progress: percent, title })
        emit(jobId, {
          type: 'progress',
          data: { percent, title },
        })
      },
    )

    const validated = validateAssetByExtension(download.filePath)
    const assetId = nanoid()
    const destination = path.join(
      ASSETS_DIR,
      assetFileName(assetId, validated.extension),
    )

    renameSync(download.filePath, destination)

    const dimensions = await probeMediaDimensions(destination)

    const asset = insertAssetRecord({
      id: assetId,
      mimeType: validated.mimeType,
      extension: validated.extension,
      originalName: title,
      kind: validated.kind,
      createdAt: new Date().toISOString(),
    })

    updateImportJob(jobId, {
      status: 'complete',
      progress: 100,
      title,
      assetId: asset.id,
      errorMessage: null,
    })

    emit(jobId, {
      type: 'complete',
      data: {
        assetId: asset.id,
        url: asset.url,
        kind: asset.kind,
        title: title ?? asset.originalName ?? 'Imported media',
        naturalWidth: dimensions?.width,
        naturalHeight: dimensions?.height,
      },
    })
  } catch (error) {
    const message = formatImportError(
      error instanceof Error ? error.message : 'Import failed unexpectedly.',
    )

    updateImportJob(jobId, {
      status: 'error',
      errorMessage: message,
    })

    emit(jobId, {
      type: 'error',
      data: { message },
    })
  } finally {
    runningJobs.delete(jobId)
    try {
      for (const file of readdirSync(IMPORT_TMP_DIR)) {
        if (file.startsWith(`${jobId}.`)) {
          unlinkSync(path.join(IMPORT_TMP_DIR, file))
        }
      }
    } catch {
      // ignore temp cleanup errors
    }
  }
}

export function replayImportJobEvents(jobId: string, subscriber: Subscriber): void {
  const job = getImportJobById(jobId)

  if (!job) {
    return
  }

  subscriber({
    type: 'metadata',
    data: { title: job.title, platform: job.platform },
  })

  if (job.status === 'downloading' || job.status === 'queued') {
    subscriber({
      type: 'progress',
      data: { percent: job.progress, title: job.title },
    })
    ensureImportJobRunning(jobId)
    return
  }

  if (job.status === 'complete' && job.assetId) {
    const asset = findAssetById(job.assetId)

    if (!asset) {
      subscriber({
        type: 'error',
        data: { message: 'Imported asset is missing.' },
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
      data: { message: job.errorMessage ?? 'Import failed.' },
    })
  }
}
