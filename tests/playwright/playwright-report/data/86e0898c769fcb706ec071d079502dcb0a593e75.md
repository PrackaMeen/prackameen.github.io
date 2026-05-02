# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: place-hidden-tile.spec.js >> Hidden tile placement behavior >> shows the hidden preview and places the tile
- Location: specs\place-hidden-tile.spec.js:5:3

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: locator('.game-board-cell[data-x="1"][data-y="0"]')
Expected pattern: /game-board-cell--hidden-space/
Error: strict mode violation: locator('.game-board-cell[data-x="1"][data-y="0"]') resolved to 2 elements:
    1) <div data-x="1" data-y="0" role="gridcell" data-entity-kind="" data-orientation="0" class="game-board-cell game-board-cell--selected-target game-board-cell--hidden-space">…</div> aka getByRole('gridcell').nth(1)
    2) <div data-x="1" data-y="0" role="gridcell" class="game-board-cell game-board-cell--selected-target game-board-cell--temporary-preview">…</div> aka locator('.game-board-cell.game-board-cell--selected-target.game-board-cell--temporary-preview')

Call log:
  - Expect "toHaveClass" with timeout 5000ms
  - waiting for locator('.game-board-cell[data-x="1"][data-y="0"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner "Main navigation" [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - navigation "Breadcrumb"
        - generic [ref=e5]: Hidden tile preview.
      - generic "Build 1.1.27 (ae19bb8)" [ref=e6]: v1.1.27
  - main [ref=e7]:
    - main [ref=e8]:
      - generic "Map container" [ref=e9]:
        - generic [ref=e10]:
          - img
          - grid "Game board" [ref=e11]:
            - gridcell [ref=e12] [cursor=pointer]
            - gridcell [ref=e13] [cursor=pointer]
            - gridcell [ref=e14] [cursor=pointer]
            - gridcell [ref=e15] [cursor=pointer]
            - gridcell [ref=e16] [cursor=pointer]
            - gridcell [ref=e17] [cursor=pointer]
            - gridcell [ref=e18] [cursor=pointer]
            - gridcell [ref=e19] [cursor=pointer]
            - gridcell [ref=e20] [cursor=pointer]
            - gridcell
      - region "Action controls" [ref=e21]:
        - button "Cancel" [ref=e22] [cursor=pointer]
        - button "Place Tile" [ref=e23] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
  3  | 
  4  | test.describe('Hidden tile placement behavior', () => {
  5  |   test('shows the hidden preview and places the tile', async ({ page }) => {
  6  |     await installGameBoardStub(page, createGameBoardSession());
  7  | 
  8  |     await page.goto('/#/game-board');
  9  | 
  10 |     const hiddenTarget = page.locator('.game-board-cell[data-x="1"][data-y="0"]');
  11 |     await page.locator('.game-board-cell[data-x="1"][data-y="1"]').click();
  12 |     await page.locator('.game-board-cell[data-x="1"][data-y="0"]').click();
  13 | 
> 14 |     await expect(hiddenTarget).toHaveClass(/game-board-cell--hidden-space/);
     |                                ^ Error: expect(locator).toHaveClass(expected) failed
  15 |     await expect(page.getByText('Hidden tile preview.')).toBeVisible();
  16 | 
  17 |     await page.getByRole('button', { name: 'Place Tile' }).click();
  18 | 
  19 |     await expect(page.locator('.game-board-placement-preview')).toBeVisible();
  20 |     await expect(page.getByText('Tile ready to commit')).toBeVisible();
  21 |   });
  22 | });
```