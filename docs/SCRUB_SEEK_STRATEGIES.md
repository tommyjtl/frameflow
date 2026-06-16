# Seek-while-seeking strategies for frame scrubbing

When scrubbing frame-by-frame via `video.currentTime`, each step triggers an asynchronous pipeline:

```
currentTime = frameIndex / fps
  → seeking
  → decode
  → seeked
  → compositor presents frame
  → requestVideoFrameCallback (mediaTime)
```

Decode often takes longer than our scrub cadence (64 ms fast / 200 ms slow). If a new step fires while `video.seeking === true`, we must decide what to do with that intent.

## Philosophy A — Always show every +1 step

Never start the next seek until the previous one finished (`seeked`).

- **slow:** wait ≥1× playback frame duration after `seeked`, then ±1 frame
- **fast:** wait ≥½× playback frame duration after `seeked` (2× speed), then ±1 frame

While the user keeps dragging, steps **chain** off `seeked` events rather than stacking `currentTime` calls.

### A1 — Drop tick while seeking

If a step is due while `video.seeking`, skip it. That +1 intent is lost.

| Pros | Cons |
|------|------|
| Strict ±1 frame UX | Scrub slows under decode load |
| Simple | Fast drag may not keep up with 64 ms cadence |
| No wasted decode | UI can show `fast` while video steps slower |

### A2 — One deferred step (implemented)

If a step is due while `video.seeking`, set `deferredStep = true` (at most one; no backlog).

On `seeked`:

1. Record `lastSeekedAt`
2. If `deferredStep`, clear it and schedule one ±1 step after the tier interval
3. Else if still scrubbing with direction, schedule the next chained step

| Pros | Cons |
|------|------|
| Preserves ±1 frame fidelity | Still decode-bound at high speed |
| Recovers one missed tick under load | Not as aggressive as catch-up |
| Good fit for slow/fast = cadence, not jump size | |

**This demo uses a hybrid:**

- **Slow tier:** A2 — ±N frame, seeked-gated, 1× playback cadence. N = `round(videoFps / 24)` so 60fps steps ±3 frames (~same wall-clock as ±1 at 24fps).
- **Fast tier:** time-based Philosophy B — target frame advances with wall clock × `SCRUB_FAST_PLAYBACK_RATE`

### Frame step scaling

Scrub UX is defined in **wall-clock video time**, not raw frame count:

| Probed fps | Slow step (frames) | ~video time per step |
|------------|-------------------|----------------------|
| 24 | ±1 | ~42 ms |
| 48 | ±2 | ~42 ms |
| 60 | ±3 | ~50 ms |
| 120 | ±5 | ~42 ms |

Forward seek caps scale the same way (`15` frames at 24fps → `38` at 60fps).

### Fast-tier time scrub

While dragging fast, the target frame is:

```
target = anchorFrame + round(elapsedSeconds × fps × playbackRate × directionSign)
```

Re-anchors when direction changes. While `seeking`, the pending target keeps updating; on `seeked`, seeks toward the latest target (may skip frames). **Forward seeks are capped** (scaled from ~625 ms at 24fps) because long-GOP H.264 must decode from the previous keyframe.

Slow tier keeps strict A2 (+1 frame, one deferred step max).

---

## Philosophy B — Catch up to latest intent (interval-only variant)

While `video.seeking`, do not call `currentTime` again. Update a **pending target frame** (latest wins). On `seeked`, jump to the pending frame.

| Pros | Cons |
|------|------|
| Efficient; skips undisplayed frames | User may see +2/+3 jumps |
| Lands on latest intent when drag stops | Breaks strict one-frame-at-a-time |
| Good for coarse scrubbers | Frame counter may skip numbers |

---

## Philosophy C — Fire seeks regardless

Set `currentTime` on every tick even when `video.seeking === true`.

| Pros | Cons |
|------|------|
| Easiest to write | Browser may coalesce or ignore seeks |
| | Wasted decode on frames never shown |
| | Unpredictable across browsers |

**Not recommended** as a primary strategy.

---

## Display truth

Frame label (`142 / 720`) uses **rVFC `mediaTime`**, not the requested frame index, because `<video>` seeking is not frame-accurate.

## Throughput vs fidelity

If decode completes ~8 frames/sec, a 64 ms cadence (15 steps/sec) cannot show 15 distinct frames. Under load:

| Strategy | What the user sees |
|----------|-------------------|
| A1 / A2 | Fewer steps, each ±1; cadence stretches |
| B | Jumps of several frames to catch up |

## Related constants (demo)

| Constant | Value |
|----------|-------|
| `SCRUB_SLOW_PLAYBACK_RATE` | 1× (normal playback) |
| `SCRUB_FAST_PLAYBACK_RATE` | 2× playback |
| Step size | always ±1 frame |
| `resumeAfterScrub` | `false` (reserved for later) |

Interval per step: `(1000 / videoFps) / playbackRate` ms.

## Input gestures

| Gesture | Status | Doc |
|---------|--------|-----|
| Pointer drag on canvas overlay | Implemented | this file |
| Trackpad two-finger horizontal swipe | Deferred | [TRACKPAD_SCRUB.md](./TRACKPAD_SCRUB.md) |

Component layout and exports: [RVFC_COMPONENT_ARCHITECTURE.md](./RVFC_COMPONENT_ARCHITECTURE.md).
