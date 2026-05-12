import { expect, test } from '@playwright/test';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';
import { clickCanvasBoardCell } from '../helpers/canvas.js';

test.describe('Hidden tile placement behavior', () => {
  test('discovers, rotates, and commits the hidden tile placement', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession());

    await page.goto('/#/game-board');

    const canvas = page.locator('#gameBoardCanvas');
    await clickCanvasBoardCell(page, canvas, 1, 1);
    await clickCanvasBoardCell(page, canvas, 1, 0);

    await expect(page.getByText('Hidden tile preview.')).toBeVisible();

    let session = await page.evaluate(() => window.__GAME_SESSION__);
    expect(session.pendingPlacement).toBeNull();

    await expect(page.getByRole('button', { name: 'Place Tile' })).toBeEnabled();

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

    session = await page.evaluate(() => window.__GAME_SESSION__);
    expect(session.pendingPlacement.tileOrientation).toBe(2);

    await page.getByRole('button', { name: 'Place & Move' }).click();

    await expect(page.locator('.game-board-placement-preview')).toHaveCount(0);
    await expect(page.getByText('Tile placement committed.')).toBeVisible();

    session = await page.evaluate(() => window.__GAME_SESSION__);
    expect(session.players[0].x).toBe(1);
    expect(session.players[0].y).toBe(0);
    expect(session.pendingPlacement).toBeNull();
  });

});