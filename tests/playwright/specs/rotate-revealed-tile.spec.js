import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Revealed tile rotation behavior', () => {
  test('rotates a pending revealed tile before commit', async ({ page }) => {
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
        tileOrientation: 0,
        allowedOrientations: [0, 1, 2, 3],
        entrySide: 'north',
        canCommit: true
      }
    }));

    await page.goto('/#/game-board');

    await expect(page.locator('.game-board-placement-preview__title')).toHaveText('direct-road · 0');
    await page.getByRole('button', { name: 'Rotate Right' }).click();
    await expect(page.locator('.game-board-placement-preview__title')).toHaveText('direct-road · 1');
  });
});