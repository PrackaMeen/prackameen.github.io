# Repository Copilot Instructions

## Scope
- This folder is a static PWA served directly from GitHub Pages.
- Edit the HTML, CSS, and JavaScript directly; there is no bundler or build step here.
- The page structure is documented in [README.md](../README.md).

## Versioning And Update Flow
- `app-version.json` is the single source of truth for the app version.
- When the version changes, run `scripts/sync-pwa-version.ps1` so `app.js`, `sw.js`, `index.html`, `manifest.webmanifest`, and the GameWasm host stay aligned.
- Every version bump needs a new `release-notes.json` entry with a business-focused summary.
- Runtime update checks must compare the current running version with the latest available version.
- If the latest version is newer, notify the user and wait for explicit confirmation before activating it.
- Do not use `skipWaiting()` during install.

## GameWasm And Cached Assets
- If changes touch `src/GameLogic` or the GameWasm build artifacts, republish GameWasm to `assets/game-wasm` and bump the app version because the shipped runtime changed.
- Version shared modules that are likely to be cached, especially `lib/game-assets.js` and the shell stylesheet reference in `index.html`.
- The game board should treat the runtime snapshot from `window.GameWasm` as the source of truth; if bootstrap session data is empty, fall back to `GameWasm.getState()` instead of starting from an empty participant list.
- Optional action coordinates use the `int.MinValue` sentinel in `Shared.ActionRequest` and `window.GameWasm.applyAction()`; do not change those checks to `>= 0`.

## Page Structure
- `app.js` owns routing and page loading.
- `pages/<page-name>/` contains `index.html`, `styles.css`, and `page.js`.
- `sw.js` must stay aligned with the app shell and static assets.

## References
- [README.md](../README.md)
- [docs/WEB_IMPLEMENTATION_SPEC.md](../docs/WEB_IMPLEMENTATION_SPEC.md)
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)