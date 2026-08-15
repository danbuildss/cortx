import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';

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

const TIER_LABEL: Record<string, string> = {
  tier1: '500K',
  tier2: '1M',
  tier3: '5M',
  tier4: '10M',
};
const TIER_ORDER: Record<string, number> = {
  tier4: 0, tier3: 1, tier2: 2, tier1: 3,
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

export const revalidate = 120;

export default async function RegistryPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch services owned by 500K+ holders, not deleted
  const { data: rows } = await supabase
    .from('services')
    .select(`
      id, name, endpoint_url, status, last_checked_at, check_interval_minutes,
      profiles!inner (
        cortx_tier, is_admin
      )
    `)
    .is('deleted_at', null)
    .in('profiles.cortx_tier', ['tier1', 'tier2', 'tier3', 'tier4'])
    .order('status', { ascending: true });

  const services = (rows ?? []).sort((a, b) => {
    const tierA = (a.profiles as unknown as { cortx_tier: string })?.cortx_tier ?? 'tier1';
    const tierB = (b.profiles as unknown as { cortx_tier: string })?.cortx_tier ?? 'tier1';
    const diff = (TIER_ORDER[tierA] ?? 9) - (TIER_ORDER[tierB] ?? 9);
    if (diff !== 0) return diff;
    if (a.status === 'operational' && b.status !== 'operational') return -1;
    if (b.status === 'operational' && a.status !== 'operational') return 1;
    return 0;
  });

  const operationalCount = services.filter((s) => s.status === 'operational').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #0a0a0a)', color: 'var(--text-primary, #f5f5f5)' }}>
      {/* Nav */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle, #1f1f1f)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', height: 52, gap: 24,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
          <svg width="22" height="17" viewBox="0 0 80 60" fill="none">
            <circle cx="23" cy="30" r="18" stroke="currentColor" strokeWidth="3" />
            <circle cx="57" cy="30" r="18" stroke="currentColor" strokeWidth="3" />
            <line x1="7" y1="30" x2="33" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 23 A7 7 0 0 1 40 37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="40" cy="30" r="5" fill="currentColor" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600 }}>CORTX</span>
        </Link>
        <span style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>Public Registry</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 32px' }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 4, padding: '3px 9px', marginBottom: 14,
          }}>
            $CORTX HOLDERS
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>
            x402 Service Registry
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted, #6b7280)', maxWidth: 520, lineHeight: 1.6 }}>
            Verified x402 endpoints monitored by CORTX. Listed services are owned by wallets holding
            500,000+ $CORTX — continuously checked with real on-chain payments on Base mainnet.
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #f5f5f5)', display: 'block' }}>
                {services.length}
              </span>
              Listed services
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', display: 'block' }}>
                {operationalCount}
              </span>
              Operational now
            </div>
          </div>
        </div>

        {/* Table */}
        {services.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 0',
            color: 'var(--text-muted, #6b7280)', fontSize: 14,
          }}>
            No services listed yet.{' '}
            <a
              href="https://app.uniswap.org/swap?outputCurrency=0x23ec691cf7f9a3166fa663c73f6f5a0c26a5aba3&chain=base"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#f59e0b' }}
            >
              Hold 500K $CORTX
            </a>{' '}
            and add your service to appear here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {services.map((svc) => {
              const profile = svc.profiles as unknown as { cortx_tier: string };
              const statusColor = STATUS_COLOR[svc.status ?? 'unknown'] ?? STATUS_COLOR.unknown;
              return (
                <div key={svc.id} style={{
                  background: 'var(--bg-surface, #111)',
                  border: '1px solid var(--border-subtle, #1f1f1f)',
                  borderRadius: 8, padding: '16px 20px',
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: statusColor, flexShrink: 0,
                        boxShadow: svc.status === 'operational' ? `0 0 5px ${statusColor}` : 'none',
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{svc.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                        color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: 3, padding: '1px 6px',
                      }}>
                        {TIER_LABEL[profile?.cortx_tier] ?? '500K'}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--text-muted, #6b7280)',
                      fontFamily: 'ui-monospace, monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {svc.endpoint_url}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: statusColor, marginBottom: 4 }}>
                      {STATUS_LABEL[svc.status ?? 'unknown'] ?? 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
                      checked {timeAgo(svc.last_checked_at)}
                    </div>
                    {svc.check_interval_minutes && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
                        every {svc.check_interval_minutes}m
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          marginTop: 48, paddingTop: 24,
          borderTop: '1px solid var(--border-subtle, #1f1f1f)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
          fontSize: 12, color: 'var(--text-muted, #6b7280)',
        }}>
          <span>Refreshes every 2 minutes · Powered by CORTX on Base mainnet</span>
          <a
            href="https://app.uniswap.org/swap?outputCurrency=0x23ec691cf7f9a3166fa663c73f6f5a0c26a5aba3&chain=base"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 500 }}
          >
            Get listed → Hold 500K $CORTX
          </a>
        </div>
      </div>
    </div>
  );
}
