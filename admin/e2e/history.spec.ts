import { test, expect } from '@playwright/test';

test('loads complete history and builds a travel-mode Google route link', async ({ page }) => {
  const deviceId = 'device-history-001';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/login')) return route.fulfill({ json: { user: { id: 'admin-1', email: 'admin@example.test', name: 'Admin' } } });
    if (pathname.endsWith('/admin/overview')) return route.fulfill({ json: { totalDevices: 1, activeDevices: 1, devicesWithLocation: 1, totalEvents: 3, activeWindowSeconds: 300, lastLocationUpdateAt: '2026-10-26T10:02:00.000Z' } });
    if (pathname.endsWith('/admin/devices')) return route.fulfill({ json: { items: [], page: 1, limit: 25, total: 0, totalPages: 0 } });
    if (pathname.endsWith(`/admin/devices/${deviceId}/locations/history`)) return route.fulfill({ json: { items: [
      { id: 'event-3', eventId: 'event-3', deviceId, latitude: 22.4024, longitude: 89.0434, accuracyM: 8, altitudeM: null, speedMps: 1, bearingDeg: null, provider: 'gps', capturedAt: '2026-10-26T10:02:00.000Z', receivedAt: '2026-10-26T10:02:01.000Z' },
      { id: 'event-2', eventId: 'event-2', deviceId, latitude: 22.4020, longitude: 89.0430, accuracyM: 8, altitudeM: null, speedMps: 1, bearingDeg: null, provider: 'gps', capturedAt: '2026-10-26T10:01:00.000Z', receivedAt: '2026-10-26T10:01:01.000Z' },
      { id: 'event-1', eventId: 'event-1', deviceId, latitude: 22.4015, longitude: 89.0425, accuracyM: 8, altitudeM: null, speedMps: 1, bearingDeg: null, provider: 'gps', capturedAt: '2026-10-26T10:00:00.000Z', receivedAt: '2026-10-26T10:00:01.000Z' },
    ], nextCursor: null } });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Unmocked endpoint' } } });
  });
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.goto('/login');
  await page.locator('#email').fill('admin@example.test');
  await page.locator('#password').fill('password');
  await page.locator('button[type="submit"]').click();
  await page.goto(`/admin/devices/${deviceId}/history`);
  await expect(page.getByRole('heading', { name: 'Location history' })).toBeVisible();
  await expect(page.getByText('Recorded GPS segments')).toBeVisible();
  await expect(page.getByText('Open approximate road route in Google Maps')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open approximate road route/ })).toHaveAttribute('href', /travelmode=driving/);
  await page.getByLabel('Travel mode').selectOption('walking');
  await expect(page.getByRole('link', { name: /Open approximate road route/ })).toHaveAttribute('href', /travelmode=walking/);
});
