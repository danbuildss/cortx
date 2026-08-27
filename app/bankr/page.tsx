import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { computeMetrics } from '@/lib/metrics';
import { BankrWall, type WallRow } from './_components/bankr-wall';

export const metadata: Metadata = {
  title: 'CORTX × Bankr — x402 Reliability Monitoring',
  description: 'Every x402-gated skill in the Bankr marketplace, monitored by CORTX. Live delivery rates, uptime, and latency from real USDC checks on Base mainnet.',
  openGraph: {
    title: 'CORTX × Bankr — x402 Reliability Monitoring',
    description: "Every x402-gated skill in Bankr's marketplace, monitored by CORTX with real USDC checks on Base mainnet.",
    url: 'https://usecortx.dev/bankr',
    siteName: 'CORTX',
  },
};

export const revalidate = 120;

const BANKR_SKILL_URL = 'https://x402.bankr.bot/0xb98f0de777eea8c481b64e33d3e0066cea38fa91/cortx-reliability';

// Known Bankr x402 skills — seed list, grows as builders register
const KNOWN_BANKR_SKILLS: { name: string; url: string }[] = [
  { name: 'CORTX Reliability', url: BANKR_SKILL_URL },
];

type BankrCatalogEntry = {
  name?: string;
  url?: string;
  endpoint_url?: string;
  slug?: string;
  description?: string;
  price?: number;
};

async function fetchBankrCatalog(): Promise<{ name: string; url: string }[]> {
  const paths = ['', '/catalog', '/api/skills', '/skills'];
  for (const path of paths) {
    try {
      const res = await fetch(`https://x402.bankr.bot${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 120 },
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('json')) continue;
      const data = await res.json();
      const arr: BankrCatalogEntry[] = Array.isArray(data)
        ? data
        : (data?.skills ?? data?.endpoints ?? data?.items ?? []);
      if (arr.length > 0) {
        return arr.map(e => ({
          name: e.name ?? e.slug ?? 'Unnamed skill',
          url:  e.url ?? e.endpoint_url ?? '',
        })).filter(e => e.url);
      }
    } catch {
      // try next path
    }
  }
  // Fall back to the hardcoded seed list
  return KNOWN_BANKR_SKILLS;
}

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

export default async function BankrPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  // Fetch in parallel: CORTX registered Bankr services + Bankr catalog + recent checks
  const [{ data: services }, { data: recentChecks }, catalogEntries] = await Promise.all([
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

    fetchBankrCatalog(),
  ]);

  // Group checks by service
  type CheckRow = { service_id: string; status: string; latency_ms: number | null; stages: unknown };
  const checks: CheckRow[] = recentChecks ?? [];
  const checksByService = new Map<string, CheckRow[]>();
  for (const c of checks) {
    const arr = checksByService.get(c.service_id) ?? [];
    arr.push(c);
    checksByService.set(c.service_id, arr);
  }

  // Build a URL → CORTX service lookup
  type ServiceRow = { id: string; name: string; endpoint_url: string; status: string; last_checked_at: string | null };
  const cortxServices: ServiceRow[] = services ?? [];
  const urlToService = new Map<string, ServiceRow>();
  for (const svc of cortxServices) {
    urlToService.set(svc.endpoint_url.toLowerCase().replace(/\/$/, ''), svc);
  }

  // Also include any CORTX services that weren't in the catalog
  const catalogUrls = new Set(catalogEntries.map(e => e.url.toLowerCase().replace(/\/$/, '')));

  // Build combined wall rows: catalog entries first (matched + unmatched), then any orphaned CORTX services
  const rows: WallRow[] = [];
  const usedServiceIds = new Set<string>();

  for (const entry of catalogEntries) {
    const normalizedUrl = entry.url.toLowerCase().replace(/\/$/, '');
    const svc = urlToService.get(normalizedUrl);

    if (svc) {
      const svcChecks = checksByService.get(svc.id) ?? [];
      const m = computeMetrics(svcChecks);
      usedServiceIds.add(svc.id);
      rows.push({
        type: 'monitored',
        serviceId: svc.id,
        name: svc.name,
        endpointUrl: svc.endpoint_url,
        status: svc.status,
        lastCheckedAt: svc.last_checked_at,
        delivery: m.paid_delivery_percent,
        uptime: m.uptime_percent,
        latency: m.median_latency_ms,
      });
    } else {
      rows.push({
        type: 'unmonitored',
        name: entry.name,
        endpointUrl: entry.url,
      });
    }
  }

  // Append any CORTX services not in the catalog (labeled Bankr)
  for (const svc of cortxServices) {
    if (usedServiceIds.has(svc.id)) continue;
    const normalizedUrl = svc.endpoint_url.toLowerCase().replace(/\/$/, '');
    if (catalogUrls.has(normalizedUrl)) continue;
    const svcChecks = checksByService.get(svc.id) ?? [];
    const m = computeMetrics(svcChecks);
    rows.push({
      type: 'monitored',
      serviceId: svc.id,
      name: svc.name,
      endpointUrl: svc.endpoint_url,
      status: svc.status,
      lastCheckedAt: svc.last_checked_at,
      delivery: m.paid_delivery_percent,
      uptime: m.uptime_percent,
      latency: m.median_latency_ms,
    });
  }

  // Aggregate stats (monitored only)
  const monitored = rows.filter(r => r.type === 'monitored') as Extract<WallRow, { type: 'monitored' }>[];
  const totalChecks = monitored.reduce((s, r) => {
    return s + (checksByService.get(r.serviceId)?.length ?? 0);
  }, 0);
  const withDelivery = monitored.filter(r => r.delivery !== null);
  const avgDelivery = withDelivery.length > 0
    ? Math.round(withDelivery.reduce((s, r) => s + (r.delivery ?? 0), 0) / withDelivery.length * 10) / 10
    : null;
  const operational = monitored.filter(r => r.status === 'operational').length;

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
            { label: 'Skills in Bankr catalog', value: rows.length === 0 ? '—' : String(rows.length) },
            { label: 'CORTX monitored', value: monitored.length === 0 ? '—' : String(monitored.length) },
            { label: 'Avg delivery rate', value: avgDelivery === null ? '—' : `${avgDelivery}%` },
            { label: 'Total checks run', value: totalChecks === 0 ? '—' : totalChecks.toLocaleString() },
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

        {/* The live wall — client component */}
        <BankrWall rows={rows} />

        {/* Kupo analogy footer */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--border-subtle, #16181d)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              {
                label: 'Kupo × Bankr',
                rows: [
                  { k: 'Data layer', v: 'Live on-chain wallet signal data' },
                  { k: 'Appears in', v: 'Radar tab — "Kupo Radar · LIVE"' },
                  { k: 'Audience', v: 'Traders making buy decisions' },
                  { k: 'Trust signal', v: '"Smart money is buying this"' },
                ],
                muted: true,
              },
              {
                label: 'CORTX × Bankr',
                rows: [
                  { k: 'Data layer', v: 'x402 paid delivery reliability data' },
                  { k: 'Appears in', v: 'Skills section — CORTX 99.2% · 30d' },
                  { k: 'Audience', v: 'Users paying x402-gated skills' },
                  { k: 'Trust signal', v: '"This skill actually delivers after payment"' },
                ],
                muted: false,
              },
            ].map(({ label, rows: items, muted }) => (
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
                {items.map(({ k, v }) => (
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
