import { getDb, parseJsonColumn, stringifyJsonColumn } from '../db'
import type { AssetRecord, BoardEdgeRecord, BoardNodeRecord, BoardPayload, BoardResponse } from '../types'
import { assetUrl } from '../assets'

type AssetRow = {
  id: string
  mime_type: string
  extension: string
  original_name: string | null
  kind: 'video' | 'image'
  created_at: string
}

type NodeRow = {
  id: string
  kind: 'video' | 'image'
  asset_id: string | null
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
  meta_json: string | null
}

type EdgeRow = {
  id: string
  source_node_id: string
  target_node_id: string
  kind: string | null
  meta_json: string | null
}

function mapAssetRow(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    mimeType: row.mime_type,
    extension: row.extension,
    originalName: row.original_name,
    kind: row.kind,
    createdAt: row.created_at,
    url: assetUrl(row.id, row.extension),
  }
}

function mapNodeRow(row: NodeRow): BoardNodeRecord {
  return {
    id: row.id,
    kind: row.kind,
    assetId: row.asset_id,
    label: row.label,
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    meta: parseJsonColumn<Record<string, unknown>>(row.meta_json),
  }
}

function mapEdgeRow(row: EdgeRow): BoardEdgeRecord {
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    kind: row.kind,
    meta: parseJsonColumn<Record<string, unknown>>(row.meta_json),
  }
}

export function getBoard(): BoardResponse {
  const db = getDb()

  const assetRows = db.query('SELECT * FROM assets ORDER BY created_at ASC').all() as AssetRow[]
  const nodeRows = db.query('SELECT * FROM nodes ORDER BY rowid ASC').all() as NodeRow[]
  const edgeRows = db.query('SELECT * FROM edges ORDER BY rowid ASC').all() as EdgeRow[]

  return {
    nodes: nodeRows.map(mapNodeRow),
    edges: edgeRows.map(mapEdgeRow),
    assets: assetRows.map(mapAssetRow),
  }
}

export function saveBoard(payload: BoardPayload): BoardResponse {
  const db = getDb()

  const save = db.transaction(() => {
    db.run('DELETE FROM edges')
    db.run('DELETE FROM nodes')

    const insertNode = db.prepare(`
      INSERT INTO nodes (
        id, kind, asset_id, label, position_x, position_y, width, height, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const node of payload.nodes) {
      insertNode.run(
        node.id,
        node.kind,
        node.assetId,
        node.label,
        node.positionX,
        node.positionY,
        node.width,
        node.height,
        stringifyJsonColumn(node.meta),
      )
    }

    const insertEdge = db.prepare(`
      INSERT INTO edges (id, source_node_id, target_node_id, kind, meta_json)
      VALUES (?, ?, ?, ?, ?)
    `)

    for (const edge of payload.edges) {
      insertEdge.run(
        edge.id,
        edge.sourceNodeId,
        edge.targetNodeId,
        edge.kind,
        stringifyJsonColumn(edge.meta),
      )
    }
  })

  save()

  return getBoard()
}

export function countAssetReferences(assetId: string): number {
  const db = getDb()
  const row = db
    .query('SELECT COUNT(*) as count FROM nodes WHERE asset_id = ?')
    .get(assetId) as { count: number }

  return row.count
}

export function deleteAssetRow(assetId: string): boolean {
  const db = getDb()
  const result = db.run('DELETE FROM assets WHERE id = ?', [assetId])
  return result.changes > 0
}

export function findAssetById(assetId: string): AssetRecord | null {
  const db = getDb()
  const row = db.query('SELECT * FROM assets WHERE id = ?').get(assetId) as AssetRow | null

  if (!row) {
    return null
  }

  return mapAssetRow(row)
}

export function insertAssetRecord(input: {
  id: string
  mimeType: string
  extension: string
  originalName: string | null
  kind: 'video' | 'image'
  createdAt: string
}): AssetRecord {
  const db = getDb()

  db.run(
    `INSERT INTO assets (id, mime_type, extension, original_name, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.id, input.mimeType, input.extension, input.originalName, input.kind, input.createdAt],
  )

  return {
    id: input.id,
    mimeType: input.mimeType,
    extension: input.extension,
    originalName: input.originalName,
    kind: input.kind,
    createdAt: input.createdAt,
    url: assetUrl(input.id, input.extension),
  }
}
