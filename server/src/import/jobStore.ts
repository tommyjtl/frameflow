import { getDb } from '../db'
import type {
  ImportJobRecord,
  ImportJobStatus,
  ImportPlatform,
} from '../types'

type ImportJobRow = {
  id: string
  node_id: string
  source_url: string
  platform: ImportPlatform
  status: ImportJobStatus
  progress: number
  title: string | null
  asset_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

function mapImportJobRow(row: ImportJobRow): ImportJobRecord {
  return {
    id: row.id,
    nodeId: row.node_id,
    sourceUrl: row.source_url,
    platform: row.platform,
    status: row.status,
    progress: row.progress,
    title: row.title,
    assetId: row.asset_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createImportJob(input: {
  id: string
  nodeId: string
  sourceUrl: string
  platform: ImportPlatform
}): ImportJobRecord {
  const db = getDb()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO import_jobs (
      id, node_id, source_url, platform, status, progress, title, asset_id,
      error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', 0, NULL, NULL, NULL, ?, ?)`,
    [input.id, input.nodeId, input.sourceUrl, input.platform, now, now],
  )

  return getImportJobById(input.id)!
}

export function getImportJobById(jobId: string): ImportJobRecord | null {
  const db = getDb()
  const row = db
    .query('SELECT * FROM import_jobs WHERE id = ?')
    .get(jobId) as ImportJobRow | null

  return row ? mapImportJobRow(row) : null
}

export function updateImportJob(
  jobId: string,
  patch: {
    status?: ImportJobStatus
    progress?: number
    title?: string | null
    assetId?: string | null
    errorMessage?: string | null
  },
): ImportJobRecord | null {
  const existing = getImportJobById(jobId)

  if (!existing) {
    return null
  }

  const db = getDb()
  const now = new Date().toISOString()

  db.run(
    `UPDATE import_jobs SET
      status = ?,
      progress = ?,
      title = ?,
      asset_id = ?,
      error_message = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      patch.status ?? existing.status,
      patch.progress ?? existing.progress,
      patch.title !== undefined ? patch.title : existing.title,
      patch.assetId !== undefined ? patch.assetId : existing.assetId,
      patch.errorMessage !== undefined ? patch.errorMessage : existing.errorMessage,
      now,
      jobId,
    ],
  )

  return getImportJobById(jobId)
}
