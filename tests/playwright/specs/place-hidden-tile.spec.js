import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
import { clickCanvasBoardCell } from '../helpers/canvas.js';

test.describe('Hidden tile placement behavior', () => {
  test('discovers, rotates, and commits the hidden tile placement', async ({ page }) => {
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
    await expect(page.getByText('Tile placed. Rotate it to continue.')).toBeVisible();
    await expect(page.locator('.game-board-placement-preview__title')).toHaveText('direct-road · 0');
    await expect(page.getByRole('button', { name: 'Rotate Left' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place & Move' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rotate Right' })).toBeVisible();

    await page.getByRole('button', { name: 'Rotate Right' }).click();
    await expect(page.locator('.game-board-placement-preview__title')).toHaveText('direct-road · 1');

    await page.getByRole('button', { name: 'Rotate Right' }).click();
    await expect(page.locator('.game-board-placement-preview__title')).toHaveText('direct-road · 2');

    await page.getByRole('button', { name: 'Place & Move' }).click();

    await expect(page.locator('.game-board-cell--active-player[data-x="1"][data-y="0"]')).toHaveCount(1);
    await expect(page.locator('.game-board-placement-preview')).toHaveCount(0);
    await expect(page.getByText('Tile placement committed.')).toBeVisible();
  });

  test('supports a second hidden placement after moving the player', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession());

    await page.goto('/#/game-board');

    const canvas = page.locator('#gameBoardCanvas');
    await expect(page.locator('.game-board-cell[data-x="1"][data-y="0"]')).toBeVisible();

    await clickCanvasBoardCell(page, canvas, 1, 1);
    await clickCanvasBoardCell(page, canvas, 1, 0);
    await page.getByRole('button', { name: 'Place Tile' }).click();
    await page.getByRole('button', { name: 'Place & Move' }).click();

    await expect(page.locator('.game-board-cell--active-player[data-x="1"][data-y="0"]')).toHaveCount(1);

    await clickCanvasBoardCell(page, canvas, 1, 0);
    let secondPlacementPreviewed = false;
    for (const [x, y] of [[2, 0], [1, 1], [0, 0], [1, 2]]) {
      await clickCanvasBoardCell(page, canvas, x, y);

      try {
        await expect(page.getByText('Hidden tile preview.')).toBeVisible({ timeout: 1000 });
        secondPlacementPreviewed = true;
        break;
      } catch {
        continue;
      }
    }

    expect(secondPlacementPreviewed).toBe(true);
    await page.getByRole('button', { name: 'Place Tile' }).click();

    await expect(page.locator('.game-board-placement-preview')).toHaveCount(1);
    await expect(page.locator('.game-board-placement-preview__title')).toHaveCount(1);
    await expect(page.getByText('Tile placed. Rotate it to continue.')).toBeVisible();
  });
});