import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
import { clickCanvasBoardCell } from '../helpers/canvas.js';

test.describe('Move player behavior', () => {
  test('moves the active player to a revealed tile', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession({
      revealedTarget: true
    }));

    await page.goto('/#/game-board');

    const canvas = page.locator('#gameBoardCanvas');
    await clickCanvasBoardCell(page, canvas, 1, 1);
    await clickCanvasBoardCell(page, canvas, 1, 0);
    await clickCanvasBoardCell(page, canvas, 1, 0);

    const session = await page.evaluate(() => window.__GAME_SESSION__);
    expect(session.players[0].x).toBe(1);
    expect(session.players[0].y).toBe(0);
    expect(session.pendingPlacement).toBeNull();
  });
});