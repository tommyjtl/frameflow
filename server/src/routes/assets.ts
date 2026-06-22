import path from 'node:path'
import { unlinkSync } from 'node:fs'
import { ASSETS_DIR } from '../config'
import {
  AssetValidationError,
  assetFileName,
  parseByteRange,
  validateUploadedFile,
} from '../assets'
import {
  countAssetReferences,
  deleteAssetRow,
  findAssetById,
  insertAssetRecord,
} from './board'
import type { AssetUploadResponse } from '../types'

export async function handleAssetUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return Response.json({ error: 'Missing file field.' }, { status: 400 })
    }

    const validated = validateUploadedFile(file)
    const id = crypto.randomUUID()
    const fileName = assetFileName(id, validated.extension)
    const filePath = path.join(ASSETS_DIR, fileName)
    const bytes = new Uint8Array(await file.arrayBuffer())

    await Bun.write(filePath, bytes)

    const asset = insertAssetRecord({
      id,
      mimeType: validated.mimeType,
      extension: validated.extension,
      originalName: file.name || null,
      kind: validated.kind,
      createdAt: new Date().toISOString(),
    })

    const body: AssetUploadResponse = { asset }
    return Response.json(body, { status: 201 })
  } catch (error) {
    if (error instanceof AssetValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error(error)
    return Response.json({ error: 'Upload failed.' }, { status: 500 })
  }
}

export function handleAssetDelete(assetId: string): Response {
  const asset = findAssetById(assetId)

  if (!asset) {
    return Response.json({ error: 'Asset not found.' }, { status: 404 })
  }

  const references = countAssetReferences(assetId)

  if (references > 0) {
    return Response.json(
      { error: `Asset is still referenced by ${references} node(s).` },
      { status: 409 },
    )
  }

  const filePath = path.join(ASSETS_DIR, assetFileName(assetId, asset.extension))

  try {
    unlinkSync(filePath)
  } catch {
    // Missing file on disk is acceptable during cleanup.
  }

  deleteAssetRow(assetId)

  return new Response(null, { status: 204 })
}

export async function handleAssetFile(
  req: Request,
  assetId: string,
  fileName: string,
): Promise<Response> {
  const asset = findAssetById(assetId)

  if (!asset) {
    return new Response('Not Found', { status: 404 })
  }

  const expectedName = assetFileName(asset.id, asset.extension)

  if (fileName !== expectedName) {
    return new Response('Not Found', { status: 404 })
  }

  const filePath = path.join(ASSETS_DIR, expectedName)
  const file = Bun.file(filePath)

  if (!(await file.exists())) {
    return new Response('Not Found', { status: 404 })
  }

  const fileSize = file.size
  const baseHeaders = {
    'Content-Type': asset.mimeType,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  }

  const range = parseByteRange(req.headers.get('range'), fileSize)

  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes */${fileSize}`,
      },
    })
  }

  if (range) {
    const { start, end } = range
    const chunkSize = end - start + 1

    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      },
    })
  }

  return new Response(file, {
    headers: {
      ...baseHeaders,
      'Content-Length': String(fileSize),
    },
  })
}
