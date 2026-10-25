import { test, expect } from '@playwright/test';

test('OpenStreetMap rendering E2E verification', async ({ page }) => {
  await page.goto('https://location-tracker-admin-lyart.vercel.app/login');
  await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
  await page.locator('#password').fill('Ae100ae100@');
  await page.locator('button[type="submit"]').click();

  await page.waitForTimeout(4000);
  await page.goto('https://location-tracker-admin-lyart.vercel.app/admin/map');
  await page.waitForTimeout(5000);

  const mapCanvas = page.locator('.map-canvas');
  await expect(mapCanvas).toBeVisible();

  await page.screenshot({ path: 'osm-map-verification.png', fullPage: true });
});
