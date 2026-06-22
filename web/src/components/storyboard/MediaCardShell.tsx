import type { ReactNode } from 'react'
import { NodeResizer, Position } from '@xyflow/react'
import {
  STORYBOARD_MIN_NODE_HEIGHT,
  STORYBOARD_MIN_NODE_WIDTH,
} from './storyboardTypes'
import { MediaCardHeader } from './MediaCardHeader'
import { MediaCardHandleAnchor } from './MediaCardHandleAnchor'
import { MediaCardRenameOverlay } from './MediaCardRenameOverlay'

type MediaCardShellProps = {
  label: string
  selected?: boolean
  showResizer?: boolean
  showHeader?: boolean
  header?: ReactNode
  bodyClassName?: string
  children: ReactNode
  minWidth?: number
  minHeight?: number
  keepAspectRatio?: boolean
}

export function MediaCardShell({
  label,
  selected = false,
  showResizer = true,
  showHeader = true,
  header,
  bodyClassName,
  children,
  minWidth = STORYBOARD_MIN_NODE_WIDTH,
  minHeight = STORYBOARD_MIN_NODE_HEIGHT,
  keepAspectRatio = true,
}: MediaCardShellProps) {
  return (
    <div className="media-card-shell">
      <NodeResizer
        isVisible={selected && showResizer}
        minWidth={minWidth}
        minHeight={minHeight}
        keepAspectRatio={keepAspectRatio}
        color="var(--storyboard-selection)"
        lineClassName="media-card__resize-line"
        handleClassName="media-card__resize-handle"
      />

      <div
        className={['media-card', !showHeader && 'media-card--headerless']
          .filter(Boolean)
          .join(' ')}
      >
        {showHeader ? (header ?? <MediaCardHeader label={label} />) : null}
        {!showHeader ? <MediaCardRenameOverlay label={label} /> : null}

        <div className={['media-card__body', bodyClassName].filter(Boolean).join(' ')}>
          {children}
        </div>
      </div>

      {/* Handles sit outside `.media-card`; each joint has its own hover zone. */}
      <MediaCardHandleAnchor
        className="media-card-handle-anchor--left"
        handles={[{ id: 'target', type: 'target', position: Position.Left }]}
      />
      <MediaCardHandleAnchor
        className="media-card-handle-anchor--right"
        handles={[{ id: 'source', type: 'source', position: Position.Right }]}
      />
      <MediaCardHandleAnchor
        className="media-card-handle-anchor--top"
        handles={[
          { id: 'top-target', type: 'target', position: Position.Top },
          { id: 'top-source', type: 'source', position: Position.Top },
        ]}
      />
      <MediaCardHandleAnchor
        className="media-card-handle-anchor--bottom"
        handles={[
          { id: 'bottom-target', type: 'target', position: Position.Bottom },
          { id: 'bottom-source', type: 'source', position: Position.Bottom },
        ]}
      />
    </div>
  )
}
