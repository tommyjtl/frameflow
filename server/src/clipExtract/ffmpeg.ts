import path from 'node:path'

export type ClipTrimProgress = {
  percent: number
}

export class ClipTrimError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClipTrimError'
  }
}

function frameToSeconds(frame: number, fps: number): number {
  return frame / fps
}

function clipDurationSeconds(
  startFrame: number,
  endFrame: number,
  fps: number,
): number {
  const frameCount = endFrame - startFrame + 1
  return frameCount / fps
}

async function probeHasAudioStream(filePath: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      [
        'ffprobe',
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=index',
        '-of',
        'csv=p=0',
        filePath,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ])

    return exitCode === 0 && stdout.trim().length > 0
  } catch {
    return false
  }
}

export async function trimVideoWithFfmpeg(input: {
  inputPath: string
  outputPath: string
  startFrame: number
  endFrame: number
  fps: number
  onProgress?: (update: ClipTrimProgress) => void
  /** Called with a kill function while ffmpeg is running (for cancellation). */
  onProcess?: (kill: () => void) => void
}): Promise<void> {
  const { inputPath, outputPath, startFrame, endFrame, fps } = input

  if (startFrame < 0 || endFrame < startFrame) {
    throw new ClipTrimError('Invalid clip frame range.')
  }

  if (endFrame - startFrame + 1 < 2) {
    throw new ClipTrimError('Clip must be at least 2 frames long.')
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new ClipTrimError('Invalid video frame rate.')
  }

  const startTime = frameToSeconds(startFrame, fps)
  const duration = clipDurationSeconds(startFrame, endFrame, fps)
  const hasAudio = await probeHasAudioStream(inputPath)

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-i',
    inputPath,
    // Accurate seek: -ss after -i trims on decoded frames (matches storyboard indices).
    '-ss',
    startTime.toFixed(6),
    '-t',
    duration.toFixed(6),
    '-map',
    '0:v:0',
    ...(hasAudio ? ['-map', '0:a:0?', '-c:a', 'aac'] : ['-an']),
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    '-y',
    outputPath,
  ]

  let proc: ReturnType<typeof Bun.spawn>

  try {
    proc = Bun.spawn(['ffmpeg', ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch {
    throw new ClipTrimError(
      'ffmpeg is not available. Install ffmpeg to extract video clips.',
    )
  }

  const stdout = proc.stdout
  const stderr = proc.stderr

  if (
    !stdout ||
    !stderr ||
    typeof stdout === 'number' ||
    typeof stderr === 'number'
  ) {
    throw new ClipTrimError('Failed to capture ffmpeg output.')
  }

  input.onProcess?.(() => {
    proc.kill()
  })

  let stderrText = ''
  let lastPercent = 0

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

  const handleProgressLine = (line: string) => {
    const trimmed = line.trim()

    if (!trimmed.includes('=')) {
      return
    }

    const [key, rawValue] = trimmed.split('=')
    const value = rawValue?.trim()

    if (key === 'out_time_ms' && value) {
      const outMs = Number.parseInt(value, 10)

      if (Number.isFinite(outMs) && duration > 0) {
        const percent = Math.min(
          99,
          Math.round((outMs / 1_000_000 / duration) * 100),
        )

        if (percent > lastPercent) {
          lastPercent = percent
          input.onProgress?.({ percent })
        }
      }
    }
  }

  input.onProgress?.({ percent: 5 })

  await Promise.all([
    pumpStream(stdout, handleProgressLine),
    pumpStream(stderr, (line) => {
      stderrText += `${line}\n`
    }),
  ])

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const message =
      stderrText.trim() ||
      `ffmpeg failed with exit code ${exitCode}.`

    throw new ClipTrimError(message)
  }

  if (!path.isAbsolute(outputPath)) {
    throw new ClipTrimError('Trim output file was not created.')
  }

  input.onProgress?.({ percent: 100 })
}
