import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { ErrorPanel, formatDate, LoadingRows, PageHeading, statusClass } from '../components/ui';
import { classifyMovement } from '../lib/movement';

export function DevicePage() {
  const { deviceId = '' } = useParams();
  const device = useQuery({ queryKey: ['admin-device', deviceId], queryFn: ({ signal }) => adminApi.device(deviceId, signal), enabled: Boolean(deviceId) });
  const history = useQuery({ queryKey: ['device-movement', deviceId], queryFn: ({ signal }) => adminApi.history(deviceId, { limit: 50 }, signal), enabled: Boolean(deviceId), staleTime: 30_000 });
  if (device.isPending) return <><PageHeading title="Device profile" /><div className="panel"><LoadingRows rows={3} /></div></>;
  if (device.isError || !device.data) return <><PageHeading title="Device profile" /><ErrorPanel error={device.error} /></>;
  const value = device.data;
  const location = value.latestLocation;
  const movement = history.data ? classifyMovement(history.data.items) : 'Unknown';
  return <>
    <Link className="back-link" to="/admin/devices">← All devices</Link>
    <PageHeading eyebrow="DEVICE PROFILE" title={value.owner?.name || 'Unnamed user'} description={value.owner?.email || 'No owner assigned'} action={<Link className="button button-secondary" to={`/admin/devices/${encodeURIComponent(deviceId)}/history`}>View location history <span>↗</span></Link>} />
    <div className="detail-grid">
      <section className="panel detail-main"><div className="panel-header"><div><div className="section-eyebrow">DEVICE SUMMARY</div><h3>{value.platform} device</h3></div><span className={statusClass(value.status)}><i />{value.status}</span></div>
        <div className="detail-rows"><DetailRow label="Device ID" value={value.id} mono /><DetailRow label="Owner" value={value.owner?.email || 'No owner assigned'} /><DetailRow label="Platform" value={value.platform} /><DetailRow label="Registered" value={formatDate(value.createdAt)} /><DetailRow label="Last heartbeat" value={formatDate(value.lastSeenAt)} /><DetailRow label="Movement estimate" value={history.isError ? 'Unavailable' : movement} /></div>
      </section>
      <section className="panel location-panel"><div className="section-eyebrow">LATEST LOCATION</div>{location ? <>
        <div className="location-coordinates"><span>⌖</span><div><strong>{location.latitude.toFixed(6)}<small>°</small></strong><strong>{location.longitude.toFixed(6)}<small>°</small></strong></div></div>
        <div className="location-tags"><span className={`freshness-text freshness-${location.freshnessStatus.toLowerCase()}`}><i />{location.freshnessStatus}</span><span className="accuracy-tag">Accuracy {location.accuracyM == null ? 'unavailable' : `±${location.accuracyM} m`}</span></div>
        <div className="detail-rows compact"><DetailRow label="Captured on device" value={formatDate(location.capturedAt)} /><DetailRow label="Received by server" value={formatDate(location.receivedAt)} /><DetailRow label="Speed" value={location.speedMps == null ? 'Not reported' : `${(location.speedMps * 3.6).toFixed(1)} km/h`} /></div>
        <Link className="inline-link" to={`/admin/map?device=${encodeURIComponent(value.id)}`}>Locate on map <span>→</span></Link>
      </> : <div className="no-location"><span>⌖</span><strong>No location data</strong><p>This device has not reported a saved location yet.</p></div>}</section>
    </div>
  </>;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="detail-row"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>;
}
