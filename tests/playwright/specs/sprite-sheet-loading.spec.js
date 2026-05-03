import { expect, test } from '@playwright/test';

import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0lp0QAAAAASUVORK5CYII=';

test.describe('Sprite-sheet asset loading', () => {
  test('requests sprite PNG and JSON assets for revealed board tiles', async ({ page }) => {
    const requestedUrls = [];
    const versionTag = `sprite-sheet-loading-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const spriteMetadata = {
      frames: {
        default: { frame: { x: 0, y: 0, w: 1, h: 1 } }
      }
    };

    await page.addInitScript((tag) => {
      window.__GAME_VERSIONED_ASSET_URL__ = (assetPath) => `${assetPath}?v=${encodeURIComponent(tag)}`;
    }, versionTag);

    await page.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      const pathname = new URL(requestUrl).pathname;

      if (pathname.endsWith('.png')) {
        requestedUrls.push(requestUrl);
        await route.fulfill({
          contentType: 'image/png',
          body: Buffer.from(TRANSPARENT_PNG_BASE64, 'base64')
        });
        return;
      }

      if (pathname.endsWith('.json')) {
        requestedUrls.push(requestUrl);
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(spriteMetadata)
        });
        return;
      }

      await route.continue();
    });

    await installGameBoardStub(page, createGameBoardSession({
      revealedTarget: true,
      monster: { x: 2, y: 1 },
      revealedTiles: [
        { x: 1, y: 1 },
        { x: 2, y: 1 }
      ]
    }));

    await page.goto('/#/game-board');

    await expect(page.locator('#gameBoardCanvas')).toBeVisible();
    await expect.poll(() => requestedUrls.some((url) => new URL(url).pathname.endsWith('.json'))).toBe(true);
    await expect.poll(() => requestedUrls.some((url) => new URL(url).pathname.endsWith('.png'))).toBe(true);
    await expect(page.locator('.game-board-cell[data-x="1"][data-y="1"]')).toBeVisible();
  });
});