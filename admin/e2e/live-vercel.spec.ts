import { test, expect } from '@playwright/test';

test('Playwright Live Vercel E2E Test - Login, Overview, and Map Canvas', async ({ page }) => {
  // 1. Open Live Vercel Admin Console
  await page.goto('https://location-tracker-admin-lyart.vercel.app/login');

  // 2. Fill Admin Credentials
  await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
  await page.locator('#password').fill('Ae100ae100@');
  await page.locator('button[type="submit"]').click();

  // 3. Wait for Admin Dashboard to Load
  await page.waitForTimeout(5000);

  // 4. Navigate to Live Map
  await page.goto('https://location-tracker-admin-lyart.vercel.app/admin/map');
  await page.waitForTimeout(5000);

  // 5. Verify Map Canvas
  const mapCanvas = page.locator('.map-canvas');
  await expect(mapCanvas).toBeVisible();

  // Take Screenshot
  await page.screenshot({ path: 'live-vercel-map.png', fullPage: true });
});
