import { request } from './client';
import type { AdminDevice, DevicePage, HistoryPage, LoginResult, Overview } from './types';

export const adminApi = {
  login: (email: string, password: string) => request<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ message: string }>('/auth/logout-all', { method: 'POST' }),
  overview: (signal?: AbortSignal) => request<Overview>('/admin/overview', { signal }),
  devices: (params: { page?: number; limit?: number; search?: string; status?: string }, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return request<DevicePage>(`/admin/devices?${query}`, { signal });
  },
  device: (id: string, signal?: AbortSignal) => request<AdminDevice>(`/admin/devices/${encodeURIComponent(id)}`, { signal }),
  updateDeviceStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') => request<{ id: string; status: string }>(`/admin/devices/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  history: (id: string, params: { limit?: number; cursor?: string; from?: string; to?: string }, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return request<HistoryPage>(`/admin/devices/${encodeURIComponent(id)}/locations/history?${query}`, { signal });
  },
};
