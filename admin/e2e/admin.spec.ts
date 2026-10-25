import { test, expect, type Page } from '@playwright/test';

const demoDevice = {
  id: 'device-e2e-001',
  platform: 'ANDROID',
  status: 'ACTIVE',
  createdAt: '2026-10-25T10:00:00.000Z',
  lastSeenAt: '2026-10-25T10:05:00.000Z',
  owner: { id: 'user-e2e-001', name: 'Demo User', email: 'demo@example.test' },
  latestLocation: {
    eventId: 'event-e2e-001',
    latitude: 23.8103,
    longitude: 90.4125,
    accuracyM: 5,
    capturedAt: '2026-10-25T10:05:00.000Z',
    receivedAt: '2026-10-25T10:05:02.000Z',
    altitudeM: null,
    speedMps: 0,
    bearingDeg: null,
    freshnessStatus: 'FRESH',
    accuracyClassification: 'GOOD',
  },
};

async function mockLocalServices(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith('/auth/login') && request.method() === 'POST') {
      return route.fulfill({ json: {
        accessToken: 'playwright-access-token',
        refreshToken: 'playwright-refresh-token',
        user: { id: 'user-e2e-001', email: 'admin@example.test', name: 'Test Admin' },
      } });
    }
    if (pathname.endsWith('/auth/logout-all')) {
      return route.fulfill({ json: { message: 'Logged out' } });
    }
    if (pathname.endsWith('/admin/overview')) {
      return route.fulfill({ json: {
        totalDevices: 1,
        activeDevices: 1,
        devicesWithLocation: 1,
        totalEvents: 1,
        activeWindowSeconds: 300,
        lastLocationUpdateAt: demoDevice.latestLocation.receivedAt,
      } });
    }
    if (pathname.endsWith('/admin/devices')) {
      const url = new URL(request.url());
      return route.fulfill({ json: {
        items: [demoDevice],
        page: Number(url.searchParams.get('page') ?? 1),
        limit: Number(url.searchParams.get('limit') ?? 25),
        total: 1,
        totalPages: 1,
      } });
    }

    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Unmocked local test endpoint' } } });
  });

  // Keep E2E runs independent of external tile availability and map credentials.
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) => route.fulfill({
    contentType: 'application/json',
    json: {
      version: 8,
      sources: {},
      layers: [{ id: 'e2e-background', type: 'background', paint: { 'background-color': '#f4f1ed' } }],
    },
  }));
  await page.route('**/socket.io/**', (route) => route.abort());
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill('admin@example.test');
  await page.locator('#password').fill('local-playwright-password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin(?:$|\?)/);
}

test('signs in with a mocked local account and displays overview', async ({ page }) => {
  await mockLocalServices(page);
  await signIn(page);

  await expect(page.getByRole('heading', { name: 'Command center' })).toBeVisible();
  await expect(page.getByText('Registered devices', { exact: true })).toBeVisible();
});

test('shows the mocked device in the directory', async ({ page }) => {
  await mockLocalServices(page);
  await signIn(page);
  await page.goto('/admin/devices');

  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
  await expect(page.locator('a.device-id')).toContainText('device-e2e-001');
  await expect(page.getByText('demo@example.test')).toBeVisible();
});

test('renders the live map canvas and device marker', async ({ page }) => {
  await mockLocalServices(page);
  await signIn(page);
  await page.goto('/admin/map');

  await expect(page.getByRole('heading', { name: 'Location map' })).toBeVisible();
  await expect(page.locator('.map-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select device device-e2e-001' })).toBeVisible();
});
