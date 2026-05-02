# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tile-animation.spec.js >> Tile animation behavior >> applies the pop animation to player and monster entities
- Location: specs\tile-animation.spec.js:5:3

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator: locator('.game-board-cell[data-x="1"][data-y="1"] .game-board-cell__layer--player')
Expected: "tile-pop"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for locator('.game-board-cell[data-x="1"][data-y="1"] .game-board-cell__layer--player')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner "Main navigation" [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - navigation "Breadcrumb"
        - generic [ref=e5]: Click Player A to select it.
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
      - region "Action controls" [ref=e21]:
        - button "Cancel" [disabled] [ref=e22]
        - button "Place Tile" [disabled] [ref=e23]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
  3  | 
  4  | test.describe('Tile animation behavior', () => {
  5  |   test('applies the pop animation to player and monster entities', async ({ page }) => {
  6  |     await installGameBoardStub(page, createGameBoardSession({
  7  |       monster: { x: 2, y: 1 }
  8  |     }));
  9  | 
  10 |     await page.goto('/#/game-board');
  11 | 
  12 |     const playerLayer = page.locator('.game-board-cell[data-x="1"][data-y="1"] .game-board-cell__layer--player');
  13 |     const monsterLayer = page.locator('.game-board-cell[data-x="2"][data-y="1"] .game-board-cell__layer--monster');
  14 | 
> 15 |     await expect(playerLayer).toHaveCSS('animation-name', 'tile-pop');
     |                               ^ Error: expect(locator).toHaveCSS(expected) failed
  16 |     await expect(monsterLayer).toHaveCSS('animation-name', 'tile-pop');
  17 |   });
  18 | });
```