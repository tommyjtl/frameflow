import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SAMPLE_VIDEO,
  FrameflowCanvas,
  FrameflowVideoProvider,
  useFrameflowDebugSnapshot,
} from '../../frameflow'
import './FrameflowDemo.css'

function DemoContent({ showMetadata }: { showMetadata: boolean }) {
  const snapshot = useFrameflowDebugSnapshot()

  return (
    <>
      <div className="frameflow-stage">
        <FrameflowCanvas />
      </div>

      {showMetadata && (
        <aside
          className="frameflow-metadata-overlay"
          aria-label="Debug metadata"
          aria-live="polite"
        >
          <pre className="frameflow-metadata-overlay__pre">
            {snapshot
              ? JSON.stringify(snapshot, null, 2)
              : 'Metadata appears on play…'}
          </pre>
        </aside>
      )}
    </>
  )
}

export function FrameflowDemo() {
  const [videoSrc, setVideoSrc] = useState(DEFAULT_SAMPLE_VIDEO)
  const [showMetadata, setShowMetadata] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  const handleUpload = useCallback((url: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    objectUrlRef.current = url
    setVideoSrc(url)
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  return (
    <div className="frameflow-demo">
      <header className="frameflow-header">
        <h1>Frameflow</h1>
        <p>
          A React component for gesture-based video scrubbing, frame inspection,
          and visual reference workflows. Click the canvas to play or pause; drag
          horizontally while paused to scrub. Toggle debug metadata from the
          controls below. Canvas-only embed:{' '}
          <a href="/playground">/playground</a>.
        </p>
      </header>

      <FrameflowVideoProvider src={videoSrc} key={videoSrc}>
        <div className="frameflow-demo-toolbar">
          <label className="frameflow-upload-btn">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file?.type.startsWith('video/')) return
                handleUpload(URL.createObjectURL(file))
              }}
            />
            Upload video
          </label>

          <label className="frameflow-demo-toggle">
            <input
              type="checkbox"
              checked={showMetadata}
              onChange={(e) => setShowMetadata(e.target.checked)}
            />
            Show metadata
          </label>
        </div>

        <DemoContent showMetadata={showMetadata} />
      </FrameflowVideoProvider>
    </div>
  )
}
