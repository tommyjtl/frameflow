import { Handle, Position, type HandleType } from '@xyflow/react'

type MediaCardHandleAnchorProps = {
  className: string
  handles: ReadonlyArray<{
    id: string
    type: HandleType
    position: Position
  }>
}

export function MediaCardHandleAnchor({
  className,
  handles,
}: MediaCardHandleAnchorProps) {
  return (
    <div className={['media-card-handle-anchor', className].join(' ')}>
      {handles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          className="media-card__connection-handle"
        />
      ))}
    </div>
  )
}
