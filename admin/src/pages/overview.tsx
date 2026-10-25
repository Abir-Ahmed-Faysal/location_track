import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { ErrorPanel, formatDate, PageHeading } from '../components/ui';

export function OverviewPage() {
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: ({ signal }) => adminApi.overview(signal), refetchInterval: 30_000 });
  const metrics = overview.data;
  return <>
    <PageHeading eyebrow="FLEET OVERVIEW" title="Command center" description="A current view of registered devices and the location data they’ve reported." action={<span className="refresh-label"><span className="live-dot" /> Refreshes every 30 seconds</span>} />
    {overview.isError ? <ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} /> : <>
      <div className="metric-grid">
        <MetricCard label="Registered devices" value={metrics?.totalDevices} note="All provisioned devices" icon="▣" tone="blue" loading={overview.isPending} />
        <MetricCard label="Recently active" value={metrics?.activeDevices} note={`Seen in the last ${Math.round((metrics?.activeWindowSeconds ?? 300) / 60)} minutes`} icon="⌁" tone="green" loading={overview.isPending} />
        <MetricCard label="Reporting locations" value={metrics?.devicesWithLocation} note="Devices with a saved latest fix" icon="⌖" tone="amber" loading={overview.isPending} />
        <MetricCard label="Recorded events" value={metrics?.totalEvents} note="Persisted location history" icon="◷" tone="violet" loading={overview.isPending} />
      </div>
      <div className="overview-bottom">
        <section className="panel welcome-panel"><div className="section-eyebrow">FLEET MONITOR</div><h2>See the whole picture.</h2><p>Explore current device positions on the map or review ownership, freshness, and the most recent location in the device table.</p><div className="welcome-actions"><Link to="/admin/map" className="button button-primary">Open live map <span>↗</span></Link><Link to="/admin/devices" className="button button-secondary">Browse devices</Link></div><div className="welcome-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core">⌖</div><i className="orbit-point point-one" /><i className="orbit-point point-two" /></div></section>
        <section className="panel system-panel"><div className="panel-header"><div><div className="section-eyebrow">DATA STATUS</div><h3>Latest activity</h3></div><span className="system-live"><span className="live-dot" /> Data available</span></div><div className="activity-row"><span className="activity-icon">⌖</span><div><strong>Location stream</strong><p>Newest saved device location</p></div><time>{formatDate(metrics?.lastLocationUpdateAt)}</time></div><div className="activity-row"><span className="activity-icon activity-icon-muted">◌</span><div><strong>Admin API</strong><p>Protected fleet data endpoints</p></div><span className="activity-good">Responding</span></div><div className="system-note"><span>i</span><p>“Recently active” means a device heartbeat was recorded in the last {Math.round((metrics?.activeWindowSeconds ?? 300) / 60)} minutes. This is separate from location freshness.</p></div></section>
      </div>
    </>}
  </>;
}

function MetricCard({ label, value, note, icon, tone, loading }: { label: string; value?: number; note: string; icon: string; tone: string; loading: boolean }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon tone-${tone}`}>{icon}</span></div><div className="metric-value">{loading ? <span className="value-skeleton" /> : (value ?? '—').toLocaleString()}</div><div className="metric-note">{note}</div><div className={`metric-line line-${tone}`} /></article>;
}
