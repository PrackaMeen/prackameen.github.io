import { expect, test } from '@playwright/test';

import { createGameBoardSession, installGameBoardStub } from '../helpers/game-board.js';

test.describe('Accessibility smoke', () => {
  test('exposes accessible shell and board landmarks', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('banner', { name: 'Main navigation' })).toBeVisible();
    await expect(page.locator('#appRoot')).toBeVisible();

    await installGameBoardStub(page, createGameBoardSession());
    await page.goto('/#/game-board');

    await expect(page.getByRole('banner', { name: 'Main navigation' })).toBeVisible();
    await expect(page.locator('#appRoot')).toBeVisible();
    await expect(page.locator('#gameBoardStage')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Action controls' })).toBeVisible();
    await expect(page.locator('#gameBoardCanvas')).toHaveAttribute('aria-hidden', 'true');
  });
});