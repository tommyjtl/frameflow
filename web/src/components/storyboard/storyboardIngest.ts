export type IngestKind = 'video' | 'image'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov'])
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.svg',
])

const VIDEO_MIME_PREFIX = 'video/'
const PASTE_IMAGE_MIME_PREFIX = 'image/'

export type IngestValidationResult =
  | { ok: true; kind: IngestKind }
  | { ok: false; error: string }

export function getFileExtension(fileName: string): string {
  const match = /\.[^.]+$/.exec(fileName.trim())

  if (!match) {
    return ''
  }

  return match[0].toLowerCase()
}

export function validateIngestFile(file: File): IngestValidationResult {
  const extension = getFileExtension(file.name)
  const mime = file.type.toLowerCase()

  if (mime.startsWith(VIDEO_MIME_PREFIX) || VIDEO_EXTENSIONS.has(extension)) {
    if (
      mime &&
      mime !== 'video/mp4' &&
      mime !== 'video/quicktime' &&
      !VIDEO_EXTENSIONS.has(extension)
    ) {
      return { ok: false, error: 'Unsupported video format. Use .mp4 or .mov.' }
    }

    if (!VIDEO_EXTENSIONS.has(extension) && mime !== 'video/mp4' && mime !== 'video/quicktime') {
      return { ok: false, error: 'Unsupported video format. Use .mp4 or .mov.' }
    }

    return { ok: true, kind: 'video' }
  }

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
    return { ok: true, kind: 'image' }
  }

  return {
    ok: false,
    error:
      'Unsupported file type. Video: .mp4, .mov. Image: JPEG, PNG, WebP, GIF, AVIF, SVG.',
  }
}

export function getFilesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  return [...dataTransfer.files]
}

export function getPasteImageFiles(dataTransfer: DataTransfer): File[] {
  const files: File[] = []

  for (const item of dataTransfer.items) {
    if (item.kind !== 'file') {
      continue
    }

    if (!item.type.startsWith(PASTE_IMAGE_MIME_PREFIX)) {
      continue
    }

    const file = item.getAsFile()

    if (file) {
      files.push(file)
    }
  }

  return files
}

export function hasFileDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false
  }

  return [...dataTransfer.types].includes('Files')
}

export function labelFromFileName(
  fileName: string,
  kind: IngestKind,
  fallbackIndex: number,
): string {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim()

  if (baseName.length > 0) {
    return baseName
  }

  return kind === 'video' ? `Video ${fallbackIndex}` : `Image ${fallbackIndex}`
}

export function loadImageDimensions(
  src: string,
): Promise<{ naturalWidth: number; naturalHeight: number } | null> {
  return new Promise((resolve) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
    }

    image.onerror = () => {
      resolve(null)
    }

    image.src = src
  })
}

export function nodePositionForDrop(
  flowPosition: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number,
  index: number,
): { x: number; y: number } {
  return {
    x: flowPosition.x - nodeWidth / 2 + index * 24,
    y: flowPosition.y - nodeHeight / 2 + index * 24,
  }
}

export function nodePositionForPaste(
  getNodes: () => Array<{ selected?: boolean; position: { x: number; y: number } }>,
  viewportCenter: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number,
  index: number,
): { x: number; y: number } {
  const selected = getNodes().find((node) => node.selected)

  if (selected) {
    return {
      x: selected.position.x + 40 + index * 24,
      y: selected.position.y + 40 + index * 24,
    }
  }

  return nodePositionForDrop(viewportCenter, nodeWidth, nodeHeight, index)
}
