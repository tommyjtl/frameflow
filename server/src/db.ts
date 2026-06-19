import { Database } from 'bun:sqlite'
import { ASSETS_DIR, DB_PATH, DATA_DIR } from './config'
import { mkdirSync } from 'node:fs'

let db: Database | null = null

const SCHEMA_VERSION = 2

const SCHEMA = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  original_name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('video', 'image')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('video', 'image', 'drawing')),
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  meta_json TEXT
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_nodes_asset_id ON nodes(asset_id);
`

function getUserVersion(dbInstance: Database): number {
  const row = dbInstance.query('PRAGMA user_version').get() as
    | { user_version: number }
    | undefined

  return row?.user_version ?? 0
}

function migrate(dbInstance: Database): void {
  const version = getUserVersion(dbInstance)

  if (version >= SCHEMA_VERSION) {
    return
  }

  if (version < 2) {
    dbInstance.run(`
      CREATE TABLE nodes_new (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('video', 'image', 'drawing')),
        asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
        label TEXT NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        meta_json TEXT
      )
    `)
    dbInstance.run(`
      INSERT INTO nodes_new (
        id, kind, asset_id, label, position_x, position_y, width, height, meta_json
      )
      SELECT
        id, kind, asset_id, label, position_x, position_y, width, height, meta_json
      FROM nodes
    `)
    dbInstance.run('DROP TABLE nodes')
    dbInstance.run('ALTER TABLE nodes_new RENAME TO nodes')
    dbInstance.run(
      'CREATE INDEX IF NOT EXISTS idx_nodes_asset_id ON nodes(asset_id)',
    )
  }

  dbInstance.run(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

export function getDb(): Database {
  if (db) {
    return db
  }

  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(ASSETS_DIR, { recursive: true })

  db = new Database(DB_PATH, { create: true })
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  migrate(db)

  return db
}

export function parseJsonColumn<T>(value: string | null): T | null {
  if (value === null || value === '') {
    return null
  }

  return JSON.parse(value) as T
}

export function stringifyJsonColumn(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return JSON.stringify(value)
}
