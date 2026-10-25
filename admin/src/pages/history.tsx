import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { EmptyState, ErrorPanel, formatDate, LoadingRows, PageHeading } from '../components/ui';

export function HistoryPage() {
  const { deviceId = '' } = useParams();
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const history = useInfiniteQuery({
    queryKey: ['admin-history', deviceId, range],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => adminApi.history(deviceId, { limit: 50, cursor: pageParam, ...range }, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(deviceId),
  });
  function applyRange() {
    setRange({ from: fromInput ? new Date(fromInput).toISOString() : undefined, to: toInput ? new Date(toInput).toISOString() : undefined });
  }
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  return <>
    <Link className="back-link" to={`/admin/devices/${encodeURIComponent(deviceId)}`}>← Device profile</Link>
    <PageHeading eyebrow="PERSISTED LOCATION EVENTS" title="Location history" description="Recorded fixes ordered by capture time. Connecting samples does not represent the exact travelled route." />
    <section className="panel table-panel">
      <div className="history-filter"><div><label>From <input type="datetime-local" value={fromInput} onChange={(e) => setFromInput(e.target.value)} /></label><label>To <input type="datetime-local" value={toInput} onChange={(e) => setToInput(e.target.value)} /></label><button className="button button-secondary" onClick={applyRange}>Apply range</button></div><span>{items.length} event{items.length === 1 ? '' : 's'} loaded</span></div>
      {history.isError ? <ErrorPanel error={history.error} onRetry={() => void history.refetch()} /> : history.isPending ? <LoadingRows /> : items.length ? <>
        <div className="table-scroll"><table><thead><tr><th>CAPTURED</th><th>RECEIVED</th><th>COORDINATES</th><th>SPEED</th><th>ACCURACY</th><th>PROVIDER</th></tr></thead><tbody>
          {items.map((event) => <tr key={event.id}><td>{formatDate(event.capturedAt)}</td><td>{formatDate(event.receivedAt)}</td><td className="coordinates">{event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}</td><td>{event.speedMps == null ? '—' : `${(event.speedMps * 3.6).toFixed(1)} km/h`}</td><td>{event.accuracyM == null ? '—' : `±${event.accuracyM} m`}</td><td>{event.provider || '—'}</td></tr>)}
        </tbody></table></div>
        <div className="table-footer"><span>History is fetched in bounded pages of 50 records.</span>{history.hasNextPage && <button className="button button-secondary" onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>{history.isFetchingNextPage ? 'Loading…' : 'Load older events →'}</button>}</div>
      </> : <EmptyState title="No location events in this range">Try widening or clearing the selected dates.</EmptyState>}
    </section>
  </>;
}
