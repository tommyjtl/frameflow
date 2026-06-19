import path from 'node:path'

const serverSrcDir = import.meta.dir
export const ROOT_DIR = path.resolve(serverSrcDir, '../..')
export const DATA_DIR = path.join(ROOT_DIR, 'data')
export const ASSETS_DIR = path.join(DATA_DIR, 'assets')
export const DB_PATH = path.join(DATA_DIR, 'storyboard.db')
export const PORT = Number(process.env.PORT ?? process.env.BUN_PORT ?? 3001)
