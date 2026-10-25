import { test, expect } from '@playwright/test';

test.describe('Live Vercel Production Ecosystem Verification', () => {

  test('1. Admin Login & Authentication', async ({ page }) => {
    await page.goto('https://location-tracker-admin-lyart.vercel.app/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Ae100ae100@');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.screenshot({ path: 'verify-01-overview.png', fullPage: true });
  });

  test('2. Fleet Devices Directory Verification', async ({ page }) => {
    await page.goto('https://location-tracker-admin-lyart.vercel.app/login');
    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Ae100ae100@');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.goto('https://location-tracker-admin-lyart.vercel.app/admin/devices');
    await page.waitForTimeout(3000);

    await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
    await page.screenshot({ path: 'verify-02-devices.png', fullPage: true });
  });

  test('3. Live Fleet CartoDB Map Verification', async ({ page }) => {
    await page.goto('https://location-tracker-admin-lyart.vercel.app/login');
    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Ae100ae100@');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.goto('https://location-tracker-admin-lyart.vercel.app/admin/map');
    await page.waitForTimeout(4000);

    const mapCanvas = page.locator('.map-canvas');
    await expect(mapCanvas).toBeVisible();

    await page.screenshot({ path: 'verify-03-carto-map.png', fullPage: true });
  });

});
