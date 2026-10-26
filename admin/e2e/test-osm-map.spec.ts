import { test, expect } from '@playwright/test';

test('OpenStreetMap rendering E2E verification', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for live verification');

  await page.goto('/login');
  await page.locator('#email').fill(email!);
  await page.locator('#password').fill(password!);
  await page.locator('button[type="submit"]').click();

  await page.waitForTimeout(4000);
  await page.goto('/admin/map');
  await page.waitForTimeout(5000);

  const mapCanvas = page.locator('.map-canvas');
  await expect(mapCanvas).toBeVisible();

  await page.screenshot({ path: 'osm-map-verification.png', fullPage: true });
});
