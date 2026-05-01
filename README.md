# G.A.M.E Mobile Test Lab (Static PWA)

This is a standalone static website for quick mobile testing.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Service Worker + Web App Manifest

## What It Does

- Mobile-first UI for fast sanity checks
- Installable PWA
- Offline app-shell caching
- API mock mode auto-enabled when hosted from GitHub Pages (`*.github.io`) or opened as local file (`file://`)
- Live mode on non-GitHub hosts (for the REST backend)

## No-Build Page Structure

This app is split by page and still serves directly from GitHub Pages (no bundler/build required).

- `index.html` is the static shell entry.
- `app.js` is the main router/loader.
- Each page lives in `pages/<page-name>/` with:
	- `index.html` (page markup)
	- `styles.css` (page styles)
	- `page.js` (page behavior)

Current route map:

- `#/single-player-game-settings` -> `pages/single-player-game-settings/*`
- `#/multiplayer-lobby-joined-game-settings` -> `pages/multiplayer-lobby-joined-game-settings/*`
- `#/multiplayer-host-game-settings` -> `pages/multiplayer-host-game-settings/*`
- `#/settings` -> `pages/settings/*`
- `#/release-notes` -> `pages/release-notes/*`

Navigation hierarchy is rendered as breadcrumb + level selectors:

- `menu > page > inner page`
- Menu tree: Single Player, Multiplayer, Settings, Release Notes

To add a page:

1. Create `pages/<new-page>/index.html`, `pages/<new-page>/styles.css`, and `pages/<new-page>/page.js`.
2. Add that page to the `PAGES` object in `app.js`.
3. Add the three files to `APP_SHELL` in `sw.js`.

## Run From Repo

Open `index.html` directly, or serve this folder with any static host.

## GitHub Pages

1. Publish this folder (`prackameen.github.io/`) via GitHub Pages.
2. Open the published URL on mobile.
3. The app will auto-use mock API endpoints for `/api/*` calls.

## REST Room Contract Used by Network UI

- `POST /api/rooms`
- `GET /api/rooms/waiting-to-start`
- `POST /api/rooms/{roomId}/start`
- `GET /api/rooms/active`
- `GET /api/rooms/{roomId}`
- `POST /api/rooms/{roomId}/join`
- `POST /api/rooms/{roomId}/heartbeat`

The Swagger/OpenAPI document is generated from the live Signaling Function endpoints, so the route list stays aligned with the code.

The network host/join screens use the Signaling Function REST API. The Admin page now uses the live room APIs for room listing and cleanup, and it can switch between local and live room backends when the local backend is available.

## PWA Versioning Policy

For every repository change, increment the app code version and keep PWA version metadata aligned.

Keep the canonical version in `app-version.json`, then run `scripts/sync-pwa-version.ps1` so `app.js`, `sw.js`, `index.html`, `manifest.webmanifest`, and the GameWasm bootstrap files all stay in sync.

When the app version is increased, add a new item to `release-notes.json` with a business-focused summary and user-visible highlights for that version/build.

At runtime, compare current running version with latest available version:

- If latest is newer, show an update notification.
- After user confirmation, activate/load the latest version.

Release notes are loaded from `release-notes.json` and displayed in-app on the Release Notes page.
