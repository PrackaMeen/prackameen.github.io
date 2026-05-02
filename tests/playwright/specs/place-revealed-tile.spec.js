import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Revealed tile placement behavior', () => {
  test('commits a revealed tile and moves the player', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession({
      revealedTarget: true,
      pendingPlacement: {
        actorId: 1,
        sourceX: 1,
        sourceY: 1,
        targetX: 1,
        targetY: 0,
        tileKind: 'direct-road',
        originalOrientation: 0,
        tileOrientation: 1,
        allowedOrientations: [0, 1, 2, 3],
        entrySide: 'north',
        canCommit: true
      }
    }));

    await page.goto('/#/game-board');

    await page.getByRole('button', { name: 'Place & Move' }).click();

    await expect(page.locator('.game-board-cell--active-player[data-x="1"][data-y="0"]')).toHaveCount(1);
    await expect(page.locator('.game-board-placement-preview')).toHaveCount(0);
  });
});