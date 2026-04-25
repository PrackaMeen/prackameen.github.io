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
- Live mode on non-GitHub hosts (for future .NET API)

## Run From Repo

Open `index.html` directly, or serve this folder with any static host.

## GitHub Pages

1. Publish the `web-pwa/` folder via GitHub Pages.
2. Open the published URL on mobile.
3. The app will auto-use mock API endpoints for `/api/*` calls.

## API Contract Used by UI

- `GET /api/game/state`
- `GET /api/game/events`
- `POST /api/game/action`

In mock mode, all three are handled client-side by `mock-api.js`.

## PWA Versioning Policy

For every repository change, increment the app code version and keep PWA version metadata aligned.

At runtime, compare current running version with latest available version:

- If latest is newer, show an update notification.
- After user confirmation, activate/load the latest version.
