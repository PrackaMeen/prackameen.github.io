# Repository Copilot Instructions

## PWA Versioning And Update Flow

For every change to this repository:

1. Increase the app code version.
2. Keep PWA version metadata aligned with app code version.
3. Change the single source of truth in `app-version.json`, then run `scripts/sync-pwa-version.ps1` so the shell, manifest, service worker, and GameWasm host all receive the same version.
4. Compare current running version with latest available version during update checks.
5. If current is older, prompt the user that a newer version is available.
6. Only after user confirmation, load/activate the latest version.
7. When version is increased, add a new release-notes item summarizing business/user-facing changes for that specific version.
8. Keep release-notes items in the repository and ensure the app can display them easily.
9. If changes touch `src/GameLogic` or the GameWasm build artifacts, republish GameWasm to `prackameen.github.io/assets/game-wasm` and increase the version because the deployed runtime changed.

This policy is mandatory for all update-related changes.