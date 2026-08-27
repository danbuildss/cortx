import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { computeMetrics } from '@/lib/metrics';

export const metadata: Metadata = {
  title: 'CORTX × Bankr — x402 Reliability Monitoring',
  description: 'Every x402-gated skill in the Bankr marketplace, monitored by CORTX. Live delivery rates, uptime, and latency from real USDC checks on Base mainnet.',
  openGraph: {
    title: 'CORTX × Bankr — x402 Reliability Monitoring',
    description: 'Every x402-gated skill in Bankr\'s marketplace, monitored by CORTX with real USDC checks on Base mainnet.',
    url: 'https://usecortx.dev/bankr',
    siteName: 'CORTX',
  },
};

export const revalidate = 120;

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e',
  degraded:    '#f59e0b',
  critical:    '#ef4444',
  unknown:     '#6b7280',
};
const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Critical',
  unknown:     'Unknown',
};

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function safeHref(url: string): string {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : '#';
  } catch {
    return '#';
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

type ServiceRow = {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  last_checked_at: string | null;
};

type CheckRow = {
  service_id: string;
  status: string;
  latency_ms: number | null;
  stages: unknown;
};

export default async function BankrPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  // Fetch Bankr-tagged services and their recent checks in parallel
  const [{ data: services }, { data: recentChecks }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, endpoint_url, status, last_checked_at')
      .is('deleted_at', null)
      .or('name.ilike.Bankr%,endpoint_url.ilike.%bankr%')
      .order('name', { ascending: true }),

    supabase
      .from('checks')
      .select('service_id, status, latency_ms, stages')
      .gte('started_at', since30)
      .order('started_at', { ascending: false })
      .limit(2000),
  ]);

  const rows: ServiceRow[] = services ?? [];
  const checks: CheckRow[] = recentChecks ?? [];

  // Group checks by service
  const checksByService = new Map<string, CheckRow[]>();
  for (const c of checks) {
    const arr = checksByService.get(c.service_id) ?? [];
    arr.push(c);
    checksByService.set(c.service_id, arr);
  }

  // Compute per-service metrics
  const serviceMetrics = rows.map(svc => {
    const svcChecks = checksByService.get(svc.id) ?? [];
    const m = computeMetrics(svcChecks);
    return { ...svc, metrics: m, checkCount: svcChecks.length };
  });

  // Aggregate stats
  const totalChecks = serviceMetrics.reduce((s, r) => s + r.checkCount, 0);
  const withDelivery = serviceMetrics.filter(r => r.metrics.paid_delivery_percent !== null);
  const avgDelivery = withDelivery.length > 0
    ? Math.round(withDelivery.reduce((s, r) => s + (r.metrics.paid_delivery_percent ?? 0), 0) / withDelivery.length * 10) / 10
    : null;
  const operational = serviceMetrics.filter(r => r.status === 'operational').length;

  const BANKR_SKILL_URL = 'https://x402.bankr.bot/0xb98f0de777eea8c481b64e33d3e0066cea38fa91/cortx-reliability';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page, #08090a)', color: 'var(--text-primary, #f0f1f3)', fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border-subtle, #16181d)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: 'var(--text-primary, #f0f1f3)' }}>CORTX</span>
          <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: 13 }}>× Bankr</span>
        </a>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/registry" style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', textDecoration: 'none' }}>Registry</a>
          <a href="/report" style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', textDecoration: 'none' }}>Free report</a>
          <a href="/" style={{ fontSize: 13, padding: '5px 12px', borderRadius: 6, background: 'var(--bg-elevated, #16181d)', border: '1px solid var(--border-default, #2a2d35)', color: 'var(--text-primary, #f0f1f3)', textDecoration: 'none' }}>Sign in</a>
        </div>
      </nav>

      {/* Header */}
      <div style={{ padding: '48px 24px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted, #6b7280)' }}>Bankr Skills</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>LIVE</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
          x402 Reliability — Powered by CORTX
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.6, maxWidth: 560 }}>
          Every x402-gated skill in Bankr&apos;s marketplace, monitored with real USDC checks on Base mainnet.
          7-stage delivery pipeline: availability → payment terms → price check → payment → delivery → JSON parse → schema validation.
        </p>
      </div>

      {/* Stats strip */}
      <div style={{ borderTop: '1px solid var(--border-subtle, #16181d)', borderBottom: '1px solid var(--border-subtle, #16181d)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            { label: 'Skills monitored', value: rows.length === 0 ? '—' : String(rows.length) },
            { label: 'Total checks run', value: totalChecks === 0 ? '—' : totalChecks.toLocaleString() },
            { label: 'Avg delivery rate', value: avgDelivery === null ? '—' : `${avgDelivery}%` },
            { label: 'Operational now', value: rows.length === 0 ? '—' : `${operational}/${rows.length}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Bankr skill callout */}
        <div style={{
          marginBottom: 32,
          padding: '16px 20px',
          borderRadius: 10,
          border: '1px solid var(--border-default, #2a2d35)',
          background: 'var(--bg-surface, #111214)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Get your skill monitored</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', lineHeight: 1.5 }}>
              Run the CORTX skill in Bankr to see your delivery rate and get your embeddable badge.
              Sign up at usecortx.dev to enable continuous monitoring and alerts.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a
              href={BANKR_SKILL_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 6,
                background: '#22c55e',
                color: '#000',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Run CORTX skill on Bankr
            </a>
            <a
              href="/"
              style={{
                fontSize: 12,
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-default, #2a2d35)',
                background: 'var(--bg-elevated, #16181d)',
                color: 'var(--text-secondary, #9ca3af)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Sign up free
            </a>
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div style={{
            border: '1px dashed var(--border-default, #2a2d35)',
            borderRadius: 10,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>No Bankr skills monitored yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Be the first Bankr builder to show buyers your delivery rate.
              Run the CORTX skill on Bankr to check your endpoint, then sign up for continuous monitoring.
            </div>
            <a
              href={BANKR_SKILL_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: 20,
                fontSize: 13,
                fontWeight: 600,
                padding: '9px 18px',
                borderRadius: 6,
                background: '#22c55e',
                color: '#000',
                textDecoration: 'none',
              }}
            >
              Run CORTX skill on Bankr →
            </a>
          </div>
        )}

        {/* Services table */}
        {rows.length > 0 && (
          <div style={{ border: '1px solid var(--border-subtle, #16181d)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 110px 110px 90px 100px 90px',
              gap: 0,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border-subtle, #16181d)',
              background: 'var(--bg-surface, #111214)',
            }}>
              {['Skill', 'Status', 'Delivery', 'Uptime', 'Latency', 'Last check'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted, #6b7280)' }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {serviceMetrics.map((svc, i) => {
              const color = STATUS_COLOR[svc.status] ?? '#6b7280';
              const label = STATUS_LABEL[svc.status] ?? 'Unknown';
              const delivery = svc.metrics.paid_delivery_percent;
              const uptime = svc.metrics.uptime_percent;
              const latency = svc.metrics.median_latency_ms;
              const badgeUrl = `https://usecortx.dev/api/badge/${svc.id}`;

              return (
                <div
                  key={svc.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 110px 90px 100px 90px',
                    gap: 0,
                    padding: '16px 20px',
                    borderBottom: i < serviceMetrics.length - 1 ? '1px solid var(--border-subtle, #16181d)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    alignItems: 'center',
                  }}
                >
                  {/* Name + URL */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{svc.name}</div>
                    <a
                      href={safeHref(svc.endpoint_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', textDecoration: 'none', fontFamily: 'monospace' }}
                    >
                      {shortUrl(svc.endpoint_url)}
                    </a>
                    <div style={{ marginTop: 6 }}>
                      <img
                        src={badgeUrl}
                        alt="CORTX badge"
                        style={{ height: 18, verticalAlign: 'middle' }}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color }}>{label}</span>
                  </div>

                  {/* Delivery */}
                  <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: delivery === null ? 'var(--text-muted, #6b7280)' : delivery >= 95 ? '#22c55e' : delivery >= 75 ? '#f59e0b' : '#ef4444' }}>
                    {delivery === null ? '—' : `${delivery}%`}
                  </div>

                  {/* Uptime */}
                  <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: uptime === null ? 'var(--text-muted, #6b7280)' : 'var(--text-secondary, #9ca3af)' }}>
                    {uptime === null ? '—' : `${uptime}%`}
                  </div>

                  {/* Latency */}
                  <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: latency === null ? 'var(--text-muted, #6b7280)' : 'var(--text-secondary, #9ca3af)' }}>
                    {latency === null ? '—' : `${latency}ms`}
                  </div>

                  {/* Last check */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>
                    {timeAgo(svc.last_checked_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Kupo analogy footer */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--border-subtle, #16181d)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              {
                label: 'Kupo × Bankr',
                what: 'Live on-chain wallet signal data',
                where: 'Radar tab — "Kupo Radar · LIVE"',
                who: 'Traders making buy decisions',
                signal: '"Smart money is buying this"',
                muted: true,
              },
              {
                label: 'CORTX × Bankr',
                what: 'x402 paid delivery reliability data',
                where: 'Skills section — CORTX 99.2% · 30d',
                who: 'Users paying x402-gated skills',
                signal: '"This skill actually delivers after payment"',
                muted: false,
              },
            ].map(({ label, what, where, who, signal, muted }) => (
              <div
                key={label}
                style={{
                  padding: '16px 20px',
                  borderRadius: 8,
                  border: `1px solid ${muted ? 'var(--border-subtle, #16181d)' : 'rgba(34,197,94,0.2)'}`,
                  background: muted ? 'transparent' : 'rgba(34,197,94,0.04)',
                  opacity: muted ? 0.55 : 1,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4px', marginBottom: 12, color: muted ? 'var(--text-muted, #6b7280)' : '#22c55e' }}>{label}</div>
                {[
                  { k: 'Data layer', v: what },
                  { k: 'Appears in', v: where },
                  { k: 'Audience', v: who },
                  { k: 'Trust signal', v: signal },
                ].map(({ k, v }) => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-dim, #4b5563)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>{v}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-dim, #4b5563)', margin: 0 }}>
            CORTX · <a href="https://usecortx.dev" style={{ color: 'var(--text-muted, #6b7280)', textDecoration: 'none' }}>usecortx.dev</a>
            {' · '}
            <a href={BANKR_SKILL_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted, #6b7280)', textDecoration: 'none' }}>Bankr skill</a>
            {' · '}
            <a href="/registry" style={{ color: 'var(--text-muted, #6b7280)', textDecoration: 'none' }}>Full registry</a>
          </p>
        </div>
      </div>
    </main>
  );
}
