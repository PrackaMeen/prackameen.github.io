# Canvas Rendering Transition Plan

**Project:** G.A.M.E Mobile Test Lab (`prackameen.github.io`)  
**Branch:** `gh-pages` (active implementation branch)  
**Status:** Proposed  
**Created:** 2026-05-02  
**Audience:** Developers · Product · Stakeholders

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Rationale — Why Move Away from DOM Tile Rendering](#2-rationale--why-move-away-from-dom-tile-rendering)
3. [Architecture Overview](#3-architecture-overview)
   - 3.1 [Render Loop](#31-render-loop)
   - 3.2 [Asset Loading & Sprite-Sheet Usage](#32-asset-loading--sprite-sheet-usage)
   - 3.3 [Layer Composition](#33-layer-composition)
   - 3.4 [Input Handling](#34-input-handling)
   - 3.5 [Update / Draw Separation](#35-updatedraw-separation)
4. [Phased Migration Strategy](#4-phased-migration-strategy)
   - Phase 0 — Preparation
   - Phase 1 — Parallel Canvas Renderer
   - Phase 2 — Feature-Flag Rollout
   - Phase 3 — DOM Removal & Cleanup
5. [Compatibility & Rollout Considerations](#5-compatibility--rollout-considerations)
6. [Testing & Verification](#6-testing--verification)
7. [Performance Validation Goals](#7-performance-validation-goals)
8. [Open Questions & Risks](#8-open-questions--risks)

---

## 1. Executive Summary

The current G.A.M.E Mobile Test Lab renders game state using individual DOM elements (stat cards rendered as `<article>` nodes, event feed items as `<li>` nodes). While this is appropriate for the current dashboard-style UI, the long-term product direction — multiple animated tile layers, Pixel Studio sprite-sheet exports, and a richer game map — makes a DOM-per-tile approach increasingly costly to maintain and scale.

This document proposes a structured, low-risk migration toward a **`<canvas>`-based rendering layer** for all tile/map content, while retaining the DOM for HUD elements (stats, event feed, buttons) where accessibility and CSS styling remain valuable.

**Expected benefits:**

| Benefit | Impact |
|---|---|
| Rendering performance | Significant — fewer layout/paint cycles |
| Sprite-sheet animation support | Native — `drawImage` clips directly from sheets |
| Multi-layer compositing | Clean — stacked `<canvas>` elements or single-pass layers |
| Developer velocity (new visual features) | Higher — no DOM node bookkeeping |
| Bundle/memory footprint (large maps) | Lower — one surface vs. hundreds of DOM nodes |

---

## 2. Rationale — Why Move Away from DOM Tile Rendering

### 2.1 Current approach

`app.js` builds the stats grid by cloning `<template id="statCardTemplate">` for each data item and appending it to `#statsGrid`. The event feed does the same with `<li>` elements in `#eventFeed`. For a dashboard this is fine, but as soon as a **tile map** is introduced the same pattern would produce one DOM node per cell — potentially thousands of live elements.

### 2.2 Scaling problems with DOM tiles

| Problem | Detail |
|---|---|
| **Layout thrashing** | Every tile position change triggers reflow across the grid |
| **Paint cost** | The browser composites each DOM tile as a separate layer when animated |
| **Sprite-sheet mismatch** | Pixel Studio exports rectangular sheet images; CSS `background-position` hacks are error-prone compared with `ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh)` |
| **Layer z-index complexity** | Ground + decoration + entity + effect layers require nested DOM trees and careful `z-index` management |
| **Event delegation complexity** | Click/touch hit-testing across thousands of sibling elements is slower than a single canvas hit-test function |
| **Memory pressure on mobile** | Each DOM node carries style, layout, and event metadata — costly on low-end devices targeted by the PWA |

### 2.3 Why canvas fits better

- **Single surface, full control** — one `requestAnimationFrame` loop draws everything in the correct order.
- **Native sprite-sheet support** — `CanvasRenderingContext2D.drawImage` accepts a source rectangle directly matching Pixel Studio's export format.
- **Layer compositing is trivial** — multiple `<canvas>` elements stacked with CSS `position: absolute`, or a single canvas with explicit draw-order within one frame.
- **Input is one listener** — a single `pointerdown`/`pointermove` handler on the canvas with coordinate math replaces scattered DOM event delegation.
- **PWA-friendly** — canvas content can be cached as `ImageBitmap` across frames, reducing GPU upload cost.

---

## 3. Architecture Overview

### 3.1 Render Loop

Replace ad-hoc DOM mutations with a **game-loop** driven by `requestAnimationFrame`:

```
┌─────────────────────────────────────────────┐
│  requestAnimationFrame(loop)                │
│                                             │
│  1. update(deltaTime)   ← game logic        │
│  2. draw(ctx)           ← canvas painting   │
│                                             │
│  loop reschedules itself                    │
└─────────────────────────────────────────────┘
```

Proposed module: `gh-pages/renderer/loop.js`

```js
// gh-pages/renderer/loop.js  (future file — not yet created)
let lastTime = 0;

export function startLoop(update, draw, ctx) {
  function tick(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100 ms
    lastTime = timestamp;
    update(dt);
    draw(ctx);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

For a turn-based game, the loop can be **on-demand** (only schedule a frame when state changes) rather than continuous, saving battery:

```js
export function scheduleFrame(draw, ctx) {
  requestAnimationFrame(() => draw(ctx));
}
```

### 3.2 Asset Loading & Sprite-Sheet Usage

#### Sprite-sheet export from Pixel Studio

Pixel Studio exports sprite sheets as PNG images paired with a JSON metadata file. The JSON describes each frame's position and size within the sheet:

```json
{
  "frames": {
    "grass_0": { "x": 0,  "y": 0,  "w": 16, "h": 16 },
    "grass_1": { "x": 16, "y": 0,  "w": 16, "h": 16 },
    "tree_0":  { "x": 0,  "y": 16, "w": 16, "h": 16 }
  },
  "meta": { "image": "tiles.png", "size": { "w": 128, "h": 128 } }
}
```

#### Asset loader module

Proposed module: `gh-pages/renderer/assets.js`

```js
// gh-pages/renderer/assets.js  (future file — not yet created)
const cache = new Map();

export async function loadSpriteSheet(pngUrl, jsonUrl) {
  const [img, meta] = await Promise.all([
    loadImage(pngUrl),
    fetch(jsonUrl).then(r => r.json())
  ]);
  const sheet = { img: await createImageBitmap(img), frames: meta.frames };
  cache.set(pngUrl, sheet);
  return sheet;
}

export function drawSprite(ctx, sheet, frameName, dx, dy, scale = 1) {
  const f = sheet.frames[frameName];
  ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, dx, dy, f.w * scale, f.h * scale);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

Sprite sheets should be listed in `sw.js` under `APP_SHELL` so they are pre-cached for offline use:

```js
// addition to gh-pages/sw.js  APP_SHELL array
"./assets/sprites/tiles.png",
"./assets/sprites/tiles.json",
```

### 3.3 Layer Composition

Use **stacked canvas elements** — one per logical layer — for clean separation and independent dirty-flagging:

```
┌──────────────────────────────────┐  z-index: 40  ← UI / HUD (DOM)
│  #hud  (DOM — stats, buttons)   │
├──────────────────────────────────┤  z-index: 30  ← Effects canvas
│  <canvas id="effectsLayer">     │
├──────────────────────────────────┤  z-index: 20  ← Entity canvas
│  <canvas id="entityLayer">      │
├──────────────────────────────────┤  z-index: 10  ← Decoration canvas
│  <canvas id="decorationLayer">  │
├──────────────────────────────────┤  z-index:  0  ← Ground canvas
│  <canvas id="groundLayer">      │
└──────────────────────────────────┘
```

All canvas layers share identical CSS dimensions:

```css
/* future addition to styles.css */
.canvas-layer {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none; /* only the topmost interactive layer captures events */
}
#entityLayer { pointer-events: auto; }
```

Static layers (ground, decoration) are only redrawn when the map scrolls or loads. Dynamic layers (entities, effects) redraw every relevant frame.

### 3.4 Input Handling

Replace per-element DOM listeners with a single canvas listener that maps pointer coordinates to tile coordinates:

```js
// gh-pages/renderer/input.js  (future file — not yet created)
export function attachInput(canvas, tileSize, onTileClick) {
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const col = Math.floor((e.clientX - rect.left) * scaleX / tileSize);
    const row = Math.floor((e.clientY - rect.top)  * scaleY / tileSize);
    onTileClick(col, row);
  });
}
```

Keyboard shortcuts and gamepad events are handled at the `window` level, unchanged from current behaviour.

### 3.5 Update / Draw Separation

Enforce a strict separation so that game logic never calls canvas APIs and renderers never mutate game state:

```
 ┌──────────┐   snapshots   ┌──────────────┐
 │  update  │ ─────────────▶│  draw        │
 │  (logic) │               │  (canvas)    │
 └──────────┘               └──────────────┘
       ▲
       │ input events
 ┌──────────┐
 │  input   │
 │  handler │
 └──────────┘
```

- `update(dt)` mutates the game state object (positions, animations, counters).
- `draw(ctx)` reads a **snapshot** of that state and paints it — it never writes back to state.
- This makes unit-testing logic possible without a canvas environment.

---

## 4. Phased Migration Strategy

### Phase 0 — Preparation *(~1 sprint)*

**Goal:** lay groundwork without changing any visible behaviour.

- [ ] Create `gh-pages/renderer/` directory for new modules.
- [ ] Create `gh-pages/assets/sprites/` directory; add a placeholder `tiles.png` and `tiles.json` (even if empty stubs).
- [ ] Add feature-flag support via `localStorage` key `GAME_FLAGS` (see §5).
- [ ] Extend `mock-api.js` to serve a stub tile-map payload (`/api/game/map`).
- [ ] Update `sw.js` `APP_SHELL` to include the new sprite asset paths.
- [ ] Document the Pixel Studio export settings (sheet size, frame naming convention, JSON format) in `docs/pixel-studio-export-guide.md`.
- [ ] Bump `app-version.json` and run `scripts/sync-pwa-version.ps1` only if any implementation files are touched; documentation-only changes do not require a version bump.

### Phase 1 — Parallel Canvas Renderer *(~2 sprints)*

**Goal:** build the canvas renderer behind a flag; existing DOM rendering remains the default.

- [ ] Implement `gh-pages/renderer/loop.js` — on-demand `requestAnimationFrame` scheduler.
- [ ] Implement `gh-pages/renderer/assets.js` — sprite-sheet loader with `ImageBitmap` caching.
- [ ] Implement `gh-pages/renderer/input.js` — pointer-to-tile coordinate mapper.
- [ ] Implement `gh-pages/renderer/layers.js` — factory that creates and stacks the four canvas elements inside a container `<div id="mapViewport">`.
- [ ] Implement `gh-pages/renderer/draw.js` — per-layer draw functions (`drawGround`, `drawDecorations`, `drawEntities`, `drawEffects`).
- [ ] Add `<div id="mapViewport">` to `index.html`; keep existing `#statsGrid` and `#eventFeed` panels intact (hybrid layout).
- [ ] Wire the canvas renderer in `app.js` only when the feature flag `canvas_renderer` is enabled.
- [ ] Verify that the DOM dashboard panels (stats, event feed) continue working regardless of flag state.
- [ ] Increment `app-version.json` when the first implementation file is committed to this phase.

### Phase 2 — Feature-Flag Rollout *(~1 sprint)*

**Goal:** expose the canvas renderer to real users progressively.

- [ ] Enable `canvas_renderer` flag by default for local/dev builds.
- [ ] Collect rendering metrics (FPS, frame budget, memory) — see §7.
- [ ] Fix any visual regressions found in Phase 1.
- [ ] Enable `canvas_renderer` flag by default for production build once metrics targets are met.
- [ ] Communicate the rollout in the release notes included in the next `app-version.json` bump.

### Phase 3 — DOM Removal & Cleanup *(~1 sprint)*

**Goal:** remove the old DOM tile-rendering code path entirely.

- [ ] Remove any tile-specific DOM code from `app.js` (keep HUD rendering — stats, event feed — as is).
- [ ] Remove the feature flag once canvas is the only renderer.
- [ ] Update `styles.css` — remove tile-grid styles that are no longer needed; add canvas-layer styles.
- [ ] Update `sw.js` cache name to invalidate old cached assets.
- [ ] Final version bump and release notes entry.

---

## 5. Compatibility & Rollout Considerations

### Feature flags

A lightweight flag system using `localStorage` avoids a dependency on a remote config service:

```js
// gh-pages/flags.js  (future file — not yet created)
const DEFAULTS = {
  canvas_renderer: false,   // Phase 1: off by default
  animated_sprites: false,  // Phase 1: off — enable in Phase 2
};

export function flag(name) {
  try {
    const stored = JSON.parse(localStorage.getItem("GAME_FLAGS") || "{}");
    return name in stored ? Boolean(stored[name]) : DEFAULTS[name] ?? false;
  } catch {
    return DEFAULTS[name] ?? false;
  }
}
```

Developers can override flags in DevTools console:

```js
localStorage.setItem("GAME_FLAGS", JSON.stringify({ canvas_renderer: true }));
location.reload();
```

### Progressive migration path

```
DOM-only (today)
    │
    ├─── flag OFF (default) ──→  DOM dashboard + no map canvas   [Phase 0–1]
    │
    ├─── flag ON  (opt-in)  ──→  DOM dashboard + canvas map      [Phase 1–2]
    │
    └─── flag removed       ──→  DOM dashboard + canvas map      [Phase 3]
```

### Browser compatibility

| Feature | Required | Coverage (global) |
|---|---|---|
| `<canvas>` 2D API | Yes | >97 % |
| `createImageBitmap` | Yes (asset loader) | >93 % |
| `requestAnimationFrame` | Yes | >98 % |
| `pointer` events | Yes (input) | >95 % |
| `localStorage` | Yes (flags) | >98 % |
| CSS `position: absolute` stacking | Yes (layers) | 100 % |

All required APIs are available in all modern browsers. The PWA already targets mobile-first, so no polyfills are expected to be needed.

### Service-worker cache strategy

When new sprite sheets are added or updated, the `CACHE_NAME` constant in `sw.js` must be incremented alongside `app-version.json`. This ensures users receive updated assets rather than serving stale sheets from the old cache.

---

## 6. Testing & Verification

### Unit tests (logic layer)

Because `update()` is pure (no canvas calls), it can be tested with any standard JS test runner without needing a browser:

- Tile coordinate math (e.g., pointer → tile grid position).
- Sprite-sheet frame lookup (`drawSprite` frame name resolution).
- Feature-flag parsing edge cases (`null` / malformed `localStorage`).

### Visual regression tests

Use a headless browser (e.g., Playwright) to:

1. Load `index.html` with `canvas_renderer` flag enabled.
2. Wait for the first frame to render.
3. Take a screenshot and compare against a stored baseline PNG.

Suggested threshold: ≤ 1 % pixel difference to account for sub-pixel rendering.

### Integration / smoke tests

| Scenario | Expected result |
|---|---|
| Load app with flag OFF | Existing DOM dashboard renders normally; no canvas elements present |
| Load app with flag ON | Canvas layers mount inside `#mapViewport`; stats/events DOM panels still present |
| Resize window | All canvas layers resize and redraw correctly |
| Offline mode (SW active) | Sprite sheets served from cache; rendering continues |
| Install PWA | App installs and renders correctly as standalone |
| Low-end device simulation | Frame budget stays within target (see §7) |

### Accessibility

DOM HUD panels (stats, event feed) must retain all existing ARIA attributes (`aria-live`, `role="status"`, `aria-labelledby`). Canvas layers should have `aria-hidden="true"` since visual game content is not screen-reader relevant; text equivalents remain in the DOM.

---

## 7. Performance Validation Goals

| Metric | Target | Measurement method |
|---|---|---|
| Frame rate (animation active) | ≥ 60 FPS on mid-range Android | Chrome DevTools Performance tab |
| Frame rate (static map) | 0 FPS (on-demand rendering) | Verify `rAF` not looping when idle |
| First paint (map visible) | ≤ 500 ms after API data arrives | `performance.mark` / DevTools |
| Memory (tile map, 20×20 grid) | ≤ 20 MB JS heap delta vs. baseline | Memory tab, heap snapshot |
| Layout/paint during tile update | 0 reflows | "Avoid large layout shifts" in Lighthouse |
| Lighthouse PWA score | ≥ 90 | Lighthouse CI |
| Lighthouse Performance score | ≥ 80 | Lighthouse CI |

Benchmarks should be captured on both a modern desktop browser and a simulated mid-range Android device (4× CPU slowdown in DevTools).

---

## 8. Open Questions & Risks

| # | Question / Risk | Owner | Status |
|---|---|---|---|
| 1 | What is the target tile size in pixels (16 px, 32 px, 64 px)? Affects sheet layout. | Design | Open |
| 2 | Will Pixel Studio export one sheet per layer type, or a single combined sheet? | Art | Open |
| 3 | Are animations frame-based (fixed FPS) or physics-based (delta-time)? | Design | Open |
| 4 | Does the map scroll, or is the viewport always fixed? Affects camera/offset logic. | Design | Open |
| 5 | Should the canvas renderer support WebGL in the future (e.g., PixiJS)? If yes, abstract the draw API now. | Architecture | Open |
| 6 | Risk: sprite-sheet load failure in offline mode if assets weren't pre-cached. Mitigation: add fallback solid-colour tile draw when `ImageBitmap` is unavailable. | Dev | Mitigated (plan) |
| 7 | Risk: canvas accessibility — game state changes invisible to screen readers. Mitigation: keep DOM live-regions for game events. | Dev | Mitigated (plan) |

---

## Appendix A — File Structure After Migration

```
gh-pages/
├── assets/
│   └── sprites/
│       ├── tiles.png          # Pixel Studio export
│       └── tiles.json         # Frame metadata (Pixel Studio JSON)
├── renderer/
│   ├── assets.js              # Sprite-sheet loader / ImageBitmap cache
│   ├── draw.js                # Per-layer draw functions
│   ├── input.js               # Pointer → tile coordinate mapper
│   ├── layers.js              # Canvas layer factory
│   └── loop.js                # requestAnimationFrame scheduler
├── flags.js                   # Feature flag helper
├── app.js                     # Wires DOM HUD + canvas renderer
├── index.html
├── mock-api.js                # Extended with /api/game/map stub
├── styles.css                 # Extended with .canvas-layer rules
├── sw.js                      # Updated CACHE_NAME + sprite asset paths
└── manifest.webmanifest
docs/
├── canvas-transition-plan.md  # This document
└── pixel-studio-export-guide.md  # (Phase 0 deliverable)
```

## Appendix B — Pixel Studio Export Checklist

Before exporting a sprite sheet from Pixel Studio, verify:

- [ ] **Tile size** is consistent across all frames (e.g., 16 × 16 px or 32 × 32 px).
- [ ] **Export format** is set to PNG (lossless, supports transparency).
- [ ] **JSON metadata** is exported alongside the PNG (Pixel Studio → Export → Sprite Sheet → include JSON).
- [ ] **Frame names** follow the convention `{type}_{variant}_{frame}` (e.g., `grass_0`, `grass_1`, `tree_idle_0`).
- [ ] **Sheet dimensions** are a power of two (e.g., 128 × 128, 256 × 256) for optimal GPU texture upload.
- [ ] The exported files are placed in `gh-pages/assets/sprites/` and added to `sw.js` `APP_SHELL`.

---

*This plan is a living document. Update it as design decisions are finalised and phases are completed.*
