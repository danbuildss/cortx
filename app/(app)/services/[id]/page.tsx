import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RunCheckButton } from './run-check-button';
import { RangeToggle } from '../../_components/range-toggle';
import { parseRange, rangeToMs, rangeLabel } from '../../_components/range-utils';
import type { Range } from '../../_components/range-utils';
import { Suspense } from 'react';
import { ChecksPanel } from './_components/checks-panel';
import type { CheckRecord } from './_components/checks-panel';
import { SharePanel } from './_components/share-panel';
import { VerifyPanel } from './_components/verify-panel';

function fmtInterval(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return minutes === 1440 ? 'Daily' : `Every ${minutes / 1440}d`;
  if (minutes >= 60 && minutes % 60 === 0) return `Every ${minutes / 60}h`;
  return `Every ${minutes}m`;
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const [{ id }, { range: rawRange }] = await Promise.all([params, searchParams]);
  const range = parseRange(rawRange);
  const windowMs = rangeToMs(range);
  const rl = rangeLabel(range);
  const since = new Date(Date.now() - windowMs).toISOString();
  const checksLimit = range === '30d' ? 200 : range === '7d' ? 100 : 20;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: service } = await supabase
    .from('services')
    .select('id, name, endpoint_url, status, last_checked_at, check_interval_minutes, environment, expected_price, max_price, lightweight_check_interval_minutes, paid_verification_mode, paid_verification_interval_minutes, last_lightweight_check_at, last_paid_verification_at, last_full_verification_at, verification_status, verification_token, verified_at, monitoring_paused_reason')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!service) notFound();

  const { data: recentChecks } = await supabase
    .from('checks')
    .select('id, status, latency_ms, started_at, failure_stage, stages, check_type')
    .eq('service_id', id)
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(checksLimit);

  const { data: openIncident } = await supabase
    .from('incidents')
    .select('id, severity, opened_at, failure_stage')
    .eq('service_id', id)
    .in('status', ['open', 'acknowledged'])
    .maybeSingle();

  const STATUS_COLOR: Record<string, string> = {
    operational: 'var(--status-operational)',
    degraded: 'var(--status-degraded)',
    critical: 'var(--status-critical)',
    unknown: 'var(--text-muted)',
  };

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/overview" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Overview</Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{service.name}</h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)', wordBreak: 'break-all' }}>{service.endpoint_url}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: STATUS_COLOR[service.status ?? 'unknown'], fontWeight: 500 }}>
            ● {service.status ?? 'unknown'}
          </span>
          <Suspense fallback={null}><RangeToggle current={range} /></Suspense>
          <Link href={`/services/${service.id}/edit`} style={{
            padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12,
            textDecoration: 'none', fontWeight: 500,
          }}>Edit</Link>
          <RunCheckButton serviceId={service.id} />
        </div>
      </div>

      {/* Monitoring paused banner */}
      {service.monitoring_paused_reason && (
        <div style={{
          background: 'var(--status-degraded-bg)', border: '1px solid var(--status-degraded-border)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--status-degraded)', fontWeight: 500 }}>
              Monitoring paused
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 12 }}>
              {service.monitoring_paused_reason === 'SPEND_CAP_DAILY'
                ? 'Daily spend cap reached — paid checks resume automatically at UTC midnight.'
                : service.monitoring_paused_reason === 'SPEND_CAP_MONTHLY'
                ? 'Monthly spend cap reached — paid checks resume automatically on the 1st.'
                : 'Paid verification is paused.'}
            </span>
          </div>
        </div>
      )}

      {/* Open incident banner */}
      {openIncident && (
        <div style={{
          background: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--status-critical)', fontWeight: 500 }}>
              Open incident — {openIncident.severity}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 12 }}>
              {openIncident.failure_stage} · opened {formatRelative(openIncident.opened_at)}
            </span>
          </div>
          <Link href={`/incidents/${openIncident.id}`} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>View →</Link>
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetaCard label="Network" value={service.environment === 'mainnet' ? 'Base Mainnet' : 'Base Sepolia'} />
        <MetaCard label="Last checked" value={service.last_checked_at ? formatRelative(service.last_checked_at) : 'Never'} />
      </div>

      {/* Monitoring freshness */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Monitoring
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <MonitoringCard
            label="Lightweight ping"
            interval={fmtInterval(service.lightweight_check_interval_minutes ?? 5)}
            lastAt={service.last_lightweight_check_at}
            chipLabel="free"
            chipColor="#6b7280"
            chipBg="rgba(107,114,128,0.12)"
          />
          {service.paid_verification_mode !== 'disabled' && (
            <MonitoringCard
              label={service.paid_verification_mode === 'canary' ? 'Canary verification' : 'Full verification'}
              interval={fmtInterval(service.paid_verification_interval_minutes ?? service.check_interval_minutes)}
              lastAt={service.paid_verification_mode === 'full' ? service.last_full_verification_at : service.last_paid_verification_at}
              chipLabel={service.paid_verification_mode === 'canary' ? 'canary' : 'full'}
              chipColor={service.paid_verification_mode === 'canary' ? '#d97706' : '#2563eb'}
              chipBg={service.paid_verification_mode === 'canary' ? 'rgba(217,119,6,0.12)' : 'rgba(37,99,235,0.12)'}
            />
          )}
        </div>
      </div>

      {/* Latency chart */}
      {recentChecks && recentChecks.length >= 2 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Latency trend · {rl}
          </h2>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '16px 20px' }}>
            <LatencyChart checks={recentChecks} range={range} />
          </div>
        </div>
      )}

      {/* Recent checks */}
      <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Recent checks · {rl}
      </h2>

      <ChecksPanel checks={(recentChecks ?? []) as CheckRecord[]} />

      {/* Ownership verification */}
      {user && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Ownership verification
          </h2>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '20px 24px' }}>
            <VerifyPanel
              serviceId={service.id}
              initialStatus={service.verification_status ?? 'unverified'}
              initialToken={service.verification_token ?? null}
              verifiedAt={service.verified_at ?? null}
            />
          </div>
        </div>
      )}

      {/* Share / embed */}
      {user && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Share &amp; embed
          </h2>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '20px 24px' }}>
            <SharePanel serviceId={service.id} userId={user.id} />
          </div>
        </div>
      )}
    </div>
  );
}


function MonitoringCard({
  label,
  interval,
  lastAt,
  chipLabel,
  chipColor,
  chipBg,
}: {
  label: string;
  interval: string;
  lastAt: string | null | undefined;
  chipLabel: string;
  chipColor: string;
  chipBg: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-mid)',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: chipColor,
        background: chipBg,
        padding: '2px 7px',
        borderRadius: 4,
        flexShrink: 0,
      }}>
        {chipLabel}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {interval} · last {lastAt ? formatRelative(lastAt) : 'never'}
        </div>
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function LatencyChart({
  checks,
  range,
}: {
  checks: { latency_ms: number | null; started_at: string; status: string }[];
  range: Range;
}) {
  const allPoints = checks
    .filter(c => c.latency_ms != null)
    .map(c => ({ t: new Date(c.started_at).getTime(), ms: c.latency_ms!, status: c.status }))
    .sort((a, b) => a.t - b.t);

  if (allPoints.length < 2) return null;

  // For 7D/30D, aggregate into daily buckets to keep the chart readable
  let points: { t: number; ms: number; status: string }[];
  if (range === '24h') {
    points = allPoints;
  } else {
    const bucketCount = range === '7d' ? 7 : 30;
    const minT = allPoints[0].t;
    const maxT = allPoints[allPoints.length - 1].t;
    const bucketMs = (maxT - minT) / bucketCount || 86400000;
    const bucketSum: number[] = new Array(bucketCount).fill(0);
    const bucketCnt: number[] = new Array(bucketCount).fill(0);
    const bucketTime: number[] = Array.from({ length: bucketCount }, (_, i) => minT + (i + 0.5) * bucketMs);

    for (const p of allPoints) {
      const idx = Math.min(bucketCount - 1, Math.floor((p.t - minT) / bucketMs));
      bucketSum[idx] += p.ms;
      bucketCnt[idx]++;
    }
    points = bucketTime
      .map((t, i) => bucketCnt[i] > 0 ? ({ t, ms: Math.round(bucketSum[i] / bucketCnt[i]), status: 'passed' }) : null)
      .filter(Boolean) as { t: number; ms: number; status: string }[];
  }

  if (points.length < 2) return null;

  const maxMs = Math.max(...points.map(p => p.ms));
  const minMs = Math.min(...points.map(p => p.ms));
  const avgMs = Math.round(points.reduce((s, p) => s + p.ms, 0) / points.length);
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const W = 800, H = 72, PAD = 4;

  const cx = (t: number) => PAD + ((t - minT) / (maxT - minT || 1)) * (W - PAD * 2);
  const cy = (ms: number) => PAD + (1 - (ms - minMs) / (maxMs - minMs || 1)) * (H - PAD * 2);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${cx(p.t).toFixed(1)} ${cy(p.ms).toFixed(1)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 72, display: 'block', overflow: 'visible' }}>
        <path d={pathD} fill="none" stroke="var(--status-operational)" strokeWidth="1.5" strokeLinejoin="round" />
        {range === '24h' && points.map((p, i) => (
          <circle key={i} cx={cx(p.t)} cy={cy(p.ms)} r={3}
            fill={
              p.status === 'passed' ? 'var(--status-operational)'
              : p.status === 'error'  ? 'var(--text-muted)'
              : 'var(--status-critical)'
            }
            stroke="var(--bg-surface)" strokeWidth="1" />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
        {[['avg', avgMs], ['min', minMs], ['max', maxMs]].map(([label, val]) => (
          <div key={label}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label} </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>{val}ms</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {range === '24h' ? `last ${points.length} checks` : `daily avg · ${range}`}
          </span>
        </div>
      </div>
      {range === '24h' && (
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {[
            { label: 'Passed', color: 'var(--status-operational)' },
            { label: 'Failed', color: 'var(--status-critical)'    },
            { label: 'Error',  color: 'var(--text-muted)'          },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
