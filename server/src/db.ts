import { Database } from 'bun:sqlite'
import { ASSETS_DIR, DB_PATH, DATA_DIR } from './config'
import { mkdirSync } from 'node:fs'

let db: Database | null = null

// TODO(post-v1-public-release): Drop incremental SQLite migrations and repair
// helpers (getUserVersion, migrate, rebuildNodesTable, nodesKindSupportsText).
// After the first public release, treat schema as fixed: keep SCHEMA DDL only,
// bump breaking changes via export/import or a explicit major-version migration.
const SCHEMA_VERSION = 5

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
  kind TEXT NOT NULL CHECK (kind IN ('video', 'image', 'drawing', 'text')),
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

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'downloading', 'complete', 'error')),
  progress REAL NOT NULL DEFAULT 0,
  title TEXT,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_asset_id ON nodes(asset_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_node_id ON import_jobs(node_id);

CREATE TABLE IF NOT EXISTS clip_jobs (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL,
  output_node_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL REFERENCES assets(id),
  start_frame INTEGER NOT NULL,
  end_frame INTEGER NOT NULL,
  fps REAL NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'complete', 'error')),
  progress REAL NOT NULL DEFAULT 0,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clip_jobs_output_node_id ON clip_jobs(output_node_id);
`

function getUserVersion(dbInstance: Database): number {
  const row = dbInstance.query('PRAGMA user_version').get() as
    | { user_version: number }
    | undefined

  return row?.user_version ?? 0
}

function nodesKindSupportsText(dbInstance: Database): boolean {
  const row = dbInstance
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'nodes'")
    .get() as { sql: string } | undefined

  return row?.sql.includes("'text'") ?? false
}

function rebuildNodesTable(dbInstance: Database, kinds: string): void {
  dbInstance.run(`
    CREATE TABLE nodes_new (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN (${kinds})),
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
  dbInstance.run('CREATE INDEX IF NOT EXISTS idx_nodes_asset_id ON nodes(asset_id)')
}

function migrate(dbInstance: Database): void {
  const version = getUserVersion(dbInstance)

  if (version < 2) {
    rebuildNodesTable(dbInstance, "'video', 'image', 'drawing'")
  }

  if (version < 3) {
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'downloading', 'complete', 'error')),
        progress REAL NOT NULL DEFAULT 0,
        title TEXT,
        asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    dbInstance.run(
      'CREATE INDEX IF NOT EXISTS idx_import_jobs_node_id ON import_jobs(node_id)',
    )
  }

  if (!nodesKindSupportsText(dbInstance)) {
    rebuildNodesTable(dbInstance, "'video', 'image', 'drawing', 'text'")
  }

  // clip_jobs was added after user_version 5 shipped; repair older DBs that
  // bumped version without creating the table.
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS clip_jobs (
      id TEXT PRIMARY KEY,
      source_node_id TEXT NOT NULL,
      output_node_id TEXT NOT NULL,
      source_asset_id TEXT NOT NULL REFERENCES assets(id),
      start_frame INTEGER NOT NULL,
      end_frame INTEGER NOT NULL,
      fps REAL NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'complete', 'error')),
      progress REAL NOT NULL DEFAULT 0,
      asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  dbInstance.run(
    'CREATE INDEX IF NOT EXISTS idx_clip_jobs_output_node_id ON clip_jobs(output_node_id)',
  )

  if (version < SCHEMA_VERSION) {
    dbInstance.run(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  }
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
