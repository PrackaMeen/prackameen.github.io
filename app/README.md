# Excalibur Demo App (Arcade Lab)

TypeScript + Excalibur.js starter with a menu scene and a simple demo scene.
This app is published at `https://prackameen.github.io/arcade-lab/`.

## Scripts

- `npm run dev` to start the local Vite server
- `npm run build` to type-check and build for production (output in `dist/`)
- `npm run preview` to preview the production build
- `npm test` to run the unit tests (vitest)
- `npm run test:e2e` to run the Playwright specs in `tests/playwright/`

## Deployment layout

The site is one GitHub Pages artifact, assembled by
`.github/workflows/deploy-prackameen-pages.yml` at the repo root:

| URL path      | Source                                              |
|---------------|-----------------------------------------------------|
| `/`           | `gallery/index.html` + `gallery/projects.json`      |
| `/arcade-lab/`| this app: `npm run build` output (`app/dist/`)      |
| `/chess/`     | OpenChess: `tsc` output plus its static `public/`   |

Because a Pages deploy replaces the whole site, every project must be in the same artifact.

## How the build works

1. `npm ci` and `npm run build` run in `app/`.
2. `app/dist/` is copied to `_site/arcade-lab/`.
3. `gallery/` files are copied to `_site/`.
4. OpenChess is cloned into `openchess/` with the `OPENCHESS_READ_TOKEN` secret and built there.
5. The result is uploaded as the Pages artifact (`_site/`).

## Relative paths

`vite.config.ts` keeps `base: "./"`, so every asset URL in `dist/index.html` is relative
(`./assets/...`). The game therefore works under any subpath, including `/arcade-lab/`.
Do not switch to an absolute base such as `/` without also changing the deploy layout.

## Build output is not committed

`app/dist/`, `app/test-results/` and `app/tmp/` are ignored by git. CI builds `dist/` fresh.
Run `npm run build` locally if you need the output.
