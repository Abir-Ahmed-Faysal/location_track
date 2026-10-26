import { useEffect, useMemo, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, type Map as MapInstance, type StyleSpecification } from 'maplibre-gl';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import type { LocationEvent } from '../api/types';
import { EmptyState, ErrorPanel, formatDate, LoadingRows, PageHeading } from '../components/ui';

const PAGE_SIZE = 200;
const MAX_PAGES = 100;
const MAX_POINTS = 20_000;
const DEFAULT_ACCURACY_METERS = 100;
const MAX_JUMP_SPEED_KMH = 150;
const GAP_THRESHOLD_MS = 30 * 60_000;
const STATIONARY_SPEED_MPS = 0.8;
const STATIONARY_RADIUS_METERS = 30;
const STATIONARY_MIN_DURATION_MS = 5 * 60_000;

const routeMapStyle: StyleSpecification = {
  version: 8,
  sources: { routeTiles: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors' } },
  layers: [{ id: 'routeTiles', type: 'raster', source: 'routeTiles' }],
};

type TravelMode = 'driving' | 'walking';
type LoadState = 'idle' | 'loading' | 'complete' | 'partial' | 'error';
type RouteSegment = LocationEvent[];
type FilterSummary = { total: number; invalidCoordinates: number; invalidTimestamps: number; lowAccuracy: number; jumps: number; stationaryCollapsed: number; final: number; gaps: number; largestGapMs: number };

export function HistoryPage() {
  const { deviceId = '' } = useParams();
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [items, setItems] = useState<LocationEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [loadNonce, setLoadNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    let active = true;
    setLoadState('loading');
    setLoadError(null);
    setItems([]);
    setPageCount(0);
    void (async () => {
      const loaded: LocationEvent[] = [];
      let cursor: string | undefined;
      let pages = 0;
      try {
        while (active && !controller.signal.aborted && pages < MAX_PAGES && loaded.length < MAX_POINTS) {
          const page = await adminApi.history(deviceId, { limit: PAGE_SIZE, cursor, ...range }, controller.signal);
          loaded.push(...page.items);
          pages += 1;
          setItems([...loaded]);
          setPageCount(pages);
          if (!page.nextCursor) {
            if (active) setLoadState('complete');
            return;
          }
          cursor = page.nextCursor;
        }
        if (active) setLoadState('partial');
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setLoadError(error);
          setLoadState('error');
        } else if (active) {
          setLoadState('partial');
        }
      }
    })();
    return () => { active = false; controller.abort(); if (abortRef.current === controller) abortRef.current = null; };
  }, [deviceId, range, loadNonce]);

  function applyRange(nextFrom = fromInput, nextTo = toInput) {
    setFromInput(nextFrom);
    setToInput(nextTo);
    setRange({ from: nextFrom ? new Date(nextFrom).toISOString() : undefined, to: nextTo ? new Date(nextTo).toISOString() : undefined });
  }
  function cancelLoading() {
    abortRef.current?.abort();
    setLoadState('partial');
  }
  function applyPreset(preset: 'today' | 'yesterday' | 'last7') {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (preset === 'yesterday') { start.setDate(start.getDate() - 1); end.setTime(start.getTime() + 24 * 60 * 60_000 - 1); }
    if (preset === 'last7') start.setDate(start.getDate() - 6);
    applyRange(toLocalInput(start), toLocalInput(end));
  }

  const processed = useMemo(() => processRoute(items), [items]);
  const segment = processed.segments[selectedSegment] ?? processed.segments[0];
  const googleMapsUrl = segment ? createGoogleMapsDirectionsUrl(segment, travelMode) : null;
  const partial = loadState === 'partial';
  const loadedRange = getLoadedRange(items);

  return <>
    <Link className="back-link" to={`/admin/devices/${encodeURIComponent(deviceId)}`}>← Device profile</Link>
    <PageHeading eyebrow="PERSISTED LOCATION EVENTS" title="Location history" description="Review filtered GPS history and open an approximate road route in Google Maps." />
    <section className="panel table-panel">
      <div className="history-filter" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label>From <input type="datetime-local" value={fromInput} onChange={(e) => setFromInput(e.target.value)} /></label>
          <label>To <input type="datetime-local" value={toInput} onChange={(e) => setToInput(e.target.value)} /></label>
          <button className="button button-secondary" onClick={() => applyRange()}>Apply range</button>
          <button className="button button-secondary" onClick={() => setLoadNonce((value) => value + 1)} disabled={loadState === 'loading'}>Load complete range</button>
          <button className="button button-secondary" onClick={() => applyPreset('today')}>Today</button>
          <button className="button button-secondary" onClick={() => applyPreset('yesterday')}>Yesterday</button>
          <button className="button button-secondary" onClick={() => applyPreset('last7')}>Last 7 days</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>{items.length.toLocaleString()} loaded · {pageCount} page{pageCount === 1 ? '' : 's'}</span>{loadState === 'loading' && <button className="button button-secondary" onClick={cancelLoading}>Cancel</button>}</div>
      </div>
      {loadState === 'error' ? <ErrorPanel error={loadError instanceof Error ? loadError : new Error('Unable to load location history')} onRetry={() => setLoadNonce((value) => value + 1)} /> : loadState === 'loading' && !items.length ? <LoadingRows /> : items.length ? <>
        {partial && <div className="state-panel" style={{ margin: 14, borderColor: '#ead9b5', background: '#fffaf0' }}><div><strong>Partial data</strong><p>Some older points may not be loaded because loading was cancelled or the safety cap was reached.</p><p>Loaded range: {formatDate(loadedRange.start)} → {formatDate(loadedRange.end)}</p></div></div>}
        <section className="panel" style={{ margin: 14, overflow: 'hidden' }}>
          <div className="panel-header" style={{ padding: '16px 18px' }}><div><div className="section-eyebrow">MOVEMENT ROUTE</div><h3>Recorded GPS segments</h3></div><span>{processed.summary.final.toLocaleString()} accepted points</span></div>
          <RouteMap segments={processed.segments} />
          <div style={{ padding: '12px 18px', borderTop: '1px solid #edf1f2', display: 'grid', gap: 8, fontSize: 10, color: '#718087' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><span>{partial ? 'Start of loaded range' : 'Start'}: {formatDate(segment?.[0]?.capturedAt ?? null)}</span><span>{partial ? 'End of loaded range' : 'End'}: {formatDate(segment?.at(-1)?.capturedAt ?? null)}</span><span>{processed.segments.length} segment{processed.segments.length === 1 ? '' : 's'}</span>{processed.summary.gaps > 0 && <span>Gaps: {processed.summary.gaps}, largest {formatDuration(processed.summary.largestGapMs)}</span>}</div>
            {processed.segments.length > 1 && <label>Google Maps segment <select value={selectedSegment} onChange={(e) => setSelectedSegment(Number(e.target.value))}>{processed.segments.map((part, index) => <option key={index} value={index}>Segment {index + 1} · {formatDate(part[0]?.capturedAt ?? null)} – {formatDate(part.at(-1)?.capturedAt ?? null)}</option>)}</select></label>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><label>Travel mode <select value={travelMode} onChange={(e) => setTravelMode(e.target.value as TravelMode)}><option value="driving">Driving</option><option value="walking">Walking</option></select></label>{googleMapsUrl && <a className="button button-secondary" href={googleMapsUrl} target="_blank" rel="noreferrer">Open approximate road route in Google Maps ↗</a>}</div>
          </div>
        </section>
        <section style={{ margin: '0 14px 14px', padding: '12px 18px', background: '#f7faf9', borderRadius: 7, color: '#718087', fontSize: 10 }}><strong>Filter summary</strong><div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 7 }}><span>Total {processed.summary.total}</span><span>Invalid coordinates {processed.summary.invalidCoordinates}</span><span>Invalid timestamps {processed.summary.invalidTimestamps}</span><span>Low accuracy {processed.summary.lowAccuracy}</span><span>GPS jumps {processed.summary.jumps}</span><span>Stationary collapsed {processed.summary.stationaryCollapsed}</span><span>Final {processed.summary.final}</span></div></section>
        <div className="table-scroll"><table><thead><tr><th>CAPTURED</th><th>RECEIVED</th><th>COORDINATES</th><th>SPEED</th><th>ACCURACY</th><th>PROVIDER</th></tr></thead><tbody>{items.map((event) => <tr key={event.id}><td>{formatDate(event.capturedAt)}</td><td>{formatDate(event.receivedAt)}</td><td className="coordinates">{event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}</td><td>{event.speedMps == null ? '—' : `${(event.speedMps * 3.6).toFixed(1)} km/h`}</td><td>{event.accuracyM == null ? '—' : `±${event.accuracyM} m`}</td><td>{event.provider || '—'}</td></tr>)}</tbody></table></div>
        <div className="table-footer"><span>Newest-first API data normalized to chronological route order.</span>{loadState === 'loading' && <span>Loading complete range…</span>}</div>
      </> : loadState === 'complete' ? <EmptyState title="No location events in this range">Try widening or clearing the selected dates.</EmptyState> : null}
    </section>
  </>;
}

function processRoute(items: LocationEvent[]) {
  const summary: FilterSummary = { total: items.length, invalidCoordinates: 0, invalidTimestamps: 0, lowAccuracy: 0, jumps: 0, stationaryCollapsed: 0, final: 0, gaps: 0, largestGapMs: 0 };
  const sorted = [...items].sort((a, b) => { const time = new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(); return time || a.id.localeCompare(b.id); });
  const acceptedSegments: RouteSegment[] = [];
  let current: RouteSegment = [];
  let lastAccepted: LocationEvent | undefined;
  for (const point of sorted) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) { summary.invalidCoordinates += 1; continue; }
    const timestamp = new Date(point.capturedAt).getTime();
    if (!Number.isFinite(timestamp)) { summary.invalidTimestamps += 1; continue; }
    if (point.accuracyM != null && (!Number.isFinite(point.accuracyM) || point.accuracyM > DEFAULT_ACCURACY_METERS)) { summary.lowAccuracy += 1; continue; }
    if (lastAccepted) {
      const elapsedMs = timestamp - new Date(lastAccepted.capturedAt).getTime();
      if (elapsedMs <= 1_000) { summary.invalidTimestamps += 1; continue; }
      if (elapsedMs > GAP_THRESHOLD_MS) {
        if (current.length) acceptedSegments.push(current);
        summary.gaps += 1;
        summary.largestGapMs = Math.max(summary.largestGapMs, elapsedMs);
        current = [];
      } else {
        const speedKmh = (haversineMeters(lastAccepted.latitude, lastAccepted.longitude, point.latitude, point.longitude) / (elapsedMs / 1000)) * 3.6;
        if (speedKmh > MAX_JUMP_SPEED_KMH) { summary.jumps += 1; continue; }
      }
    }
    current.push(point);
    lastAccepted = point;
  }
  if (current.length) acceptedSegments.push(current);
  const segments = acceptedSegments.map((part) => {
    const collapsed = collapseStationary(part);
    summary.stationaryCollapsed += part.length - collapsed.length;
    return collapsed;
  }).filter((part) => part.length > 0);
  summary.final = segments.reduce((count, part) => count + part.length, 0);
  return { segments, summary };
}

function collapseStationary(points: RouteSegment) {
  if (points.length < 3) return points;
  const result: RouteSegment = [points[0]];
  let cluster: LocationEvent[] = [];
  const flush = () => { if (cluster.length) result.push(cluster.at(-1)!); cluster = []; };
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const anchor = cluster[0] ?? result.at(-1)!;
    const elapsed = new Date(point.capturedAt).getTime() - new Date(anchor.capturedAt).getTime();
    const nearby = haversineMeters(anchor.latitude, anchor.longitude, point.latitude, point.longitude) <= Math.max(STATIONARY_RADIUS_METERS, anchor.accuracyM ?? 0, point.accuracyM ?? 0);
    const slow = point.speedMps == null || point.speedMps <= STATIONARY_SPEED_MPS;
    if (nearby && slow) { cluster.push(point); continue; }
    if (cluster.length && elapsed >= STATIONARY_MIN_DURATION_MS) flush();
    else if (cluster.length) { result.push(...cluster); cluster = []; }
    result.push(point);
  }
  if (cluster.length) { const elapsed = new Date(cluster.at(-1)!.capturedAt).getTime() - new Date((cluster[0] ?? points[0]).capturedAt).getTime(); if (elapsed < STATIONARY_MIN_DURATION_MS) result.push(...cluster); }
  result.push(points.at(-1)!);
  return result;
}

function createGoogleMapsDirectionsUrl(segment: RouteSegment, travelMode: TravelMode) {
  if (segment.length < 2) return null;
  const waypoints = chooseWaypoints(segment, 3);
  const params = new URLSearchParams({ api: '1', origin: formatCoordinate(segment[0]), destination: formatCoordinate(segment.at(-1)!), travelmode: travelMode });
  if (waypoints.length) params.set('waypoints', waypoints.map(formatCoordinate).join('|'));
  let url = `https://www.google.com/maps/dir/?${params.toString()}`;
  while (url.length > 2000 && waypoints.length) { waypoints.pop(); if (waypoints.length) params.set('waypoints', waypoints.map(formatCoordinate).join('|')); else params.delete('waypoints'); url = `https://www.google.com/maps/dir/?${params.toString()}`; }
  return url;
}

function chooseWaypoints(points: RouteSegment, max: number) {
  if (points.length <= max + 2) return points.slice(1, -1);
  const scored = points.slice(1, -1).map((point, index) => ({ point, index: index + 1, score: waypointScore(points, index + 1) }));
  const selected = scored.sort((a, b) => b.score - a.score).slice(0, max);
  if (selected.length < max) { for (let index = 1; index < points.length - 1 && selected.length < max; index += Math.max(1, Math.floor(points.length / (max + 1)))) if (!selected.some((item) => item.index === index)) selected.push({ point: points[index], index, score: 0 }); }
  return selected.sort((a, b) => a.index - b.index).map((item) => item.point);
}

function waypointScore(points: RouteSegment, index: number) {
  const point = points[index];
  let score = point.speedMps != null && point.speedMps <= STATIONARY_SPEED_MPS ? 4 : 0;
  if (index > 0 && index < points.length - 1) score += turnAngle(points[index - 1], point, points[index + 1]) >= 30 ? 5 : 0;
  return score;
}

function RouteMap({ segments }: { segments: RouteSegment[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!container.current) return; const instance = new MapLibreMap({ container: container.current, style: routeMapStyle, center: [90.4125, 23.8103], zoom: 5 }); instance.addControl(new NavigationControl({ showCompass: false }), 'top-right'); instance.on('load', () => setReady(true)); map.current = instance; return () => { markers.current.forEach((marker) => marker.remove()); instance.remove(); map.current = null; }; }, []);
  useEffect(() => { const instance = map.current; if (!instance || !ready) return; for (let index = 0; index < 100; index += 1) { if (instance.getLayer(`route-line-${index}`)) instance.removeLayer(`route-line-${index}`); if (instance.getSource(`route-source-${index}`)) instance.removeSource(`route-source-${index}`); } markers.current.forEach((marker) => marker.remove()); markers.current = []; const all: [number, number][] = []; segments.forEach((segment, index) => { const coordinates = segment.map((point) => [point.longitude, point.latitude] as [number, number]); all.push(...coordinates); if (coordinates.length < 2) return; const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }; instance.addSource(`route-source-${index}`, { type: 'geojson', data }); instance.addLayer({ id: `route-line-${index}`, type: 'line', source: `route-source-${index}`, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#087f78', 'line-width': 4, 'line-opacity': 0.85 } }); }); if (all.length) { markers.current.push(new Marker({ color: '#168c78' }).setLngLat(all[0]).addTo(instance)); if (all.length > 1) markers.current.push(new Marker({ color: '#c46255' }).setLngLat(all.at(-1)!).addTo(instance)); const bounds = all.reduce((result, coordinate) => result.extend(coordinate), new LngLatBounds(all[0], all[0])); instance.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 }); } }, [segments, ready]);
  return <div ref={container} style={{ height: 380, minHeight: 280, background: '#e7eeea' }} />;
}

function getLoadedRange(items: LocationEvent[]) { const dates = items.map((item) => new Date(item.capturedAt).getTime()).filter(Number.isFinite); return { start: dates.length ? new Date(Math.min(...dates)).toISOString() : null, end: dates.length ? new Date(Math.max(...dates)).toISOString() : null }; }
function toLocalInput(date: Date) { const pad = (value: number) => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatCoordinate(point: LocationEvent) { return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`; }
function formatDuration(milliseconds: number) { const minutes = Math.round(milliseconds / 60_000); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`; }
function haversineMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number) { const radians = (value: number) => value * Math.PI / 180; const dLat = radians(latitude2 - latitude1); const dLng = radians(longitude2 - longitude1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(dLng / 2) ** 2; return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
function turnAngle(previous: LocationEvent, current: LocationEvent, next: LocationEvent) { const bearing = (from: LocationEvent, to: LocationEvent) => Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180 / Math.PI; let angle = Math.abs(bearing(current, next) - bearing(previous, current)); return angle > 180 ? 360 - angle : angle; }
