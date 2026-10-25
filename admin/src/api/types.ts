export interface AdminUser { id: string; email: string; name: string | null }
export interface Overview {
  totalDevices: number; activeDevices: number; devicesWithLocation: number; totalEvents: number;
  activeWindowSeconds: number; lastLocationUpdateAt: string | null;
}
export interface OwnerSummary { id: string; name: string | null; email: string }
export interface LatestLocation {
  eventId: string; latitude: number; longitude: number; accuracyM: number | null;
  capturedAt: string; receivedAt: string; altitudeM: number | null; speedMps: number | null;
  bearingDeg: number | null; freshnessStatus: 'FRESH' | 'DELAYED' | 'STALE' | 'UNKNOWN';
  accuracyClassification: 'GOOD' | 'REDUCED' | 'POOR' | 'UNAVAILABLE';
}
export interface AdminDevice {
  id: string; platform: string; status: string; createdAt: string; lastSeenAt: string | null;
  owner: OwnerSummary | null; latestLocation: LatestLocation | null;
}
export interface DevicePage { items: AdminDevice[]; page: number; limit: number; total: number; totalPages: number }
export interface LocationEvent {
  id: string; eventId: string; deviceId: string; latitude: number; longitude: number;
  accuracyM: number | null; altitudeM: number | null; speedMps: number | null; bearingDeg: number | null;
  provider: string | null; capturedAt: string; receivedAt: string;
}
export interface HistoryPage { items: LocationEvent[]; nextCursor: string | null }
export interface LoginResult { user: AdminUser }
export interface RealtimeLocation { deviceId: string; eventId: string; capturedAt: string; latitude: number; longitude: number }
