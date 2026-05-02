# Canvas Rendering Implementation Plan

## Goal

Keep the current application shell in HTML + CSS, keep game state and rules in the .NET WASM runtime, and move only the map viewport to a canvas renderer that draws PixelStudio sprite sheets.

The implementation should let us validate the work in small steps, with Playwright tests stored in the repo so the changes can be exercised locally as each phase lands.

## Target Structure

```text
HTML + CSS shell
├── navigation
├── HUD panels
├── stats and event feed
└── map container
    └── single <canvas> viewport

.NET WASM runtime
├── game state
├── rules and validation
├── tile and entity updates
└── render snapshot data

JavaScript canvas layer
├── sprite-sheet loading
├── frame lookup
├── draw loop
├── animation playback
└── input-to-tile mapping
```

## Code Quality Rules

- Keep renderer code split into small modules with focused exports and imports.
- Do not put the entire canvas system into one large JavaScript file.
- Reuse shared helpers for sprite-sheet lookup, coordinate math, and animation timing.
- Keep rendering code side-effect free where possible and make game state updates explicit.
- Put shared behavior such as the animation service under unit tests before wiring it into the page.
- Prefer data-driven rendering over duplicated per-tile conditionals.
- Keep .NET WASM as the source of truth for board state and action rules.

## Phase 0 - Baseline And Test Harness

### Transform

- Document the current DOM shell and the future canvas contract.
- Define the selectors that must remain stable: `#navRoot`, `#appRoot`, `#statsGrid`, `#eventFeed`, and the future `#mapViewport`.
- Add Playwright test scaffolding to the repo so the validation path is versioned with the code.
- Add a JS unit-test harness for shared renderer services so animation and sprite-sheet behavior can be exercised outside the browser.
- Keep all existing HTML, CSS, and .NET behavior unchanged.

### Validation

- Run a shell smoke test against the current PWA shell.
- Verify the menu page still mounts and the current route system still loads.
- Verify the tile-set demo page still renders.
- Verify the renderer service unit tests pass before any canvas wiring is merged.

## Phase 1 - Canvas Viewport Skeleton

### Transform

- Add the map viewport container to the page shell.
- Mount one canvas inside the map container.
- Keep HUD panels, navigation, and accessibility text in the DOM.
- Add canvas sizing logic so the viewport matches the layout container.
- Wire a minimal input bridge from pointer coordinates to tile coordinates.

### Validation

- Playwright should confirm the canvas container exists when the map route is active.
- Playwright should confirm the surrounding HTML shell is still visible and unaffected.
- Resize the browser and confirm the canvas remains aligned to its container.

## Phase 2 - Sprite-Sheet Asset Pipeline

### Transform

- Load PixelStudio PNG sprite sheets and matching JSON frame metadata.
- Cache sprite-sheet assets for reuse across frames.
- Resolve frame names to source rectangles.
- Draw static tiles first, then decorative tiles, then entities, then effects.
- Keep sprite-sheet loading, animation timing, and frame selection in reusable modules instead of inline page code.

### Validation

- Add a Playwright check that the renderer can resolve at least one named frame.
- Add a visual regression capture for the map viewport.
- Confirm missing sprite frames fail fast with a useful error.
- Add unit tests for sprite-sheet lookup, animation frame progression, and cache reuse.

## Phase 3 - Animation And WASM Bridge

### Transform

- Keep .NET WASM as the source of truth for tile, entity, and animation state.
- Have WASM emit a render snapshot that the canvas layer reads.
- Advance animations in the renderer based on the snapshot and elapsed time.
- Keep update logic separate from draw logic.
- Put animation state and frame advancement behind a dedicated service or module that can be unit-tested without a browser.

### Validation

- Verify that state updates from WASM produce a redraw without touching DOM tiles.
- Verify animation frame advancement on a timer or on state change.
- Verify input events can be translated back into game actions.
- Verify animation service behavior with deterministic unit tests for frame stepping, looping, and reset behavior.

## Phase 4 - Cleanup And Hardening

### Transform

- Remove old tile-specific DOM rendering paths.
- Leave the HTML + CSS shell intact for HUD and accessibility.
- Keep the service worker cache aligned with sprite-sheet versions.
- Finalize release notes and version updates for the shipped runtime.

### Validation

- Run the full Playwright suite.
- Run a resize test, an offline-cache test, and an accessibility smoke test.
- Confirm no DOM map tiles remain in the final route.

## Playwright Validation Matrix

Each Playwright spec runs twice: once in `desktop-fullhd` (1920 x 1080) and once in `mobile-s25` (412 x 915).

| Test file | Purpose | Phase |
|---|---|---|
| `tests/playwright/specs/app-shell.spec.js` | Confirms the app shell and current routes still mount | 0 |
| `tests/playwright/specs/move-player.spec.js` | Confirms revealed-tile player movement | 1 |
| `tests/playwright/specs/place-hidden-tile.spec.js` | Confirms hidden-tile preview and placement | 1 |
| `tests/playwright/specs/rotate-revealed-tile.spec.js` | Confirms revealed-tile rotation before commit | 1 |
| `tests/playwright/specs/place-revealed-tile.spec.js` | Confirms revealed-tile commit and player movement | 1 |
| `tests/playwright/specs/tile-animation.spec.js` | Confirms entity tile animation classes | 2 |

## Acceptance Criteria

- The app shell continues to render as HTML + CSS.
- The map viewport moves to a single canvas surface.
- Sprite sheets are loaded from PixelStudio PNG + JSON pairs.
- .NET WASM remains the owner of game state and rules.
- Playwright tests live in the repo and can be run locally.
- Shared renderer services, especially animation logic, are covered by unit tests in the repo.
- The implementation stays modular and does not collapse into a single monolithic JavaScript file.

## How To Run Validation

1. Start the local static server for `prackameen.github.io`.
2. Install Playwright dependencies in `prackameen.github.io/tests/playwright`.
3. Run the renderer service unit tests.
4. Run `npm test` from `prackameen.github.io/tests/playwright`.
5. Review the smoke test output before enabling the next phase.

## Notes

- The canvas work should be introduced behind a small contract, not by rewriting the whole UI.
- DOM remains the right place for layout, text, and accessibility.
- Canvas remains the right place for tile rendering, animation, and sprite-sheet compositing.