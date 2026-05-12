# Canvas Rendering Transition Plan

**Project:** prackameen.github.io game board  
**Status:** Implemented, in Phase 4 hardening  
**Updated:** 2026-05-03  
**Audience:** Developers

## Summary

The board is now canvas-first.

The main game board renders terrain, entities, selection arrows, and hidden-tile previews through `renderer/game-board-canvas.js`. Click and touch input land on the canvas instead of the DOM cell grid, and the DOM shell remains focused on layout, HUD, and accessibility.

The old phased rollout language in this document is no longer accurate. The canvas path is shipped and verified; the remaining work is cleanup, verification hardening, and release/versioning discipline.

## Current Architecture

### Rendering

- `renderer/game-board-canvas.js` owns the main paint loop for terrain, entities, selection overlays, preview overlays, and camera synchronization.

### Input

- `pages/game-board/page.js` attaches click and touch listeners to the canvas.
- `renderer/pointer-to-tile.js` maps pointer coordinates into board coordinates.
- The board grid no longer acts as the interactive target.

### State ownership

- `renderer/board-interaction-controller.js` owns selection and preview state.
- `renderer/board-viewport-controller.js` owns zoom, pan, and camera math.
- `renderer/board-hud-controller.js` owns the action-bar labels and navigation message.
- `renderer/board-runtime-controller.js` owns WASM loading and hydration.
- `renderer/board-page-bootstrap.js` owns mount/dispose wiring, resize observation, and initial render hookup.
- `renderer/board-render-controller.js` owns session-to-viewport synchronization before the canvas render runs.
- `renderer/board-action-controller.js` owns move, rotate, and cancel action orchestration.
- `renderer/board-state-helpers.js` owns the shared board-state helper functions used by the page and controllers.
- `pages/game-board/page.js` now acts mainly as composition/wiring for the board controllers.
- The renderer modules do not mutate game state.

### Asset loading

- `lib/game-assets.js` is imported with a versioned query string so browser caches do not hide export-shape changes.
- Sprite metadata URLs preserve query strings when converting PNG URLs to JSON URLs.
- `prackameen.github.io/assets/game-wasm` remains the published runtime location.

## What Was Removed From The Old Plan

- The feature-flag rollout path is no longer relevant.
- The future-file examples for `renderer/loop.js`, `renderer/assets.js`, `renderer/input.js`, `flags.js`, and a stacked multi-canvas map shell no longer describe the actual implementation.
- The old DOM-per-tile rollout language no longer applies to this board.

## Remaining Cleanup

The board still has a little page-layer responsibility that can be split further:

- Keep the canvas as the only interactive board surface.
- Keep board-state markers out of the DOM unless they help tests or layout.
- Decide whether the remaining page composition should stay in `pages/game-board/page.js` or move into a higher-level board feature module.

## Verification Already In Place

- .NET solution build and verification pass.
- Full Playwright suite passes.
- Canvas input, hidden preview, revealed placement, revealed rotation, sprite loading, and animation behaviors all have browser coverage.
- The app version and release notes are kept in sync with the implementation changes.

## Practical Notes

- Keep the canvas as the only interactive board surface.
- Keep board state markers out of the DOM unless they help tests or layout.
- Any future change that touches `src/GameLogic` or `GameWasm` still requires republishing the WASM output and bumping the app version.

## Next Step

The next implementation step is Phase 4 hardening: remove any leftover DOM-only board assumptions that no longer help layout or tests, then run the broader verification matrix.
