# Storyboard playground — V2 plan

**Status:** Implemented (phases A–E + P)  
**Builds on:** V1 minimal playground at `/` (React Flow + `FrameflowVideoNode`)  
**Related:** [FRAMEFLOW_COMPONENT_ARCHITECTURE.md](./FRAMEFLOW_COMPONENT_ARCHITECTURE.md)

---

## V1 recap (done)

| Capability | Notes |
|------------|--------|
| React Flow storyboard | Full-viewport `/` |
| Video note cards | `FrameflowVideoProvider` + `FrameflowCanvas` per node |
| Connect shots | Bezier edges, configurable stroke |
| Resize | `NodeResizer`, aspect ratio locked |
| Safe playback zone | Storyboard-only click inset + cursor affordance |
| Add shot | Panel button, seeds sample video |

**Out of scope in V1:** persistence, upload, image cards, rename, context menu, frame extract.

---

## V2 vision

Turn the playground from a **fixed demo board** into a **media storyboard**: users bring their own references (video + image), arrange and link them, rename and manage cards, and extract stills from video as new reference cards.

---

## Feature set

### 1. Ingest layer (drag, drop, paste) — done

**Goal:** Add media to the canvas without leaving the board.

| Channel | Supported | Formats |
|---------|-----------|---------|
| Drag & drop onto playground | Video + image files | Video: `.mov`, `.mp4` · Image: JPEG, PNG, WebP, GIF, AVIF, SVG |
| File picker (Import media) | Same as drop | Same |
| Copy & paste | **Images only** | Clipboard `image/*` (PNG, JPEG, WebP, GIF) |

**Shipped UX**

- Drop overlay when dragging files over the playground.
- Drop creates a node at **drop position** (flow coordinates).
- Paste (playground focused) creates image node near viewport center or last selection.
- Unsupported types show a **short panel message** (5s).

**Implementation:** `storyboardIngest.ts`, `useStoryboardIngest.ts`, `StoryboardDropOverlay.tsx`, `POST /api/assets`.

---

### 2. Shared media note card (refactor) — done

**Goal:** One card chrome for video and image nodes.

```
┌─────────────────────────────────────┐
│  Header (drag, rename, menu)        │  ← video only (see deviations)
├─────────────────────────────────────┤
│  Body                               │
│   video → FrameflowCanvas           │
│   image → <img> preview             │
├─────────────────────────────────────┤
│  ○ source / target handles          │
└─────────────────────────────────────┘
     NodeResizer (shared rules)
```

**Structure**

| Piece | Role |
|-------|------|
| `MediaCardShell` | Resize, handles, context menu host |
| `MediaCardHeader` | Label, double-click rename (video) |
| `VideoCardBody` | Frameflow stack + frame capture registration |
| `ImageCardBody` | Static image preview |
| `storyboardTypes.ts` | Discriminated union node data |

```ts
type MediaNodeData =
  | { kind: 'video'; label: string; assetId?: string; src: string; lastFrame?: number }
  | {
      kind: 'image'
      label: string
      assetId?: string
      src: string
      naturalWidth?: number
      naturalHeight?: number
      sourceFrameIndex?: number
      extractedFromNodeId?: string
    }
```

- Single React Flow type `mediaCard` with `createVideoNode()` / `createImageNode()`.

---

### 3. Header interactions — done (with deviations)

#### Double-click rename

- Video: double-click header → inline input (Enter save, Escape cancel).
- Image: rename via context menu only (headerless cards).

#### Right-click context menu

| Action | Status | Notes |
|--------|--------|-------|
| Rename | ✓ | Video header or image body menu |
| Duplicate | ✓ | Node only — new id, +40/+40, same `assetId`, no edges |
| Delete | ✓ | Node + edges; best-effort asset GC |
| Extract frame | ✓ | Video only — see §4 |

**Context menu target (shipped):**

- **Video:** header only (avoids conflicting with scrub/playback).
- **Image:** body (no header).

Close on outside click / Escape.

**Image cards:** static preview only — edge-to-edge fill with aspect-correct node box (not `object-fit: contain`).

---

### 4. Extract current frame → image card — done

**Goal:** From a video card, capture the **currently displayed frame** (after scrub) as a new linked image reference.

**Flow**

1. User scrubs video to desired frame and **pauses**.
2. Context menu (video header) → **Extract frame**.
3. `FrameflowVideoProvider.captureCurrentFramePng()` draws the `<video>` element to an offscreen canvas → PNG blob.
4. `POST /api/assets` persists the PNG.
5. Spawns **image node** to the right of source (+40px gap).
6. Image `meta` stores `sourceFrameIndex` and `extractedFromNodeId`; label e.g. `"Shot 1 — frame 142"`. No auto-edge — connect manually if needed.

**Disabled when:** FPS probe incomplete, video playing, or no current frame.

**Implementation:** `VideoFrameCaptureRegistration.tsx`, `storyboardFrameCapture.ts`, `StoryboardPlayground.extractFrame`.

---

## Supported formats (explicit)

### Video (file drop / pick only)

- `video/mp4`
- `video/quicktime` (`.mov`)

### Image (file drop / pick + paste)

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `image/avif`
- `image/svg+xml`

### Not in V2

- Audio, PDF, HEIC, video paste from clipboard, URL fetch.

---

## 5. Persistence — local files + SQLite — done

**Decision:** V2 includes a **database and storage layer**. Media files live on **local disk** under UUID-based filenames; **SQLite** holds the storyboard graph and metadata.

### Storage layout

```
data/
  storyboard.db          # SQLite
  assets/
    {uuid}.mp4
    {uuid}.png
    ...
```

### API surface

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/board` | Load nodes + edges + asset refs |
| `PUT` | `/api/board` | Save graph (debounced ~500ms) |
| `POST` | `/api/assets` | Upload file → UUID on disk + row in `assets` |
| `DELETE` | `/api/assets/:id` | Remove file + row when unreferenced |
| `GET` | `/assets/:id` | Stream file for media playback |

### Client integration

- Ingest / extract → `POST /api/assets` → node with `assetId` + `/assets/{id}` URL.
- Duplicate shares `assetId`; delete reference-counts before `DELETE /api/assets/:id`.
- Load on mount; autosave on node/edge/label changes.
- Video `meta.lastFrame` persists scrub position across refresh.

### Tech

| Layer | Choice |
|-------|--------|
| Runtime | Bun `Bun.serve` + `bun:sqlite` |
| DB path | `data/storyboard.db` |
| Assets | `data/assets/{uuid}{ext}` |
| Dev | API `:3001`; Vite `:5173` proxies `/api` + `/assets` |

See root [README.md](../README.md) for `bun run dev`.

---

## Implementation phases

| Phase | Scope | Status |
|-------|--------|--------|
| **A — Foundation** | `MediaCardShell` + migrate video node | ✓ Done |
| **B — Card UX** | Rename, context menu (delete, duplicate) | ✓ Done |
| **P — Persistence** | Local API + SQLite + `data/assets/{uuid}` | ✓ Done |
| **C — Ingest** | Drop overlay + paste + upload | ✓ Done |
| **D — Image nodes** | `ImageCardBody` + create on drop/paste | ✓ Done |
| **E — Extract frame** | Capture API + image node | ✓ Done |

---

## Shipped deviations from original plan

| Original plan | Shipped |
|---------------|---------|
| Image cards share header | **Headerless** image cards; drag via image body |
| Context menu header-only | Video: header; Image: body |
| Image `object-fit: contain` | Edge-to-edge fill; node box preserves aspect |
| Extract menu on all video targets | Header-only (same as other video menu actions) |

**Extra (not in original checklist):** `meta.lastFrame` on video nodes restores scrub position after reload.

---

## Resolved decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Duplicate copies edges? | **No — node only** |
| 2 | Extract frame auto-connect? | **No** — image node only; optional manual edge |
| 3 | Persistence | **Yes** — UUID files + SQLite |
| 4 | Image card interactions | **Static preview only** |
| 5 | Drop placement | **Cursor / drop position** |

---

## Remaining polish (optional)

| Topic | Notes |
|-------|--------|
| Context menu keyboard nav | Escape only today |
| Paste MIME strictness | Extension allowlist backup exists; could tighten |
| Manual edge `kind` | Optional `extracted` if set manually; default connects have null kind |
| Export dimension cap | Not implemented; full video resolution PNG |
| Accessibility | Rename focus trap, menu roving tabindex |

---

## Success criteria for V2

- [x] User can drop `.mp4` / `.mov` onto board → new video card at drop point.
- [x] User can drop / paste common image formats → new image card.
- [x] Unsupported file → clear feedback, no crash.
- [x] Double-click header renames video cards; image rename via context menu.
- [x] Context menu: delete, duplicate; extract frame on video cards when ready.
- [x] Video and image cards share resize, handles, and styling (image cards omit header).
- [x] Board survives refresh (SQLite + asset files reload).
- [x] Upload stores `{uuid}.ext` on disk; graph references `asset_id`.
- [x] Duplicate creates node only (no edges); shares asset reference.
- [x] Extract frame → PNG asset + image node (no auto edge).
- [x] Image cards are static preview only.

---

## File layout (implemented)

```
server/                         — Bun API (Phase P)
  src/
    index.ts
    db.ts
    routes/board.ts
    routes/assets.ts
web/src/components/storyboard/
  StoryboardPlayground.tsx      — load/save, ingest, extract frame
  StoryboardFlow.tsx
  MediaCardShell.tsx
  MediaCardHeader.tsx
  VideoCardBody.tsx
  VideoFrameCaptureRegistration.tsx
  ImageCardBody.tsx
  StoryboardContextMenu.tsx
  StoryboardDropOverlay.tsx
  StoryboardCardActionsContext.tsx
  storyboardTypes.ts
  storyboardApi.ts
  storyboardIngest.ts
  storyboardFrameCapture.ts
  boardMapping.ts
  storyboard.css
web/src/frameflow/
  FrameflowVideoProvider.tsx    — captureCurrentFramePng()
data/                           — gitignored; sqlite + assets
docs/STORYBOARD_V2.md
```

---

## Decision log

| Date | Decision |
|------|----------|
| 2025-06 | V2 plan drafted from V1 playground retrospective |
| 2025-06 | Duplicate: node only, no edges |
| 2025-06 | Extract frame: auto-connect edge to source video |
| 2025-06 | Persistence: local disk + SQLite; not browser localStorage |
| 2025-06 | Image cards: static preview only in V2 |
| 2025-06 | Phase P implemented: `server/` (Bun + SQLite), repo split into `web/` + `server/` |
| 2025-06 | Phases A–E + P shipped; image cards headerless; video `lastFrame` persistence |
| 2025-06 | Extract frame: no auto-connect; image node only |

---

## Post-release cleanup (TODO)

After the **first public release**, remove pre-release backward-compatibility paths so the codebase matches a single supported schema:

| Area | Location | Remove |
|------|----------|--------|
| SQLite schema versioning | `server/src/db.ts` | `SCHEMA_VERSION`, `getUserVersion`, `migrate()`, `rebuildNodesTable()`, `nodesKindSupportsText()` repair |
| SQLite version stamp | `server/src/db.ts` | `PRAGMA user_version` reads/writes |

Keep only the canonical `SCHEMA` DDL in `getDb()`. Breaking schema changes after v1 should be explicit (major bump + documented migration or export/import), not open-ended incremental `version < N` steps.

There is no second schema-version system elsewhere in the repo today — persistence versioning lives only in `server/src/db.ts`.
