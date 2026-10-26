import { test, expect } from '@playwright/test';

test.describe('Live Vercel Production Ecosystem Verification', () => {

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  test('1. Admin Login & Authentication', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for live verification');
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password!);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.screenshot({ path: 'verify-01-overview.png', fullPage: true });
  });

  test('2. Fleet Devices Directory Verification', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for live verification');
    await page.goto('/login');
    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password!);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.goto('/admin/devices');
    await page.waitForTimeout(3000);

    await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
    await page.screenshot({ path: 'verify-02-devices.png', fullPage: true });
  });

  test('3. Live Fleet CartoDB Map Verification', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for live verification');
    await page.goto('/login');
    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password!);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.goto('/admin/map');
    await page.waitForTimeout(4000);

    const mapCanvas = page.locator('.map-canvas');
    await expect(mapCanvas).toBeVisible();

    await page.screenshot({ path: 'verify-03-carto-map.png', fullPage: true });
  });

});
