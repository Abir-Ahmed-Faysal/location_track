import { test, expect } from '@playwright/test';

function requiredLiveConfig() {
  return [
    process.env.E2E_ADMIN_EMAIL,
    process.env.E2E_ADMIN_PASSWORD,
    process.env.E2E_INGEST_TOKEN,
    process.env.E2E_DEVICE_ID,
    process.env.E2E_API_BASE_URL,
  ];
}

test('receives a real location update through backend realtime delivery', async ({ page }) => {
  const [email, password, ingestToken, deviceId, apiBaseUrl] = requiredLiveConfig();
  test.skip(
    requiredLiveConfig().some((value) => !value),
    'Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_INGEST_TOKEN, E2E_DEVICE_ID, and E2E_API_BASE_URL',
  );

  await page.goto('/login');
  await page.locator('#email').fill(email!);
  await page.locator('#password').fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin(?:$|\/)/);
  await page.goto('/admin/map');
  await expect(page.locator('.map-canvas')).toBeVisible();

  const refresh = page.waitForResponse(async (response) => {
    if (response.request().method() !== 'GET' || !response.url().includes('/admin/devices')) return false;
    return response.ok();
  });

  const latitude = 23.8103 + Math.random() / 10000;
  const longitude = 90.4125 + Math.random() / 10000;
  const eventId = crypto.randomUUID();
  const ingest = await page.context().request.post(`${apiBaseUrl!.replace(/\/$/, '')}/locations/batch`, {
    headers: { Authorization: `Bearer ${ingestToken!}` },
    data: {
      schemaVersion: 1,
      events: [{
        eventId,
        deviceId: deviceId!,
        latitude,
        longitude,
        accuracyM: 5,
        capturedAt: new Date().toISOString(),
      }],
    },
  });
  expect(ingest.ok()).toBeTruthy();

  const refreshed = await refresh;
  const body = await refreshed.json() as { items?: Array<{ id: string; latestLocation?: { latitude: number; longitude: number } }> };
  const device = body.items?.find((item) => item.id === deviceId);
  expect(device?.latestLocation?.latitude).toBeCloseTo(latitude, 5);
  expect(device?.latestLocation?.longitude).toBeCloseTo(longitude, 5);
});
