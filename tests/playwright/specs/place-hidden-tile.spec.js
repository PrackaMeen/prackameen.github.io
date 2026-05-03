import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
import { clickCanvasBoardCell } from '../helpers/canvas.js';

test.describe('Hidden tile placement behavior', () => {
  test('shows the hidden preview and places the tile', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession());

    await page.goto('/#/game-board');
    await expect(page.locator('.game-board-cell[data-x="1"][data-y="0"]')).toBeVisible();

    const canvas = page.locator('#gameBoardCanvas');
    const hiddenTarget = page.locator('.game-board-cell--hidden-space[data-x="1"][data-y="0"]').first();
    const temporaryPreview = page.locator('.game-board-cell--temporary-preview[data-x="1"][data-y="0"]');
    await clickCanvasBoardCell(page, canvas, 1, 1);
    await clickCanvasBoardCell(page, canvas, 1, 0);

    await expect(hiddenTarget).toHaveClass(/game-board-cell--hidden-space/);
    await expect(page.getByText('Hidden tile preview.')).toBeVisible();
    await expect(temporaryPreview).toHaveCount(1);

    await page.getByRole('button', { name: 'Place Tile' }).click();

    await expect(page.locator('.game-board-placement-preview')).toBeVisible();
    await expect(page.getByText('Tile ready to commit')).toBeVisible();
  });
});