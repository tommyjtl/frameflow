# Trackpad horizontal scrub (deferred)

**Status:** Not implemented. Documented for a future revisit.

**Related:** [SCRUB_SEEK_STRATEGIES.md](./SCRUB_SEEK_STRATEGIES.md) — seek pipeline used by pointer drag today.

---

## Goal

Add a second scrub input on the canvas overlay: **two-finger horizontal trackpad swipe** over the canvas, while the video is **paused**.

It should feel like pointer drag scrubbing:

- Same **direction** semantics (forward/back in the timeline)
- Same **slow / fast** tiers driving the same seek strategies
- Same stats row (`←` / `→`, tier, speed)
- Same idle timeout to end a scrub “session”

**Out of scope for v1 (when built):**

- Touch two-finger pan (phones/tablets)
- Mouse tilt-wheel / horizontal mouse wheel
- Scrubbing while the video is playing (both pointer and wheel would stay disabled until further notice)

---

## Why not literal “horizontal scroll” on the canvas?

The canvas shows a **single video frame**. There is no wide content to pan.

Making the canvas `overflow-x: auto` with invisible wide content would:

- Fake scroll position that does not map cleanly to frame index
- Fight layout and accessibility
- Still not solve trackpad input on its own

**Intended approach:** intercept **`wheel`** events on the overlay and translate `deltaX` into the existing scrub pipeline — same as drag, different input adapter.

---

## How trackpad input works (technical)

On macOS, a two-finger horizontal swipe over an element fires **`wheel`** events with non-zero **`deltaX`** (often with some `deltaY`).

```
User: two-finger swipe over canvas (video paused)
  → browser fires wheel { deltaX, deltaY, deltaMode, ... }
  → overlay listener (non-passive)
  → if |deltaX| > |deltaY|: consume gesture, map to scrub intent
  → else: ignore (allow vertical page scroll)
  → shared seek logic (attemptScrubStep, handleVideoSeeked, …)
```

### Session model (mirror pointer drag)

| Pointer drag | Trackpad wheel |
|--------------|----------------|
| `pointerdown` | First qualifying horizontal `wheel` while paused |
| `pointermove` | Each subsequent horizontal `wheel` |
| `pointerup` | No wheel events for `MOTION_IDLE_MS` (~50 ms) |
| Velocity from `clientX` | Velocity from accumulated `deltaX / Δt` |

On session start: pause video (already paused), set `isScrubbing`, reset fast-scrub anchor, reset throughput — same as `handleOverlayPointerDown`.

While a pointer drag is active (pointer captured), wheel events should be **ignored** so the two inputs do not fight.

### Direction

**Match pointer drag:** gesture that advances the timeline reads as `→` / forward; opposite as `←` / backward.

Sign of `deltaX` varies slightly by platform; calibrate once during implementation and invert if needed so wheel and drag agree.

### Speed tiers — separate presets

Pointer drag uses **px/s** from `clientX` deltas over a ~64 ms sample window.

Wheel uses **Δ/s** from summed `deltaX` over the same window.

Both answer “how fast horizontally,” but the numbers are **not interchangeable**. Plan separate thresholds:

| Input | Metric | Slow tier | Fast tier (example placeholders) |
|-------|--------|-----------|----------------------------------|
| Pointer drag | px/s | `0 … DRAG_FAST_MIN` | `≥ DRAG_FAST_MIN` (today: 1000) |
| Trackpad wheel | Δ/s | `0 … WHEEL_FAST_MIN` | `≥ WHEEL_FAST_MIN` (tune by feel) |

Same seek code after tier selection; only the cutoff constants differ.

UI can show `680 Δ/s` vs `412 px/s`, or a neutral label — cosmetic only.

### Shared code shape (future)

```
applyScrubIntent({ direction, tier })
  ↑
  ├── pointer move handler (existing)
  └── wheel handler (new)
```

No change to Philosophy A2 slow steps or fast-tier time scrub described in [SCRUB_SEEK_STRATEGIES.md](./SCRUB_SEEK_STRATEGIES.md).

---

## Blocker: macOS browser back / forward gestures

On Mac, in Safari and Chromium-based browsers, a **two-finger horizontal swipe** is often bound to **history navigation** (previous / next page), not only to scroll.

That conflicts directly with using horizontal swipe for in-app timeline scrub:

- The OS/browser may navigate **before** or **instead of** delivering `wheel` to the page
- `preventDefault()` on `wheel` is **not reliable** for suppressing history swipe across browsers
- There is no standard, portable API to disable history navigation for a subregion of the page while keeping trackpad swipe elsewhere

This is the primary reason implementation is **deferred**. Pointer drag avoids the conflict because it does not use the same system-level horizontal-swipe channel.

### Things to revisit later (not v1)

| Approach | Notes |
|----------|--------|
| `wheel` + `preventDefault()` on canvas only | Works in some cases; does **not** consistently block history swipe on macOS Safari/Chrome |
| `overscroll-behavior` | Helps scroll chaining; does **not** reliably block history navigation |
| Modifier key (e.g. hold **Shift** to scrub) | Avoids bare horizontal swipe; worse UX but reliable |
| Platform gate (enable wheel scrub only where history swipe is weak) | Fragile; hard to detect |
| Embedded / PWA with no history stack | May be safe in iframe or single-page shell with no back stack |
| User setting: “Use trackpad scrub (may conflict with browser back)” | Honest opt-in |
| Alternative input (keyboard arrows, on-screen slider) | No trackpad conflict |

Until one of these is acceptable product-wise, **pointer drag remains the only scrub gesture**.

---

## Implementation checklist (when revisiting)

- [ ] Confirm blocker on target browsers (Safari, Chrome, Firefox on macOS)
- [ ] Decide mitigation (modifier, opt-in, embedded-only, or accept conflict)
- [ ] Add non-passive `wheel` listener on `.frameflow-canvas-overlay`
- [ ] Gate: `video.paused && !pointerCaptureActive && fps ready`
- [ ] Filter: `|deltaX| > |deltaY|` and minimum `|deltaX|`
- [ ] Reuse motion sample window; separate `WHEEL_FAST_MIN` constant
- [ ] Reuse `scheduleMotionIdleReset` for session end
- [ ] Ignore wheel while `isPlaying`
- [ ] Update caption row to show Δ/s when last input was wheel (optional)
- [ ] Document any browser-specific quirks in this file

---

## Decision log

| Date | Decision |
|------|----------|
| 2025-06 | Design trackpad scrub via `wheel` / `deltaX`, not CSS scroll |
| 2025-06 | Match pointer drag direction; separate slow/fast thresholds for Δ/s vs px/s |
| 2025-06 | No scrubbing while video is playing (pointer or wheel) |
| 2025-06 | Trackpad only; no touch two-finger or mouse tilt-wheel in v1 |
| 2025-06 | **Deferred** — macOS history swipe conflicts with horizontal two-finger gesture |
