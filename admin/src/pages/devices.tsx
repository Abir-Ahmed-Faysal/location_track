import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { EmptyState, ErrorPanel, formatRelative, LoadingRows, PageHeading, statusClass } from '../components/ui';

export function DevicesPage() {
  const [search, setSearch] = useState('');
  const [settledSearch, setSettledSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const approve = useMutation({
    mutationFn: (deviceId: string) => adminApi.updateDeviceStatus(deviceId, 'ACTIVE'),
    onSuccess: () => void devices.refetch(),
  });
  useEffect(() => { const timer = window.setTimeout(() => { setSettledSearch(search.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [search]);
  const devices = useQuery({
    queryKey: ['admin-devices', page, settledSearch, status],
    queryFn: ({ signal }) => adminApi.devices({ page, limit: 25, search: settledSearch, status }, signal),
    refetchInterval: 30_000,
  });
  const data = devices.data;
  return <>
    <PageHeading eyebrow="FLEET DIRECTORY" title="Devices" description="Search registered devices, review their latest reported location, and open a read-only device profile." action={<Link to="/admin/map" className="button button-secondary">⌖ <span>View map</span></Link>} />
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="result-count"><strong>{data?.total.toLocaleString() ?? '—'}</strong> devices</div><div className="table-filters"><label className="search-field"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID or owner…" aria-label="Search devices" /><kbd>⌕</kbd></label><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All statuses</option><option value="PENDING">Pending approval</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div></div>
      {devices.isError ? <ErrorPanel error={devices.error} onRetry={() => void devices.refetch()} /> : devices.isPending ? <LoadingRows /> : data?.items.length ? <>
        <div className="table-scroll"><table><thead><tr><th>DEVICE</th><th>OWNER</th><th>STATUS</th><th>LAST LOCATION</th><th>COORDINATES</th><th>PLATFORM</th><th></th></tr></thead><tbody>
          {data.items.map((device) => <tr key={device.id}>
            <td><Link className="device-id" to={`/admin/devices/${encodeURIComponent(device.id)}`}><span className="device-glyph">▣</span><span><strong>{shortId(device.id)}</strong><small title={device.id}>{device.id}</small></span></Link></td>
            <td><span className="owner-name">{device.owner?.name || 'Unnamed user'}</span><small className="table-subtext">{device.owner?.email || 'No owner assigned'}</small></td>
            <td><span className={statusClass(device.status)}><i />{device.status}</span>{device.status === 'PENDING' && <button className="button button-secondary" onClick={() => approve.mutate(device.id)} disabled={approve.isPending}>Approve</button>}</td>
            <td><span className={freshnessClass(device.latestLocation?.freshnessStatus)}><i />{device.latestLocation ? formatRelative(device.latestLocation.capturedAt) : 'No location'}</span></td>
            <td className="coordinates">{device.latestLocation ? `${device.latestLocation.latitude.toFixed(5)}, ${device.latestLocation.longitude.toFixed(5)}` : '—'}</td>
            <td><span className="platform-tag">{device.platform}</span></td><td><Link aria-label={`Open device ${shortId(device.id)}`} className="row-open" to={`/admin/devices/${encodeURIComponent(device.id)}`}>↗</Link></td>
          </tr>)}
        </tbody></table></div>
        <div className="table-footer"><span>Showing <strong>{((page - 1) * (data.limit)) + 1}–{Math.min(page * data.limit, data.total)}</strong> of {data.total.toLocaleString()} devices</span><div className="pagination"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>← Previous</button><span>Page <strong>{data.page}</strong> of {Math.max(data.totalPages, 1)}</span><button onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))} disabled={page >= data.totalPages}>Next →</button></div></div>
      </> : <EmptyState title={search || status ? 'No matching devices' : 'No devices have reported yet'}>{search || status ? 'Try a different search or filter.' : 'Devices will appear here once they are registered.'}</EmptyState>}
    </section>
  </>;
}

function shortId(value: string) { return value.length > 17 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }
function freshnessClass(value?: string) { return `freshness-text freshness-${(value ?? 'UNKNOWN').toLowerCase()}`; }
