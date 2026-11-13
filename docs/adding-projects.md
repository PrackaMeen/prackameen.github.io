# Adding projects to the site

This repo builds one GitHub Pages site from several projects. This guide covers:

1. How the site is laid out
2. How to add a new game or app to the gallery
3. How other repos (such as OpenChess) trigger a rebuild
4. How to create the tokens and which permissions they need

Repo: `PrackaMeen/prackameen.github.io` · Live site: https://prackameen.github.io/

---

## 1. How the site is laid out

GitHub Pages replaces the entire site on every deploy. So all projects are built into one folder (`_site/`) by `.github/workflows/deploy-prackameen-pages.yml`, then deployed together.

| URL | Source in this repo | Built by |
|---|---|---|
| `/` | `gallery/index.html`, `gallery/projects.json` | copied as-is |
| `/arcade-lab/` | `app/` (Excalibur game) | `npm run build` in `app/` |
| `/chess/` | `PrackaMeen/OpenChess` (separate repo) | cloned and built by the workflow |

The gallery at `/` is data-driven. It reads `gallery/projects.json` and renders one card per entry. Adding a card needs only a JSON entry. Adding a new *build* needs a workflow change, described below.

---

## 2. Adding a new project

There are two cases. Pick the one that matches your project.

### Case A: The project is a static site or a Vite app in this repo

Example: a new game in `games/space-runner/`.

**Step 1: Make the build relative.** Use relative asset paths so the project works under a subpath. For Vite, set `base: "./"` in `vite.config.ts`. This is what `app/` already does.

**Step 2: Add a workflow step.** In `.github/workflows/deploy-prackameen-pages.yml`, add a build and copy step for your project, after the `Build app` step and before `Verify artifact layout`:

```yaml
      - name: Install space-runner dependencies
        working-directory: games/space-runner
        run: npm ci

      - name: Build space-runner
        working-directory: games/space-runner
        run: npm run build

      - name: Copy space-runner into site
        run: |
          mkdir -p _site/space-runner
          cp -R games/space-runner/dist/. _site/space-runner/
```

Then add its entry file to the list in the `Verify artifact layout` step. In that step, find the `for file in ...` line and append `_site/space-runner/index.html` to the list, so the build fails if the copy is missing.

**Step 3: Add a gallery card.** Add an entry to `gallery/projects.json`:

```json
{
  "title": "Space Runner",
  "description": "Short description of the game.",
  "path": "./space-runner/",
  "repo": "https://github.com/PrackaMeen/space-runner"
}
```

- `path` must match the folder name you copy to in `_site/`, with a trailing slash.
- `repo` is optional. Leave it out if the project has no public repo, and the card will show only the "Open" button.

**Step 4: Test locally.** From the repo root:

```bash
cd games/space-runner && npm ci && npm run build && cd ../..
rm -rf _site && mkdir -p _site/space-runner && cp -R games/space-runner/dist/. _site/space-runner/
cp gallery/index.html gallery/projects.json _site/
npx serve _site   # or any static server, then open http://localhost:3000/space-runner/
```

Check that the page loads with no 404s in the browser console.

**Step 5: Open a PR to `main`.** Pushes to `main` that change `app/**`, `gallery/**`, or the workflow file trigger a deploy. If your project lives somewhere else, add its folder to the `paths:` filter under `on: push:`, so a change to it triggers a deploy.

### Case B: The project lives in another repo

Example: OpenChess. The site build clones the other repo, builds it, and copies its output in. This requires a read token (see section 4).

1. Add a checkout step for the repo, like the `Checkout OpenChess` step. Use a separate `path:` and the `OPENCHESS_READ_TOKEN` secret, or no token if the repo is public.
2. Add a build step that matches that project's build tool.
3. Copy its output to `_site/<folder>/`.
4. Add a card to `gallery/projects.json`.
5. Make the other repo send a dispatch when it changes (section 3).

The project needs a static build. If it doesn't produce static files, it can't be hosted here as is.

---

## 3. Making changes appear quickly

Two things trigger a site build:

| Trigger | When it runs |
|---|---|
| `push` to `main` (for `app/**`, `gallery/**`, or the workflow file) | Immediately, on merge |
| `repository_dispatch` with type `openchess-updated` | Immediately, when another repo sends it |
| `schedule` (daily, 04:23 UTC) | Backup, in case a dispatch is missed |
| `workflow_dispatch` | Manually, from the Actions tab |

To make another repo trigger a rebuild, add this workflow to that repo, with a `PAGES_DISPATCH_TOKEN` secret (section 4). Change the `event_type` if you add a new project. Then add it to the `types:` list in this repo's workflow:

```yaml
name: Notify Pages site
on:
  push:
    branches: [main]
jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger prackameen.github.io deploy
        env:
          GH_TOKEN: ${{ secrets.PAGES_DISPATCH_TOKEN }}
        run: |
          curl -fsSL -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $GH_TOKEN" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/PrackaMeen/prackameen.github.io/dispatches \
            -d '{"event_type":"openchess-updated"}'
```

The dispatch only tells this repo to rebuild. It does not pass code or content.

---

## 4. Tokens and permissions

Both tokens are **fine-grained personal access tokens** created under the `PrackaMeen` account. Create them at **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.

Give each token the narrowest access that works, and set an expiration date. When a token expires, its job fails, and you need to create a new token and update the secret.

### Token 1: `OPENCHESS_READ_TOKEN` (read OpenChess during the build)

Used by the workflow's `Checkout OpenChess` step, so it can clone the repo.

| Setting | Value |
|---|---|
| Resource owner | `PrackaMeen` |
| Repository access | Only select repositories → `PrackaMeen/OpenChess` |
| Repository permissions → Contents | **Read-only** |
| Everything else | No access |

Save it as a **repository secret in `PrackaMeen/prackameen.github.io`**, named exactly `OPENCHESS_READ_TOKEN`. Not needed if OpenChess is public.

### Token 2: `PAGES_DISPATCH_TOKEN` (trigger a rebuild here)

Used by the notify workflow in OpenChess to call `POST /repos/PrackaMeen/prackameen.github.io/dispatches`.

| Setting | Value |
|---|---|
| Resource owner | `PrackaMeen` |
| Repository access | Only select repositories → `PrackaMeen/prackameen.github.io` |
| Repository permissions → Contents | **Read and write** |
| Everything else | No access |

Save it as a **repository secret in `PrackaMeen/OpenChess`**, named exactly `PAGES_DISPATCH_TOKEN`.

Contents write is what the dispatch endpoint needs for fine-grained tokens. Actions write isn't needed, because `repository_dispatch` isn't the same as `workflow_dispatch`.

### Rules for both tokens

- Never put a token in a file, commit, PR description, log, or chat.
- Never give a token access to more repositories than it needs.
- If a token leaks, delete it under **Fine-grained tokens** and create a new one.

---

## 5. Checking that it works

| Check | Where | Expected result |
|---|---|---|
| Deploy ran | Actions tab of `prackameen.github.io` | Green run of **Deploy prackameen.github.io** |
| Layout is complete | Build job, **Verify artifact layout** step | Passes |
| OpenChess checkout works | Build job, **Checkout OpenChess** step | Passes (fails with "not found" or 403 if the read token is wrong) |
| Dispatch works | **Notify Pages site** run in OpenChess | Green. A `401`/`403` means the token is wrong or lacks Contents write. A `404` means the repo name in the URL is wrong. |
| Site is up to date | `https://prackameen.github.io/` and `/chess/` | Shows the latest change |

---

## 6. Current state and pending changes

- The site builds OpenChess from `feature/poc-chess-core`, not `main`, until the pending change is merged. That change is on branch `feature/track-openchess-main`. It switches the default to `main` and should be merged only after OpenChess `main` contains the app code.
- OpenChess's `public/index.html` loads `../dist/src/app.js`. The workflow rewrites this to `./dist/src/app.js` during the build. Once OpenChess fixes the path itself, the rewrite can be removed.
- The `npm test` script in `app/` picks up a Playwright spec (`tests/playwright/`). It fails under vitest. Move the spec or add a vitest config that excludes it.
