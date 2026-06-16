# Frameflow component architecture

**Status:** Implemented.

**Related:** [SCRUB_SEEK_STRATEGIES.md](./SCRUB_SEEK_STRATEGIES.md), [TRACKPAD_SCRUB.md](./TRACKPAD_SCRUB.md)

---

## Goal

Ship a **canvas-first** Frameflow video player for playgrounds and embeds:

- Hidden decode `<video>` (required, not shown)
- Visible `<canvas>` + scrub overlay + canvas-only controls
- **Debug as data** from the package; **debug UI** lives in the host app

The full **demo app** (`/demo`) keeps dev-only affordances: upload and optional metadata overlay.

---

## Layer model

```
┌─────────────────────────────────────────────────────────┐
│ Host app (playground, demo page)                        │
│  · Renders debug UI (floating panel, etc.)              │
│  · Upload button, metadata overlay toggle (demo only)      │
└───────────────────────────┬─────────────────────────────┘
                            │ consumes debug data / hooks
┌───────────────────────────▼─────────────────────────────┐
│ Package export (`src/frameflow/`)                            │
│  FrameflowVideoProvider   — core hidden video + engine       │
│  FrameflowCanvas          — canvas + scrub overlay + controls│
│  useFrameflowDebugSnapshot — debug data only (no render)     │
│  types               — FrameflowDebugSnapshot, etc.          │
└───────────────────────────┬─────────────────────────────┘
                            │ owns
┌───────────────────────────▼─────────────────────────────┐
│ Hidden <video> → requestVideoFrameCallback → drawImage → <canvas> │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Core video: `FrameflowVideoProvider`

**Yes — this matches the “global core video” idea.**

Use a **React Provider** mounted once above any canvas (app or playground root). Not a `window` singleton — a single source-of-truth in the React tree.

```tsx
<FrameflowVideoProvider src="/videos/clip.mp4">
  <FrameflowCanvas />
</FrameflowVideoProvider>
```

### Responsibilities

- Mount hidden `<video>` (no controls, no overlay interactions)
- FPS probe, frame paint loop, frame index, scrub seek pipeline
- Expose readiness: canvas must not mount scrub UI until probe is ready (or show loading state)

### Hidden video rules

- Stays native: `playsInline`, `preload`, no custom controls on the element
- CSS: off-screen or `opacity: 0`, `pointer-events: none`, minimal layout footprint
- **No** scrub overlay, **no** play button on the video element itself

### Initialization contract

| State | Canvas behavior |
|-------|-----------------|
| `fpsProbeStatus: 'pending' \| 'probing'` | Placeholder / “Calibrating…” |
| `fpsProbeStatus: 'needs-play'` | Message: host must trigger play once |
| `fpsProbeStatus: 'ready'` | Full canvas + scrub |

`FrameflowCanvas` calls `useFrameflowVideoContext()` and throws or renders fallback if provider is missing.

---

## 2. Product surface: `FrameflowCanvas`

What playgrounds embed.

### Renders

- `<canvas>`
- Scrub overlay (pointer drag, paused-only)
- **Controls on canvas only** (play/pause affordance on or near canvas — not on hidden video)

### Does not render

- Source `<video>`
- Upload button
- Debug JSON / metrics rows
- Vsync hint

### Props (planned)

```tsx
type FrameflowCanvasProps = {
  className?: string
  width?: number
  height?: number
}
```

`src` lives on `FrameflowVideoProvider`, not on canvas — one video source per provider instance.

---

## 3. Debug: data export only

Package exports **data**, not debug UI components.

### Export

```tsx
// Hook — subscribe to latest snapshot
const snapshot = useFrameflowDebugSnapshot()
// null until first frame callback

// Optional callback on provider
<FrameflowVideoProvider src="…" onDebugSnapshot={(s) => …} />
```

### `FrameflowDebugSnapshot` shape

```ts
{
  frameCallback: VideoFrameCallbackMetadata  // raw API
  debug: {
    canvasPaintRateFps: number | null
    frame: { current, total }
    probedVideoFps: number | null
    fpsProbeStatus: 'pending' | 'probing' | 'ready' | 'needs-play'
    isPlaying: boolean
    scrub: {
      active: boolean
      throughputFps: number | null
      direction: 'left' | 'right' | 'neutral' | null
      tier: 'slow' | 'fast' | null
      velocityPxPerSec: number | null  // 2 decimal places
    }
  }
}
```

**Not included in snapshot:** vsync hint (host may compute separately if needed).

### Host-rendered debug UI

Lives **outside** the package — e.g. playground app:

- **Floating panel** — sticky top-right, collapsible/expandable, shows `JSON.stringify(snapshot)`
- Demo page may keep a metadata overlay toggle

---

## 4. Playground vs demo app

| Feature | Playground (`/playground`) | Demo app (`/demo`) |
|---------|---------------------------|-------------------|
| `FrameflowVideoProvider` | ✓ | ✓ |
| `FrameflowCanvas` | ✓ | ✓ (or debug layout) |
| Floating debug panel | ✓ (app code) | optional |
| Upload video | ✗ | ✓ |
| Source video preview | ✗ | ✗ |
| Metadata overlay | ✗ | ✓ (toggle) |

---

## 5. Optional debug helpers (app layer, not package export)

| Component | Location | Purpose |
|-----------|----------|---------|
| `FrameflowDebugFloatingPanel` | playground app | Collapsible JSON debug card |

---

## 6. Package exports (planned)

```ts
// src/frameflow/index.ts
export { FrameflowVideoProvider } from './FrameflowVideoProvider'
export { FrameflowCanvas } from './FrameflowCanvas'
export { useFrameflowVideoContext } from './FrameflowVideoContext'
export { useFrameflowDebugSnapshot } from './useFrameflowDebugSnapshot'
export type {
  FrameflowDebugSnapshot,
  FpsProbeStatus,
  DragDirection,
  MotionSpeed,
} from './types'
```

No debug render components in this export.

---

## 7. Migration from monolith demo

Done. Layout:

| Path | Role |
|------|------|
| `src/frameflow/` | Package exports: provider, canvas, hooks, types |
| `src/components/demo/FrameflowDemo.tsx` | Full demo: upload, metadata overlay toggle |
| `src/pages/PlaygroundPage.tsx` | Canvas + floating debug panel |
| `src/components/playground/FrameflowDebugFloatingPanel.tsx` | App-layer debug UI (not exported from `src/frameflow/`) |

---

## Decision log

| Date | Decision |
|------|----------|
| 2025-06 | Canvas-only product surface; hidden video in provider |
| 2025-06 | Provider must initialize (FPS probe ready) before canvas is interactive |
| 2025-06 | Controls on canvas only; never on hidden video |
| 2025-06 | Package exports debug **data** only; UI in host app |
| 2025-06 | Playground: canvas + floating debug panel; no upload |
| 2025-06 | Upload + metadata overlay: demo app only |
