import { expect, test } from '@playwright/test';

test.describe('Offline shell caching', () => {
  test('reloads the shell from the service worker cache while offline', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Menu');
    await expect(page.locator('#navRoot')).toBeVisible();
    await expect(page.locator('#appRoot')).toBeVisible();

    await page.reload();
    await expect.poll(async () => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await page.context().setOffline(true);

    try {
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page).toHaveTitle('Menu');
      await expect(page.locator('#navRoot')).toBeVisible();
      await expect(page.locator('#appRoot')).toBeVisible();
    } finally {
      await page.context().setOffline(false);
    }
  });
});