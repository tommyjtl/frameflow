import { getDb } from '../db'
import type { ClipJobRecord, ClipJobStatus } from '../types'

type ClipJobRow = {
  id: string
  source_node_id: string
  output_node_id: string
  source_asset_id: string
  start_frame: number
  end_frame: number
  fps: number
  label: string
  status: ClipJobStatus
  progress: number
  asset_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

function mapClipJobRow(row: ClipJobRow): ClipJobRecord {
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    outputNodeId: row.output_node_id,
    sourceAssetId: row.source_asset_id,
    startFrame: row.start_frame,
    endFrame: row.end_frame,
    fps: row.fps,
    label: row.label,
    status: row.status,
    progress: row.progress,
    assetId: row.asset_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createClipJob(input: {
  id: string
  sourceNodeId: string
  outputNodeId: string
  sourceAssetId: string
  startFrame: number
  endFrame: number
  fps: number
  label: string
}): ClipJobRecord {
  const db = getDb()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO clip_jobs (
      id, source_node_id, output_node_id, source_asset_id,
      start_frame, end_frame, fps, label, status, progress,
      asset_id, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, NULL, NULL, ?, ?)`,
    [
      input.id,
      input.sourceNodeId,
      input.outputNodeId,
      input.sourceAssetId,
      input.startFrame,
      input.endFrame,
      input.fps,
      input.label,
      now,
      now,
    ],
  )

  return getClipJobById(input.id)!
}

export function getClipJobById(jobId: string): ClipJobRecord | null {
  const db = getDb()
  const row = db
    .query('SELECT * FROM clip_jobs WHERE id = ?')
    .get(jobId) as ClipJobRow | null

  return row ? mapClipJobRow(row) : null
}

export function updateClipJob(
  jobId: string,
  patch: {
    status?: ClipJobStatus
    progress?: number
    assetId?: string | null
    errorMessage?: string | null
  },
): ClipJobRecord | null {
  const existing = getClipJobById(jobId)

  if (!existing) {
    return null
  }

  const db = getDb()
  const now = new Date().toISOString()

  db.run(
    `UPDATE clip_jobs SET
      status = ?,
      progress = ?,
      asset_id = ?,
      error_message = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      patch.status ?? existing.status,
      patch.progress ?? existing.progress,
      patch.assetId !== undefined ? patch.assetId : existing.assetId,
      patch.errorMessage !== undefined ? patch.errorMessage : existing.errorMessage,
      now,
      jobId,
    ],
  )

  return getClipJobById(jobId)
}
