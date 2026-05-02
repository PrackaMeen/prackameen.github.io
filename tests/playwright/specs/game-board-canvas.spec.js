import { expect, test } from '@playwright/test';

import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Game board canvas host', () => {
  test('mounts the canvas between the shell controls', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession());
    await page.goto('/#/game-board');

    const canvas = page.locator('#gameBoardCanvas');

    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#gameBoardStage')).toBeVisible();
    await expect(page.locator('.game-board-action-bar')).toBeVisible();
  });
});