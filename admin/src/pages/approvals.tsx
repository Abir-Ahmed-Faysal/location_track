import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { EmptyState, ErrorPanel, LoadingRows, PageHeading, statusClass } from '../components/ui';

export function ApprovalsPage() {
  const devices = useQuery({
    queryKey: ['admin-device-approvals'],
    queryFn: ({ signal }) => adminApi.devices({ status: 'PENDING', page: 1, limit: 100 }, signal),
    refetchInterval: 10_000,
  });
  const approve = useMutation({
    mutationFn: (deviceId: string) => adminApi.updateDeviceStatus(deviceId, 'ACTIVE'),
    onSuccess: () => void devices.refetch(),
  });
  const items = devices.data?.items ?? [];

  return <>
    <PageHeading eyebrow="ACCESS CONTROL" title="Device approvals" description="Review new device enrollment requests before allowing location ingestion." action={<Link to="/admin/devices" className="button button-secondary">All devices</Link>} />
    <section className="panel table-panel">
      {devices.isError ? <ErrorPanel error={devices.error} onRetry={() => void devices.refetch()} /> : devices.isPending ? <LoadingRows /> : items.length === 0 ? <EmptyState title="No pending approvals">New device requests will appear here automatically.</EmptyState> : <div className="table-scroll"><table><thead><tr><th>DEVICE</th><th>OWNER</th><th>PLATFORM</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {items.map((device) => <tr key={device.id}><td><Link className="device-id" to={`/admin/devices/${encodeURIComponent(device.id)}`}>{device.id}</Link></td><td><span className="owner-name">{device.owner?.name || 'Unnamed user'}</span><small className="table-subtext">{device.owner?.email || 'No owner assigned'}</small></td><td><span className="platform-tag">{device.platform}</span></td><td><span className={statusClass(device.status)}><i />{device.status}</span></td><td><button className="button button-primary" onClick={() => approve.mutate(device.id)} disabled={approve.isPending}>Approve device</button></td></tr>)}
      </tbody></table></div>}
    </section>
  </>;
}
