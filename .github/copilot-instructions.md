# Repository Copilot Instructions

## PWA Versioning And Update Flow

For every change to this repository:

1. Increase the app code version.
2. Keep PWA version metadata aligned with app code version.
3. Compare current running version with latest available version during update checks.
4. If current is older, prompt the user that a newer version is available.
5. Only after user confirmation, load/activate the latest version.
6. When version is increased, add a new release-notes item summarizing business/user-facing changes for that specific version.
7. Keep release-notes items in the repository and ensure the app can display them easily.

This policy is mandatory for all update-related changes.