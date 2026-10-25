import { test, expect } from '@playwright/test';

test.describe('Admin Console Full End-to-End Test Suite', () => {

  test('1. Authentication & Session Validation', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin**');
    await page.screenshot({ path: 'e2e-01-overview.png', fullPage: true });
  });

  test('2. Command Center Overview Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin**');

    await expect(page.getByText(/Registered devices/i)).toBeVisible();
    await expect(page.getByText(/Recently active/i)).toBeVisible();
    await expect(page.getByText(/Reporting locations/i)).toBeVisible();
    await expect(page.getByText(/Recorded events/i)).toBeVisible();

    await page.screenshot({ path: 'e2e-02-overview-metrics.png', fullPage: true });
  });

  test('3. Fleet Directory Devices List Page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('button[type="submit"]').click();

    await page.goto('/admin/devices');
    await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    await page.screenshot({ path: 'e2e-03-devices-directory.png', fullPage: true });
  });

  test('4. Live Fleet Location Map Page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('fr.abir.ahmed.faysal@gmail.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('button[type="submit"]').click();

    await page.goto('/admin/map');
    await expect(page.getByRole('heading', { name: 'Location map' })).toBeVisible();

    const mapCanvas = page.locator('.map-canvas');
    await expect(mapCanvas).toBeVisible();

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e-04-live-map.png', fullPage: true });
  });

});
