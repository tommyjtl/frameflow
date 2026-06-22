import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import { useStoryboardTextEditing } from './StoryboardTextEditingContext'
import {
  STORYBOARD_TEXT_MAX_SCALE,
  STORYBOARD_TEXT_MIN_SCALE,
  STORYBOARD_TEXT_NOTE_MIN_HEIGHT,
  STORYBOARD_TEXT_NOTE_MIN_WIDTH,
  TEXT_NOTE_NODE_TYPE,
  getTextNoteEffectiveFontSize,
  measureTextNoteDimensions,
  type TextNoteNodeType,
} from './storyboardTypes'

function TextNoteNodeComponent({
  id,
  data,
  selected,
  width,
}: NodeProps<TextNoteNodeType>) {
  const { setNodes } = useReactFlow<TextNoteNodeType>()
  const { editingTextNodeId, enterTextEditing, exitTextEditing, interactionMode } =
    useStoryboardTextEditing()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isEditing = editingTextNodeId === id
  const fontSize = getTextNoteEffectiveFontSize(data)

  const updateText = useCallback(
    (text: string) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id && node.type === TEXT_NOTE_NODE_TYPE
            ? {
                ...node,
                data: {
                  ...node.data,
                  text,
                },
              }
            : node,
        ),
      )
    },
    [id, setNodes],
  )

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const textarea = textareaRef.current

      if (!textarea) {
        return
      }

      textarea.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [isEditing])

  useLayoutEffect(() => {
    if (!isEditing) {
      return
    }

    const { width: nextWidth, height: nextHeight } = measureTextNoteDimensions(
      data.text,
      fontSize,
    )

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id || node.type !== TEXT_NOTE_NODE_TYPE) {
          return node
        }

        if (node.width === nextWidth && node.height === nextHeight) {
          return node
        }

        return {
          ...node,
          width: nextWidth,
          height: nextHeight,
        }
      }),
    )
  }, [data.text, fontSize, id, isEditing, setNodes])

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()

      if (interactionMode === 'select') {
        enterTextEditing(id)
      }
    },
    [enterTextEditing, id, interactionMode],
  )

  const handleBlur = useCallback(() => {
    exitTextEditing()
  }, [exitTextEditing])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        exitTextEditing()
      }
    },
    [exitTextEditing],
  )

  const applyTextNoteResize = useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      const scale = data.scale ?? 1
      const referenceWidth =
        data.referenceWidth ??
        ((width ?? STORYBOARD_TEXT_NOTE_MIN_WIDTH) > 0
          ? (width ?? STORYBOARD_TEXT_NOTE_MIN_WIDTH) / scale
          : STORYBOARD_TEXT_NOTE_MIN_WIDTH)

      if (referenceWidth <= 0) {
        return
      }

      const nextScale = Math.min(
        STORYBOARD_TEXT_MAX_SCALE,
        Math.max(STORYBOARD_TEXT_MIN_SCALE, params.width / referenceWidth),
      )

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id || node.type !== TEXT_NOTE_NODE_TYPE) {
            return node
          }

          if (
            node.width === params.width &&
            node.height === params.height &&
            node.data.scale === nextScale &&
            node.data.referenceWidth === referenceWidth
          ) {
            return node
          }

          return {
            ...node,
            width: params.width,
            height: params.height,
            data: {
              ...node.data,
              scale: nextScale,
              referenceWidth,
            },
          }
        }),
      )
    },
    [data.referenceWidth, data.scale, id, setNodes, width],
  )

  return (
    <div
      className={[
        'text-note-node',
        selected && !isEditing ? 'text-note-node--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        isVisible={selected && !isEditing}
        minWidth={STORYBOARD_TEXT_NOTE_MIN_WIDTH}
        minHeight={STORYBOARD_TEXT_NOTE_MIN_HEIGHT}
        keepAspectRatio
        color="var(--storyboard-selection)"
        lineClassName="text-note-node__resize-line"
        handleClassName="text-note-node__resize-handle"
        onResize={applyTextNoteResize}
        onResizeEnd={applyTextNoteResize}
      />

      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="text-note-node__input nodrag nopan nowheel"
          value={data.text}
          rows={1}
          wrap="off"
          spellCheck
          style={{ fontSize }}
          onChange={(event) => updateText(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-label="Text note"
        />
      ) : (
        <div
          className="text-note-node__display dragHandle"
          style={{ fontSize }}
          aria-label={data.text.trim() ? undefined : 'Empty text note'}
        >
          {data.text || '\u00a0'}
        </div>
      )}
    </div>
  )
}

export const TextNoteNode = memo(TextNoteNodeComponent)
