import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { StatusPageLink } from './_components/status-page-link';
import { RangeToggle } from '../_components/range-toggle';
import { parseRange, rangeToMs, rangeLabel } from '../_components/range-utils';
import type { Range } from '../_components/range-utils';
import { Suspense } from 'react';

const STATUS_COLORS: Record<string, string> = {
  operational: 'var(--status-operational)',
  degraded:    'var(--status-degraded)',
  critical:    'var(--status-critical)',
  unknown:     'var(--text-muted)',
};
const STATUS_LABELS: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Critical',
  unknown:     'Unknown',
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);
  const windowMs = rangeToMs(range);
  const rl = rangeLabel(range);

  const now = Date.now();
  const since = new Date(now - windowMs).toISOString();

  const bucketCount = range === '24h' ? 24 : range === '7d' ? 7 : 30;
  const checksLimit = range === '30d' ? 10000 : range === '7d' ? 5000 : 2000;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: services },
    { data: openIncidents },
    { data: windowChecks },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, endpoint_url, status, last_checked_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),

    supabase
      .from('incidents')
      .select('id, service_id, severity, failure_stage, opened_at, status')
      .in('status', ['open', 'acknowledged'])
      .order('opened_at', { ascending: false })
      .limit(8),

    supabase
      .from('checks')
      .select('service_id, status, latency_ms, started_at')
      .gte('started_at', since)
      .limit(checksLimit),
  ]);

  // ── Per-service incident count ──────────────────────────
  const incidentsByService = new Map<string, number>();
  for (const inc of openIncidents ?? []) {
    incidentsByService.set(inc.service_id, (incidentsByService.get(inc.service_id) ?? 0) + 1);
  }

  // ── Per-service avg latency (window) ───────────────────────
  const svcLatencySum = new Map<string, number>();
  const svcLatencyCount = new Map<string, number>();
  for (const c of windowChecks ?? []) {
    if (c.latency_ms == null || c.status === 'error') continue;
    svcLatencySum.set(c.service_id, (svcLatencySum.get(c.service_id) ?? 0) + c.latency_ms);
    svcLatencyCount.set(c.service_id, (svcLatencyCount.get(c.service_id) ?? 0) + 1);
  }
  const svcAvgLatency = new Map<string, number>();
  for (const [id, sum] of svcLatencySum) {
    const cnt = svcLatencyCount.get(id) ?? 1;
    svcAvgLatency.set(id, Math.round(sum / cnt));
  }

  // ── Bucket response time (variable count) ──────────────
  const bucketSum  = new Array(bucketCount).fill(0) as number[];
  const bucketCnt  = new Array(bucketCount).fill(0) as number[];
  const bucketMs   = windowMs / bucketCount;
  const windowStart = now - windowMs;

  for (const c of windowChecks ?? []) {
    if (c.latency_ms == null || c.status === 'error') continue;
    const t = new Date(c.started_at).getTime();
    const idx = Math.min(bucketCount - 1, Math.floor((t - windowStart) / bucketMs));
    if (idx >= 0) {
      bucketSum[idx] += c.latency_ms;
      bucketCnt[idx]++;
    }
  }
  const bucketAvg = bucketSum.map((s, i) => bucketCnt[i] > 0 ? Math.round(s / bucketCnt[i]) : null);

  // ── Uptime ──────────────────────────────────────────────
  let uptimePassed = 0, uptimeTotal = 0;
  for (const c of windowChecks ?? []) {
    if (c.status === 'error') continue;
    uptimeTotal++;
    if (c.status === 'passed') uptimePassed++;
  }
  const uptimePct = uptimeTotal > 0 ? uptimePassed / uptimeTotal : null;

  // ── Totals ──────────────────────────────────────────────
  const total            = services?.length ?? 0;
  const operationalCount = services?.filter(s => s.status === 'operational').length ?? 0;
  const openCount        = openIncidents?.length ?? 0;
  const checksCount      = (windowChecks ?? []).filter(c => c.status !== 'error').length;

  // ── Service name map ────────────────────────────────────
  const svcNameMap = new Map((services ?? []).map(s => [s.id, s.name]));

  return (
    <div className="overview-page" style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Overview</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Suspense fallback={null}><RangeToggle current={range} /></Suspense>
          <Link href="/services/new" className="btn-primary">+ Add service</Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Services',      value: String(total),        accent: undefined,                                          cls: 'anim-fade-up delay-1' },
          { label: 'Operational',         value: String(operationalCount), accent: 'var(--status-operational)',                    cls: 'anim-fade-up delay-2' },
          { label: 'Open Incidents',      value: String(openCount),    accent: openCount > 0 ? 'var(--status-critical)' : undefined, cls: 'anim-fade-up delay-3' },
          { label: `Checks (${rl})`,      value: String(checksCount),  accent: undefined,                                          cls: 'anim-fade-up delay-4' },
        ].map(({ label, value, accent, cls }) => (
          <div key={label} className={cls} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: accent ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Status page link */}
      {user && (
        <div className="anim-fade-up" style={{ animationDelay: '0.22s', marginBottom: 20 }}>
          <StatusPageLink userId={user.id} />
        </div>
      )}

      {/* Two-column body */}
      <div className="overview-body" style={{ display: 'grid', gridTemplateColumns: '1fr 272px', gap: 16, alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Response time chart */}
          <div className="chart-fade" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Response Time</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>avg · {rl}</span>
            </div>
            <ResponseTimeChart data={bucketAvg} range={range} />
          </div>

          {/* Services table */}
          {total === 0 ? (
            <EmptyState />
          ) : (
            <div className="anim-fade-up" style={{ animationDelay: '0.25s', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Services</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Service', 'Status', `Resp. (${rl})`, 'Last Check', 'Incidents'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 18px', fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {services?.map((svc, i) => {
                      const openCnt = incidentsByService.get(svc.id) ?? 0;
                      const avgMs   = svcAvgLatency.get(svc.id);
                      const isLast  = i === (services.length - 1);
                      return (
                        <tr key={svc.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '11px 18px', verticalAlign: 'middle' }}>
                            <Link href={`/services/${svc.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: 13 }}>
                              {svc.name}
                            </Link>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                              {svc.endpoint_url}
                            </div>
                          </td>
                          <td style={{ padding: '11px 18px', verticalAlign: 'middle' }}>
                            <StatusBadge status={svc.status ?? 'unknown'} />
                          </td>
                          <td style={{ padding: '11px 18px', verticalAlign: 'middle' }}>
                            {avgMs != null ? (
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>
                                {avgMs < 1000 ? `${avgMs}ms` : `${(avgMs / 1000).toFixed(1)}s`}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '11px 18px', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {svc.last_checked_at ? formatRelative(svc.last_checked_at) : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 18px', verticalAlign: 'middle' }}>
                            {openCnt > 0 ? (
                              <Link href="/incidents" style={{ fontSize: 12, color: 'var(--status-critical)', textDecoration: 'none' }}>
                                {openCnt} open
                              </Link>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Uptime donut */}
          <div className="anim-fade-up" style={{ animationDelay: '0.18s', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Uptime · {rl}</div>
            <UptimeDonut pct={uptimePct} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
              {[
                { label: 'Operational', color: 'var(--status-operational)', count: operationalCount },
                { label: 'Degraded',    color: 'var(--status-degraded)',    count: services?.filter(s => s.status === 'degraded').length ?? 0 },
                { label: 'Critical',    color: 'var(--status-critical)',     count: services?.filter(s => s.status === 'critical').length  ?? 0 },
              ].map(({ label, color, count }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {count}/{total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Incidents panel */}
          <div className="anim-fade-up" style={{ animationDelay: '0.24s', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Incidents</span>
              {openCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--status-critical)', background: 'var(--status-critical-bg)', padding: '1px 6px', borderRadius: 4 }}>
                  {openCount} open
                </span>
              )}
            </div>
            {(openIncidents ?? []).length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                No active incidents
              </div>
            ) : (
              <div>
                {openIncidents!.map((inc, i) => {
                  const svcName = svcNameMap.get(inc.service_id) ?? 'Unknown';
                  const isLast  = i === openIncidents!.length - 1;
                  return (
                    <Link
                      key={inc.id}
                      href={`/incidents/${inc.id}`}
                      className="incident-row-link"
                      style={{
                        display: 'block', padding: '10px 16px',
                        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          color: inc.severity === 'critical' ? 'var(--status-critical)' : 'var(--status-degraded)',
                          background: inc.severity === 'critical' ? 'var(--status-critical-bg)' : 'var(--status-degraded-bg)',
                          padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em',
                        }}>
                          {inc.severity === 'critical' ? 'P1' : 'P2'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {svcName}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 22 }}>
                        {inc.failure_stage ?? 'unknown stage'} · {formatRelative(inc.opened_at)}
                      </div>
                    </Link>
                  );
                })}
                {openCount > 0 && (
                  <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <Link href="/incidents" style={{ fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                      View all incidents →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Response Time Chart ────────────────────────────────────
function ResponseTimeChart({ data, range }: { data: (number | null)[]; range: Range }) {
  const validPts = data.map((v, i) => ({ i, v })).filter(p => p.v != null) as { i: number; v: number }[];

  if (validPts.length < 2) {
    return (
      <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>No data yet</span>
      </div>
    );
  }

  const vals = validPts.map(p => p.v);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals) * 0.9;
  const avgV = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  const W = 600, H = 72, padT = 4, padB = 4, padX = 2;
  const chartW = W - padX * 2, chartH = H - padT - padB;
  const lastIdx = data.length - 1;

  const cx = (i: number) => padX + (i / lastIdx) * chartW;
  const cy = (v: number) => padT + (1 - (v - minV) / (maxV - minV || 1)) * chartH;

  let line = '';
  let area = '';
  validPts.forEach((p, idx) => {
    const x = cx(p.i).toFixed(1), y = cy(p.v).toFixed(1);
    if (idx === 0) {
      line += `M ${x} ${y}`;
      area += `M ${x} ${(padT + chartH).toFixed(1)} L ${x} ${y}`;
    } else {
      line += ` L ${x} ${y}`;
      area += ` L ${x} ${y}`;
    }
    if (idx === validPts.length - 1) {
      area += ` L ${x} ${(padT + chartH).toFixed(1)} Z`;
    }
  });

  const startLabel = range === '30d' ? '30d ago' : range === '7d' ? '7d ago' : '24h ago';

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 72, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="rtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--status-operational)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--status-operational)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rtGrad)" />
        <path d={line} fill="none" stroke="var(--status-operational)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {validPts.length > 0 && (
          <circle
            cx={cx(validPts[validPts.length - 1].i)}
            cy={cy(validPts[validPts.length - 1].v)}
            r="3"
            fill="var(--status-operational)"
            stroke="var(--bg-surface)"
            strokeWidth="1.5"
          />
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{startLabel}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>avg {avgV}ms</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>now</span>
      </div>
    </div>
  );
}

// ── Uptime Donut ───────────────────────────────────────────
function UptimeDonut({ pct }: { pct: number | null }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = pct != null ? pct * circ : 0;
  const offset = circ - filled;
  const color = pct == null ? 'var(--text-dim)'
    : pct >= 0.99 ? 'var(--status-operational)'
    : pct >= 0.95 ? 'var(--status-degraded)'
    : 'var(--status-critical)';
  const label = pct != null ? `${(pct * 100).toFixed(1)}%` : '—';

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: 110, height: 110, display: 'block' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="7" />
        {pct != null && (
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${filled.toFixed(2)} ${circ.toFixed(2)}`}
            strokeDashoffset={offset}
            className="donut-arc"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        )}
        <text x="50" y="47" textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-primary)" fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans)">
          {label}
        </text>
        <text x="50" y="61" textAnchor="middle"
          fill="var(--text-dim)" fontSize="7" fontFamily="var(--font-geist-sans)">
          {pct != null ? 'overall uptime' : 'no data yet'}
        </text>
      </svg>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  const label = STATUS_LABELS[status] ?? 'Unknown';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color }}>{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>No services yet</div>
      <Link
        href="/services/new"
        style={{ fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', padding: '8px 16px', border: '1px solid var(--border-default)', borderRadius: 6 }}
      >
        Add your first service
      </Link>
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
