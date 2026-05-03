import { expect, test } from '@playwright/test';

test.describe('App shell smoke tests', () => {
  test('loads the menu shell', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Menu');
    await expect(page.locator('#navRoot')).toBeVisible();
    await expect(page.locator('#appRoot')).toBeVisible();
  });

  test('opens the tile set demo route', async ({ page }) => {
    await page.goto('/#/tile-set-demo');

    await expect(page).toHaveTitle('Tile Set Demo');
    await expect(page.locator('#tileSetGrid')).toBeVisible();
  });
});