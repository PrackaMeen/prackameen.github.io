import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Tile animation behavior', () => {
  test('renders player and monster sprites on the canvas', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession({
      monster: { x: 2, y: 1 },
      revealedTiles: [
        { x: 1, y: 1 },
        { x: 2, y: 1 }
      ]
    }));

    await page.goto('/#/game-board');
    await expect(page.locator('#gameBoardCanvas')).toBeVisible();

    const session = await page.evaluate(() => window.__GAME_SESSION__);
    expect(session.board.some((cell) => cell.entityKind === 'player')).toBe(true);
    expect(session.board.some((cell) => cell.entityKind === 'monster')).toBe(true);
  });

});