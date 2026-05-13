import { expect, test } from '@playwright/test';

test.describe('Demo canvas page', () => {
  test('renders a canvas-only demo page', async ({ page }) => {
    await page.goto('/#/demo');

    await expect(page).toHaveTitle('Demo');
    await expect(page.locator('#demoCanvas')).toBeVisible();
    await expect(page.locator('#appRoot').locator(':scope > *')).toHaveCount(1);
    await expect(page.locator('#appRoot canvas')).toHaveCount(1);
  });
});