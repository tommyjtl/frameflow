import { useState } from 'react'
import { useFrameflowDebugSnapshot } from '../../frameflow'
import './FrameflowDebugFloatingPanel.css'

export function FrameflowDebugFloatingPanel() {
  const snapshot = useFrameflowDebugSnapshot()
  const [expanded, setExpanded] = useState(false)

  const frameLabel = snapshot
    ? `${snapshot.debug.frame.current ?? '—'} / ${snapshot.debug.frame.total ?? '—'}`
    : '— / —'

  return (
    <aside
      className={`frameflow-debug-panel${expanded ? ' frameflow-debug-panel--expanded' : ''}`}
      aria-label="Frameflow debug"
    >
      <button
        type="button"
        className="frameflow-debug-panel__toggle"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <span className="frameflow-debug-panel__title">Debug</span>
        <span className="frameflow-debug-panel__summary">{frameLabel}</span>
        <span className="frameflow-debug-panel__chevron" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <pre className="frameflow-debug-panel__body">
          {snapshot
            ? JSON.stringify(snapshot, null, 2)
            : 'Waiting for frame metadata…'}
        </pre>
      )}
    </aside>
  )
}
