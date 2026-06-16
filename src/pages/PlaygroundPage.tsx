import {
  DEFAULT_SAMPLE_VIDEO,
  FrameflowCanvas,
  FrameflowVideoProvider,
} from '../frameflow'
import { FrameflowDebugFloatingPanel } from '../components/playground/FrameflowDebugFloatingPanel'
import './PlaygroundPage.css'

export function PlaygroundPage() {
  return (
    <FrameflowVideoProvider src={DEFAULT_SAMPLE_VIDEO}>
      <div className="playground-page">
        <main className="playground-page__main">
          <FrameflowCanvas />
        </main>
        <FrameflowDebugFloatingPanel />
      </div>
    </FrameflowVideoProvider>
  )
}
