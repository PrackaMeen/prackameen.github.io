# Canvas Rendering Transition Plan

**Project:** prackameen.github.io game board  
**Status:** Implemented, with only the DOM board renderer left in the page module  
**Updated:** 2026-05-03  
**Audience:** Developers

## Summary

The board is now canvas-first.

The main game board renders terrain and entities through `renderer/game-board-canvas.js`, while selection arrows and hidden-tile previews render through `renderer/game-board-overlay-canvas.js`. Click and touch input land on the canvas instead of the DOM cell grid, and the remaining DOM board is only a structural/state surface for layout, accessibility, and test selectors.

The old phased rollout language in this document is no longer accurate. The canvas path is shipped and verified; the remaining work is the page-owned DOM board renderer that still turns board state into grid cells.

## Current Architecture

### Rendering

- `renderer/game-board-canvas.js` owns the main paint loop for revealed tiles, hidden tiles, entities, and grid lines.
- `renderer/game-board-overlay-canvas.js` owns the move arrow and hidden-tile preview overlay.
- `renderer/game-board-draw-plan.js` keeps board drawing deterministic by converting board state into drawable entries.
- `renderer/game-board-painter.js` paints the draw plan onto the canvas context.

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
- `renderer/board-action-controller.js` owns move, rotate, and cancel action orchestration.
- `renderer/board-state-helpers.js` owns the shared board-state helper functions used by the page and controllers.
- `pages/game-board/page.js` still owns the DOM board renderer that turns current state into cells and canvas layers.
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

- Decide whether the DOM board renderer should stay in `pages/game-board/page.js` or move into a dedicated renderer helper.
- Keep the DOM board pointer-transparent; the canvas is the hit target.
- Keep board state markers on the DOM only when they help tests or layout.

## Verification Already In Place

- .NET solution build and verification pass.
- Full Playwright suite passes.
- Canvas input, hidden preview, revealed placement, revealed rotation, sprite loading, and animation behaviors all have browser coverage.
- The app version and release notes are kept in sync with the implementation changes.

## Practical Notes

- Keep the DOM board pointer-transparent; the canvas is the hit target.
- Keep overlay visuals on the overlay canvas so the main board renderer stays focused on terrain and entities.
- Keep board state markers on the DOM only when they help tests or layout.
- Any future change that touches `src/GameLogic` or `GameWasm` still requires republishing the WASM output and bumping the app version.

## Next Step

The next implementation step is to decide whether `renderBoard` should stay in `pages/game-board/page.js` or move into a separate board-render helper.
