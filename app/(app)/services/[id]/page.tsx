import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RunCheckButton } from './run-check-button';
import { RangeToggle } from '../../_components/range-toggle';
import { parseRange, rangeToMs, rangeLabel } from '../../_components/range-utils';
import type { Range } from '../../_components/range-utils';
import { Suspense } from 'react';

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

  const { data: service } = await supabase
    .from('services')
    .select('id, name, endpoint_url, status, last_checked_at, check_interval_minutes, environment, expected_price, max_price')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!service) notFound();

  const { data: recentChecks } = await supabase
    .from('checks')
    .select('id, status, latency_ms, started_at, failure_stage, stages')
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

  const CHECK_COLOR: Record<string, string> = {
    passed: 'var(--status-operational)',
    failed: 'var(--status-critical)',
    error: 'var(--status-degraded)',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/overview" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Overview</Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{service.name}</h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}>{service.endpoint_url}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        <MetaCard label="Network" value={service.environment === 'mainnet' ? 'Base Mainnet' : 'Base Sepolia'} />
        <MetaCard label="Check interval" value={`Every ${service.check_interval_minutes}m`} />
        <MetaCard label="Last checked" value={service.last_checked_at ? formatRelative(service.last_checked_at) : 'Never'} />
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

      {!recentChecks?.length ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No checks in this window. Use &ldquo;Run check&rdquo; above or wait for the next scheduled run.</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                  {['Time', 'Status', 'Latency', 'Failed stage'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentChecks.map((chk, i) => {
                  const isLast = i === recentChecks.length - 1;
                  return (
                    <tr key={chk.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(chk.started_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: CHECK_COLOR[chk.status] ?? 'var(--text-muted)', fontWeight: 500 }}>
                          {chk.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {chk.latency_ms != null ? `${chk.latency_ms}ms` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--status-critical)', fontFamily: 'var(--font-geist-mono)' }}>
                        {chk.failure_stage ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {recentChecks[0] && (
            <StageBreakdown check={recentChecks[0]} />
          )}
        </>
      )}
    </div>
  );
}

type StageRow = {
  stage: string;
  passed: boolean | null;
  duration_ms: number | null;
  evidence: Record<string, unknown> | null;
  error?: string;
};

function StageBreakdown({ check }: { check: { status: string; failure_stage: string | null; stages: unknown } }) {
  const stages = (check.stages as StageRow[] | null) ?? [];
  if (!stages.length) return null;

  return (
    <div>
      <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Latest check — stage detail
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stages.map((s) => {
          const color = s.passed === true ? 'var(--status-operational)' : s.passed === false ? 'var(--status-critical)' : 'var(--text-muted)';
          const icon = s.passed === true ? '✓' : s.passed === false ? '✗' : '·';
          return (
            <div key={s.stage} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: s.evidence ? 8 : 0 }}>
                <span style={{ fontSize: 13, color, fontWeight: 600, width: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>{s.stage}</span>
                {s.error && <span style={{ fontSize: 12, color: 'var(--status-critical)', marginLeft: 8 }}>{s.error}</span>}
                {s.duration_ms != null && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.duration_ms}ms</span>}
              </div>
              {s.evidence && (
                <pre style={{
                  fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)',
                  background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: 4,
                  overflowX: 'auto', margin: '0 0 0 26px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {JSON.stringify(s.evidence, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
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
            fill={p.status === 'passed' ? 'var(--status-operational)' : 'var(--status-critical)'}
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
