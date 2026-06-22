import { PORT } from './config'
import { getDb } from './db'
import { getBoard, saveBoard } from './routes/board'
import {
  handleAssetDelete,
  handleAssetFile,
  handleAssetUpload,
} from './routes/assets'
import {
  handleGetImportJob,
  handleImportJobStream,
  handleStartImportUrl,
} from './routes/import'
import type { BoardPayload } from './types'

getDb()

const server = Bun.serve({
  port: PORT,
  routes: {
    '/api/health': Response.json({ ok: true }),

    '/api/board': {
      GET() {
        return Response.json(getBoard())
      },
      async PUT(req) {
        try {
          const payload = (await req.json()) as BoardPayload

          if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
            return Response.json({ error: 'Invalid board payload.' }, { status: 400 })
          }

          const board = saveBoard(payload)
          return Response.json(board)
        } catch (error) {
          console.error(error)
          return Response.json({ error: 'Failed to save board.' }, { status: 500 })
        }
      },
    },

    '/api/assets': {
      POST: handleAssetUpload,
    },

    '/api/assets/:id': {
      DELETE(req) {
        return handleAssetDelete(req.params.id)
      },
    },

    '/api/import/url': {
      POST: handleStartImportUrl,
    },

    '/api/import/:jobId/stream': {
      GET(req) {
        return handleImportJobStream(req.params.jobId)
      },
    },

    '/api/import/:jobId': {
      GET(req) {
        return handleGetImportJob(req.params.jobId)
      },
    },

    '/assets/:fileName': async (req) => {
      const fileName = req.params.fileName
      const assetId = fileName.split('.')[0]

      if (!assetId) {
        return new Response('Not Found', { status: 404 })
      }

      return handleAssetFile(req, assetId, fileName)
    },
  },

  error(error) {
    console.error(error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  },
})

console.log(`Storyboard API running at ${server.url}`)
