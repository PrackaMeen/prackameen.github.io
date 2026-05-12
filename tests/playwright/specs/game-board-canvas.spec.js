import { expect, test } from '@playwright/test';

import { expectCanvasToMatchHost } from '../helpers/canvas.js';
import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Game board canvas host', () => {
  test('mounts the canvas inside the map wrapper', async ({ page }) => {
    await installGameBoardStub(page, createGameBoardSession());
    await page.goto('/#/game-board');

    const canvas = page.locator('#gameBoardCanvas');
    const map = page.locator('#gameBoardMap');
    const stage = page.locator('#gameBoardStage');

    await expectCanvasToMatchHost(canvas, map);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(stage).toBeVisible();
    await expect(page.locator('.game-board-action-bar')).toBeVisible();

    await expect(map.locator('canvas')).toHaveCount(1);

    const nonCanvasChildren = await map.evaluate((element) =>
      Array.from(element.children).filter((child) => child.tagName !== 'CANVAS').length
    );
    expect(nonCanvasChildren).toBe(0);
  });
});