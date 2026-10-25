import type { ReactNode } from 'react';
import type { ApiError } from '../api/client';

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}

export function ErrorPanel({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  const text = error instanceof Error ? error.message : 'Something went wrong while loading this data.';
  return <div className="state-panel error-panel"><span className="state-icon">!</span><div><strong>Couldn’t load this data</strong><p>{text}</p>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div></div>;
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div className="skeleton-row" key={i}><span /><span /><span /><span /></div>)}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark">⌖</span><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return 'No location yet';
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return 'Unknown time';
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function statusClass(status: string | undefined): string {
  const value = status?.toLowerCase() ?? 'unknown';
  return `status-pill status-${value}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && 'status' in error);
}
