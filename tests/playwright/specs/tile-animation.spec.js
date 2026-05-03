import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Tile animation behavior', () => {
  test('applies the pop animation to player and monster entities', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession({
      monster: { x: 2, y: 1 },
      revealedTiles: [
        { x: 1, y: 1 },
        { x: 2, y: 1 }
      ]
    }));

    await page.goto('/#/game-board');

    const playerLayer = page.locator('.game-board-cell[data-x="1"][data-y="1"] .game-board-cell__layer--player');
    const monsterLayer = page.locator('.game-board-cell[data-x="2"][data-y="1"] .game-board-cell__layer--monster');

    await expect(playerLayer).toHaveCSS('animation-name', 'tile-pop');
    await expect(monsterLayer).toHaveCSS('animation-name', 'tile-pop');
  });
});