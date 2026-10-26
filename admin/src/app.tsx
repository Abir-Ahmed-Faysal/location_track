import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from './api/client';
import { adminApi } from './api/admin';
import { AppShell } from './components/app-shell';
import { LoginPage } from './pages/login';
import { OverviewPage } from './pages/overview';
import { DevicesPage } from './pages/devices';
import { DevicePage } from './pages/device';
import { HistoryPage } from './pages/history';
import { ApprovalsPage } from './pages/approvals';

const MapPage = lazy(() => import('./pages/map').then((module) => ({ default: module.MapPage })));

export function App() {
  return <Suspense fallback={<div className="screen-center"><span className="spinner" />Loading dashboard…</div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<Navigate to="/admin" replace />} />
    <Route path="/admin" element={<AdminGate />}>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="devices/:deviceId" element={<DevicePage />} />
        <Route path="devices/:deviceId/history" element={<HistoryPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes></Suspense>;
}

function AdminGate() {
  const location = useLocation();
  const access = useQuery({ queryKey: ['admin-overview'], queryFn: ({ signal }) => adminApi.overview(signal), retry: false });
  if (access.isPending) return <div className="screen-center"><span className="spinner" />Checking administrator access…</div>;
  if (access.error instanceof ApiError && access.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (access.error instanceof ApiError && access.error.status === 403) {
    return <div className="screen-center"><div className="access-card"><div className="brand-mark">U</div><h1>Administrator access required</h1><p>This account does not have the administrator role. Ask an administrator to provision your account.</p><a className="button button-secondary" href="/login">Use another account</a></div></div>;
  }
  if (access.isError) return <div className="screen-center"><div className="access-card"><h1>Can’t connect to the admin API</h1><p>{access.error.message}</p><button className="button button-primary" onClick={() => void access.refetch()}>Try again</button></div></div>;
  return <Outlet />;
}
