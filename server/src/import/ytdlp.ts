import path from 'node:path'
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { ASSETS_DIR } from '../config'

export const IMPORT_TMP_DIR = path.join(ASSETS_DIR, '.tmp')

const PROGRESS_PATTERN = /\[download\]\s+([\d.]+)%/

export type YtdlpProgressUpdate = {
  percent: number
}

export type YtdlpDownloadResult = {
  filePath: string
}

function ensureTmpDir(): void {
  mkdirSync(IMPORT_TMP_DIR, { recursive: true })
}

function buildFormatArgs(): string[] {
  return [
    '-f',
    // Second-best video (+ best audio), then second-best combined format.
    'bv*.2+ba/b.2',
    '--merge-output-format',
    'mp4',
    '--extractor-args',
    'youtube:player_client=android_vr',
  ]
}

function normalizeYtdlpTitle(stdout: string): string | null {
  const firstLine = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  return firstLine ?? null
}

/** Prefer the final ERROR line over full yt-dlp stderr noise. */
export function formatImportError(raw: string): string {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const errorLines = lines.filter((line) => line.startsWith('ERROR:'))

  if (errorLines.length > 0) {
    return errorLines[errorLines.length - 1]!
  }

  const meaningful = lines.filter(
    (line) =>
      !line.startsWith('WARNING:') &&
      !line.startsWith('Deprecated Feature:') &&
      !line.includes('See  https://github.com/yt-dlp/yt-dlp'),
  )

  if (meaningful.length > 0) {
    return meaningful[meaningful.length - 1]!
  }

  return 'Import failed.'
}

export async function fetchYtdlpTitle(url: string): Promise<string | null> {
  const proc = Bun.spawn(
    [
      'yt-dlp',
      '--skip-download',
      '--print',
      '%(title)s',
      '--no-playlist',
      url,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (exitCode !== 0) {
    const message =
      stderr.trim() || stdout.trim() || 'Could not read media metadata.'
    throw new Error(formatImportError(message))
  }

  return normalizeYtdlpTitle(stdout)
}

export async function probeMediaDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const proc = Bun.spawn(
      [
        'ffprobe',
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0:s=x',
        filePath,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ])

    if (exitCode === 0) {
      const [widthText, heightText] = stdout.trim().split('x')
      const width = Number.parseInt(widthText ?? '', 10)
      const height = Number.parseInt(heightText ?? '', 10)

      if (width > 0 && height > 0) {
        return { width, height }
      }
    }
  } catch {
    // ffprobe unavailable; fall back to yt-dlp.
  }

  try {
    const proc = Bun.spawn(
      ['yt-dlp', '--skip-download', '--print', 'width', '--print', 'height', filePath],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ])

    if (exitCode !== 0) {
      return null
    }

    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const width = Number.parseInt(lines[0] ?? '', 10)
    const height = Number.parseInt(lines[1] ?? '', 10)

    if (width > 0 && height > 0) {
      return { width, height }
    }
  } catch {
    return null
  }

  return null
}

export async function downloadWithYtdlp(
  url: string,
  jobId: string,
  onProgress: (update: YtdlpProgressUpdate) => void,
): Promise<YtdlpDownloadResult> {
  ensureTmpDir()

  const outputTemplate = path.join(IMPORT_TMP_DIR, `${jobId}.%(ext)s`)

  for (const file of readdirSync(IMPORT_TMP_DIR)) {
    if (file.startsWith(`${jobId}.`)) {
      unlinkSync(path.join(IMPORT_TMP_DIR, file))
    }
  }

  const args = [
    '--newline',
    '--progress',
    '--no-playlist',
    ...buildFormatArgs(),
    '-o',
    outputTemplate,
    url,
  ]

  const proc = Bun.spawn(['yt-dlp', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const pumpStream = async (
    stream: ReadableStream<Uint8Array>,
    onLine: (line: string) => void,
  ) => {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        onLine(line)
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) {
      onLine(buffer)
    }
  }

  let stderrText = ''

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    const progressMatch = trimmed.match(PROGRESS_PATTERN)

    if (progressMatch) {
      const percent = Math.min(
        100,
        Math.max(0, Number.parseFloat(progressMatch[1])),
      )
      if (Number.isFinite(percent)) {
        onProgress({ percent })
      }
    }
  }

  await Promise.all([
    pumpStream(proc.stdout, handleLine),
    pumpStream(proc.stderr, (line) => {
      stderrText += `${line}\n`
      handleLine(line)
    }),
  ])

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const message = stderrText.trim() || 'yt-dlp download failed.'
    throw new Error(formatImportError(message))
  }

  const fallback = readdirSync(IMPORT_TMP_DIR).find((file) =>
    file.startsWith(`${jobId}.`),
  )

  if (!fallback) {
    throw new Error('Download finished but no output file was found.')
  }

  return {
    filePath: path.join(IMPORT_TMP_DIR, fallback),
  }
}
