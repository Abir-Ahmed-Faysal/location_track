import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, type Map as MapInstance, type StyleSpecification } from 'maplibre-gl';
import { io, type Socket } from 'socket.io-client';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { apiOrigin } from '../api/client';
import type { AdminDevice, RealtimeLocation } from '../api/types';
import { EmptyState, ErrorPanel, formatDate, formatRelative, PageHeading } from '../components/ui';
import { hasValidCoordinates } from '../lib/movement';
import { devicesWithValidLocations } from '../lib/map-data';

type StyleKey = 'streets' | 'satellite' | 'hybrid';

const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim() || 'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfNzQ2eXU1dzMiLCJqdGkiOiIzODc2YmZiYTlhY2Y3MDIwYmQ3ZDQyOTA5ZWFkNjE5NyJ9.oetO_ekXPFsguuOpYSlQ3XFLUsb6vRBKrR2thLBlttU';

const cartoVoyagerRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
        `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
        `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
        `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const cartoDarkRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
        `https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
        `https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
        `https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`,
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const mapKey = import.meta.env.VITE_MAPTILER_KEY?.trim();
const hasMapKey = Boolean(mapKey);
const styles: Record<StyleKey, StyleSpecification | string> = {
  streets: cartoVoyagerRasterStyle,
  satellite: hasMapKey ? `https://api.maptiler.com/maps/satellite-v4/style.json?key=${mapKey}` : cartoDarkRasterStyle,
  hybrid: hasMapKey ? `https://api.maptiler.com/maps/hybrid/style.json?key=${mapKey}` : cartoVoyagerRasterStyle,
};

export function MapPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(params.get('device') || '');
  const [page, setPage] = useState(1);
  const [style, setStyle] = useState<StyleKey>('streets');
  const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const queryClient = useQueryClient();
  const devices = useQuery({ queryKey: ['admin-map-devices', page], queryFn: ({ signal }) => adminApi.devices({ page, limit: 100 }, signal), refetchInterval: 30_000 });
  const visible = useMemo(() => devicesWithValidLocations(devices.data?.items ?? []), [devices.data]);
  useEffect(() => {
    if (!selectedId && visible.length > 0) {
      setSelectedId(visible[0].id);
    }
  }, [visible, selectedId]);
  const filtered = visible.filter((device) => `${device.id} ${device.owner?.email ?? ''} ${device.owner?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const selected = visible.find((device) => device.id === selectedId) ?? null;
  const activeIds = useMemo(() => (devices.data?.items ?? []).filter((item) => item.status === 'ACTIVE').map((item) => item.id), [devices.data]);
  const activeIdsRef = useRef<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket: Socket = io(`${apiOrigin()}/ws/v1/locations`, { withCredentials: true, autoConnect: false });
    socketRef.current = socket;
    const syncSubscriptions = () => {
      const next = new Set(activeIdsRef.current);
      subscribedRef.current.forEach((id) => { if (!next.has(id)) socket.emit('unsubscribe', { deviceId: id }); });
      next.forEach((id) => { if (!subscribedRef.current.has(id)) socket.emit('subscribe', { deviceId: id }); });
      subscribedRef.current = next;
    };
    const onConnect = () => { setConnection('live'); syncSubscriptions(); };
    const onDisconnect = () => { subscribedRef.current.clear(); setConnection('offline'); };
    const onConnectError = () => setConnection('offline');
    const onUpdate = (event: RealtimeLocation) => {
      if (!event?.deviceId || !hasValidCoordinates(event.latitude, event.longitude)) return;
      void queryClient.invalidateQueries({ queryKey: ['admin-map-devices'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-device', event.deviceId] });
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('location.updated', onUpdate);
    socket.connect();
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('connect_error', onConnectError); socket.off('location.updated', onUpdate); socketDisconnect(socketRef); };
  }, [queryClient]);

  useEffect(() => {
    activeIdsRef.current = activeIds;
    if (socketRef.current?.connected) {
      const next = new Set(activeIds);
      subscribedRef.current.forEach((id) => { if (!next.has(id)) socketRef.current?.emit('unsubscribe', { deviceId: id }); });
      next.forEach((id) => { if (!subscribedRef.current.has(id)) socketRef.current?.emit('subscribe', { deviceId: id }); });
      subscribedRef.current = next;
    }
  }, [activeIds]);

  return <>
    <PageHeading eyebrow="LIVE FLEET" title="Location map" description="Most recently saved fixes for devices on the current authorized fleet page." action={<span className={`connection-state connection-${connection}`}><i />{connection === 'live' ? 'Live updates on' : connection === 'offline' ? 'Using 30s refresh' : 'Connecting'}</span>} />
    {devices.isError ? <ErrorPanel error={devices.error} onRetry={() => void devices.refetch()} /> : <div className="map-layout">
      <section className="map-panel">
        <div className="map-toolbar"><div className="map-count"><span className="live-dot" /> <strong>{visible.length}</strong> devices with valid coordinates <span className="map-total">of {devices.data?.total ?? '—'}</span><div className="map-pager"><button aria-label="Previous map page" disabled={page <= 1} onClick={() => { setPage((value) => Math.max(value - 1, 1)); setSelectedId(''); }}>‹</button><span>{devices.data?.page ?? page}/{Math.max(devices.data?.totalPages ?? 1, 1)}</span><button aria-label="Next map page" disabled={page >= (devices.data?.totalPages ?? 1)} onClick={() => { setPage((value) => Math.min(value + 1, devices.data?.totalPages ?? value)); setSelectedId(''); }}>›</button></div></div><div className="map-styles" aria-label="Map style">{(['streets', 'satellite', 'hybrid'] as const).map((value) => <button key={value} className={style === value ? 'selected' : ''} onClick={() => setStyle(value)} disabled={value !== 'streets' && !hasMapKey} title={value !== 'streets' && !hasMapKey ? 'A real MapTiler key is required for satellite and hybrid imagery. Set VITE_MAPTILER_KEY in admin/.env.local.' : undefined}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
        <MapCanvas devices={visible} selected={selected} styleUrl={styles[style]} onSelect={setSelectedId} />
        <div className="map-legend"><span><i className="legend-dot legend-fresh" />Fresh</span><span><i className="legend-dot legend-delayed" />Delayed</span><span><i className="legend-dot legend-stale" />Stale</span><small>Map data refreshes every 30 seconds. Tiles © OpenStreetMap contributors · CARTO</small></div>
      </section>
      <aside className="map-sidebar panel"><div className="map-side-head"><div><div className="section-eyebrow">FLEET LOCATIONS</div><h3>Devices <span>{filtered.length}</span></h3></div></div><label className="search-field map-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search devices…" aria-label="Search map devices" /></label>
        <div className="map-device-list">{devices.isPending ? <div className="map-loading">Loading device locations…</div> : filtered.length ? filtered.map((device) => <button key={device.id} className={`map-device-row${selectedId === device.id ? ' active' : ''}`} onClick={() => setSelectedId(device.id)}><span className={`map-device-pin pin-${device.latestLocation?.freshnessStatus.toLowerCase()}`}><i /></span><span className="map-device-info"><strong>{device.owner?.name || device.owner?.email || 'Unassigned device'}</strong><small>{shortId(device.id)} · {device.platform}</small><small>{formatRelative(device.latestLocation?.capturedAt)}</small></span><span className="map-row-arrow">↗</span></button>) : <EmptyState title="No mapped devices">Devices without valid saved coordinates won’t appear.</EmptyState>}</div>
        {selected?.latestLocation && <div className="map-selected"><div className="selected-head"><span className="section-eyebrow">SELECTED DEVICE</span><Link to={`/admin/devices/${encodeURIComponent(selected.id)}`}>Details ↗</Link></div><strong>{selected.owner?.name || shortId(selected.id)}</strong><span>{selected.owner?.email || 'No owner assigned'}</span><div className="selected-coordinate">{selected.latestLocation.latitude.toFixed(6)}, {selected.latestLocation.longitude.toFixed(6)}</div><span className={`freshness-text freshness-${selected.latestLocation.freshnessStatus.toLowerCase()}`}><i />{selected.latestLocation.freshnessStatus} · captured {formatDate(selected.latestLocation.capturedAt)}</span></div>}
      </aside>
    </div>}
  </>;
}

function socketDisconnect(ref: React.MutableRefObject<Socket | null>) {
  if (ref.current) {
    ref.current.disconnect();
    ref.current = null;
  }
}

function MapCanvas({ devices, selected, styleUrl, onSelect }: { devices: AdminDevice[]; selected: AdminDevice | null; styleUrl: StyleSpecification | string; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const currentStyle = useRef(styleUrl);
  const markers = useRef<Marker[]>([]);
  const fittedFleet = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const initialCenter: [number, number] = selected?.latestLocation
      ? [selected.latestLocation.longitude, selected.latestLocation.latitude]
      : devices.length > 0 && devices[0].latestLocation
        ? [devices[0].latestLocation.longitude, devices[0].latestLocation.latitude]
        : [90.4125, 23.8103];
    const initialZoom = selected?.latestLocation || (devices.length > 0 && devices[0].latestLocation) ? 14 : 6;
    const instance = new MapLibreMap({
      container: container.current,
      style: styleUrl,
      center: initialCenter,
      zoom: initialZoom,
    });
    currentStyle.current = styleUrl;
    instance.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    const markReady = () => {
      instance.resize();
      setReady(true);
    };
    if (instance.isStyleLoaded()) {
      markReady();
    } else {
      instance.once('load', markReady);
      instance.once('styledata', markReady);
    }
    const fallbackTimer = window.setTimeout(markReady, 150);
    const resizeTimer = window.setTimeout(() => instance.resize(), 400);
    map.current = instance;
    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(resizeTimer);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
      setReady(false);
    };
  }, []);
  useEffect(() => {
    if (!map.current || currentStyle.current === styleUrl) return;
    currentStyle.current = styleUrl;
    map.current.setStyle(styleUrl);
  }, [styleUrl]);
  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = devices.flatMap((device) => {
      const location = device.latestLocation;
      if (!location || !hasValidCoordinates(location.latitude, location.longitude)) return [];
      const element = document.createElement('button');
      element.className = `fleet-marker marker-${location.freshnessStatus.toLowerCase()}${selected?.id === device.id ? ' marker-selected' : ''}`;
      element.type = 'button';
      element.setAttribute('aria-label', `Select device ${shortId(device.id)}`);
      element.innerHTML = '<span></span>';
      element.addEventListener('click', () => onSelect(device.id));
      const marker = new Marker({ element, anchor: 'bottom' }).setLngLat([location.longitude, location.latitude]).addTo(map.current!);
      return [marker];
    });
  }, [ready, devices, selected?.id, onSelect]);
  useEffect(() => {
    if (!ready || !selected?.latestLocation || !map.current) return;
    map.current.easeTo({ center: [selected.latestLocation.longitude, selected.latestLocation.latitude], zoom: 16, duration: 700 });
  }, [ready, selected]);
  useEffect(() => {
    if (!ready || selected || fittedFleet.current || !map.current || devices.length === 0) return;
    const points = devices.flatMap((device) => {
      const location = device.latestLocation;
      return location && hasValidCoordinates(location.latitude, location.longitude)
        ? [[location.longitude, location.latitude] as [number, number]]
        : [];
    });
    if (points.length === 1) {
      map.current.easeTo({ center: points[0], zoom: 16, duration: 500 });
    } else if (points.length > 1) {
      const bounds = points.slice(1).reduce((value, point) => value.extend(point), new LngLatBounds(points[0], points[0]));
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 500 });
    }
    fittedFleet.current = points.length > 0;
  }, [ready, devices, selected]);
  return <div className="map-canvas-wrap"><div ref={container} className="map-canvas" aria-label="Map of device locations" />{!ready && <div className="map-loading-overlay"><span className="spinner" />Loading map tiles…</div>}</div>;
}

function shortId(value: string) { return value.length > 17 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }
