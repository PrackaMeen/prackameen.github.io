import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Hidden tile placement behavior', () => {
  test('shows the hidden preview and places the tile', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession());

    await page.goto('/#/game-board');

    const hiddenTarget = page.locator('.game-board-cell[data-x="1"][data-y="0"]');
    await page.locator('.game-board-cell[data-x="1"][data-y="1"]').click();
    await page.locator('.game-board-cell[data-x="1"][data-y="0"]').click();

    await expect(hiddenTarget).toHaveClass(/game-board-cell--hidden-space/);
    await expect(page.getByText('Hidden tile preview.')).toBeVisible();

    await page.getByRole('button', { name: 'Place Tile' }).click();

    await expect(page.locator('.game-board-placement-preview')).toBeVisible();
    await expect(page.getByText('Tile ready to commit')).toBeVisible();
  });
});