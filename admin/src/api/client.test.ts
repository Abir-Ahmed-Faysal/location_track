import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('sends same-site cookies on authenticated API requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request<{ ok: boolean }>('/admin/overview')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/v1/admin/overview', expect.objectContaining({ credentials: 'include' }));
  });

  it('preserves the backend status and error envelope for authorization failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Administrator access required' } }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
    await expect(request('/admin/overview')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Administrator access required' });
  });
});
