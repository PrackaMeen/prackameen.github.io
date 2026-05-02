import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Move player behavior', () => {
  test('moves the active player to a revealed tile', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession({
      revealedTarget: true
    }));

    await page.goto('/#/game-board');

    await page.locator('.game-board-cell[data-x="1"][data-y="1"]').click();
    await page.locator('.game-board-cell[data-x="1"][data-y="0"]').click();
    await page.getByRole('button', { name: 'Confirm Move' }).click();

    await expect(page.locator('.game-board-cell--active-player[data-x="1"][data-y="0"]')).toHaveCount(1);
    await expect(page.locator('.game-board-cell--active-player[data-x="1"][data-y="1"]')).toHaveCount(0);
  });
});