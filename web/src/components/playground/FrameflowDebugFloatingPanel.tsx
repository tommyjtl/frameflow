import { useState } from 'react'
import { useFrameflowDebugSnapshot } from '../../frameflow'
import './FrameflowDebugFloatingPanel.css'

export function FrameflowDebugFloatingPanel() {
  const snapshot = useFrameflowDebugSnapshot()
  const [open, setOpen] = useState(false)

  return (
    <aside className="frameflow-debug-panel">
      <button
        type="button"
        className="frameflow-debug-panel__toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide debug' : 'Show debug'}
      </button>

      {open && (
        <pre className="frameflow-debug-panel__pre">
          {snapshot ? JSON.stringify(snapshot, null, 2) : 'No snapshot yet…'}
        </pre>
      )}
    </aside>
  )
}
