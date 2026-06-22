# Frameflow

Media storyboard playground with Frameflow video scrubbing — drag/drop references, link shots, and extract stills. Built as a **web + server** monorepo.

**Status:** Storyboard V2 shipped (persistence, ingest, image cards, extract frame). See [Storyboard V2](./docs/STORYBOARD_V2.md) for the full spec and decision log.

## What you get

- **Video cards** — per-node Frameflow scrub/playback; last scrubbed frame persists across refresh
- **Image cards** — drop, paste, or import stills; aspect-correct resize
- **Ingest** — drag & drop, file picker, clipboard paste (images)
- **Card actions** — rename, duplicate, delete; extract current video frame → linked image card
- **Persistence** — SQLite board + UUID asset files on disk; autosave (~500ms)

Open **`http://localhost:5173`** after starting dev (Vite proxies `/api` and `/assets` to the API).

## Structure

```
/
  web/                 React + Vite frontend (storyboard at `/`)
  server/              Bun API (SQLite + local asset files)
  data/                Runtime data (gitignored)
    storyboard.db
    assets/{uuid}.ext
  docs/
```

## Requirements

- [Bun](https://bun.sh) 1.2+ (server)
- Node/npm or Bun (web tooling)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) on `PATH` (Import from URL)
- [ffprobe](https://ffmpeg.org/) on `PATH` optional (aspect ratio probing; yt-dlp fallback)

## Development

From the **repo root** (starts API + web together):

```bash
bun install
bun run dev
```

This starts:

- **API** at `http://localhost:3001` (Bun + `bun:sqlite`)
- **Web** at `http://localhost:5173` (Vite)

Run individually:

```bash
bun run dev:server   # API only — port 3001
bun run dev:web      # Vite only — port 5173
```

**Port already in use?** If `EADDRINUSE` on 3001, a previous dev session is still running. Check and stop it:

```bash
lsof -i:3001
kill <PID>
```

Do not start `server/` dev while root `bun run dev` is already running — both bind to 3001.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/board` | Load nodes, edges, assets |
| `PUT` | `/api/board` | Replace board graph |
| `POST` | `/api/assets` | Upload file (`multipart/form-data`, field `file`) |
| `DELETE` | `/api/assets/:id` | Delete asset if unreferenced |
| `GET` | `/assets/:uuid.ext` | Serve stored media |

**Upload formats:** video `.mp4` / `.mov`; images JPEG, PNG, WebP, GIF, AVIF, SVG.

## Build

```bash
bun run build
```

Builds the web app only (`web/`). Run the server separately for a production-like setup (`bun run start:server`).

## Docs

- [Storyboard V2](./docs/STORYBOARD_V2.md) — feature spec, phases, success criteria
- [Frameflow architecture](./docs/FRAMEFLOW_COMPONENT_ARCHITECTURE.md) — video/canvas component design
- [Scrub strategies](./docs/SCRUB_SEEK_STRATEGIES.md) · [Trackpad scrub](./docs/TRACKPAD_SCRUB.md)
