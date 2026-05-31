import { expect, test } from '@playwright/test';

test.describe('Animations preview page', () => {
  test('opens from the menu and shows an animation preview canvas', async ({ page }) => {
    await page.goto('/#/animations');

    await expect(page).toHaveTitle('Animations');
    await expect(page.locator('#animationSelect')).toBeVisible();
    await expect(page.locator('#animationCanvas')).toBeVisible();
    await expect.poll(async () => page.locator('#animationSelect option').count()).toBeGreaterThan(0);
  });
});