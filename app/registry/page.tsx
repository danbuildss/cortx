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
  tier1: '500K', tier2: '1M', tier3: '5M', tier4: '10M',
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

type RegistryEntry = {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  last_checked_at: string | null;
  check_interval_minutes: number | null;
  source: 'monitored' | 'seed';
  tier?: string;
  is_verified?: boolean;
  description?: string | null;
};

export default async function RegistryPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [{ data: monitoredRows }, { data: seedRows }] = await Promise.all([
    supabase
      .from('services')
      .select(`id, name, endpoint_url, status, last_checked_at, check_interval_minutes, profiles!inner(cortx_tier)`)
      .is('deleted_at', null)
      .in('profiles.cortx_tier', ['tier1', 'tier2', 'tier3', 'tier4']),
    supabase
      .from('registry_seeds')
      .select('id, name, endpoint_url, status, is_verified, description, created_at')
      .order('created_at', { ascending: false }),
  ]);

  const monitored: RegistryEntry[] = (monitoredRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    endpoint_url: r.endpoint_url,
    status: r.status ?? 'unknown',
    last_checked_at: r.last_checked_at,
    check_interval_minutes: r.check_interval_minutes,
    source: 'monitored',
    tier: (r.profiles as unknown as { cortx_tier: string })?.cortx_tier,
  }));

  const seeds: RegistryEntry[] = (seedRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    endpoint_url: r.endpoint_url,
    status: r.status ?? 'unknown',
    last_checked_at: null,
    check_interval_minutes: null,
    source: 'seed',
    is_verified: r.is_verified,
    description: r.description,
  }));

  // Verified seeds first, then monitored (sorted by tier), then unverified seeds
  const verifiedSeeds   = seeds.filter(s => s.is_verified);
  const unverifiedSeeds = seeds.filter(s => !s.is_verified);

  const sortedMonitored = monitored.sort((a, b) => {
    const diff = (TIER_ORDER[a.tier ?? ''] ?? 9) - (TIER_ORDER[b.tier ?? ''] ?? 9);
    if (diff !== 0) return diff;
    if (a.status === 'operational' && b.status !== 'operational') return -1;
    if (b.status === 'operational' && a.status !== 'operational') return 1;
    return 0;
  });

  const entries: RegistryEntry[] = [...verifiedSeeds, ...sortedMonitored, ...unverifiedSeeds];
  const operationalCount = entries.filter(e => e.status === 'operational').length;

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <a href="/login" style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', textDecoration: 'none' }}>Sign in</a>
          <a href="/signup" style={{
            fontSize: 12, fontWeight: 500, color: '#000',
            background: '#fff', borderRadius: 5,
            padding: '4px 12px', textDecoration: 'none',
          }}>Monitor a Service →</a>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 32px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 4, padding: '3px 9px', marginBottom: 14,
          }}>
            VERIFIED x402 SERVICES
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>
            x402 Service Registry
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted, #6b7280)', maxWidth: 540, lineHeight: 1.6 }}>
            Verified x402 endpoints checked by CORTX with real USDC on Base mainnet.
            Each listing shows live status from automated end-to-end checks — not self-reported uptime.
          </p>
          <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #f5f5f5)', display: 'block' }}>
                {entries.length}
              </span>
              Listed services
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', display: 'block' }}>
                {operationalCount}
              </span>
              Operational now
            </div>
          </div>
        </div>

        {/* Entries */}
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted, #6b7280)', fontSize: 14 }}>
            No services listed yet.{' '}
            <a
              href="https://bankr.bot/terminal/trade?out=0x23ec691cf7f9a3166fa663c73f6f5a0c26a5aba3&chain=base"
              target="_blank" rel="noopener noreferrer"
              style={{ color: '#f59e0b' }}
            >
              Hold 500K $CORTX
            </a>{' '}
            and add your service to get listed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map((entry) => {
              const statusColor = STATUS_COLOR[entry.status] ?? STATUS_COLOR.unknown;
              const isObserved = entry.source === 'seed' && !entry.is_verified;
              return (
                <div key={entry.id} style={{
                  background: 'var(--bg-surface, #111)',
                  border: `1px solid ${isObserved ? 'var(--border-subtle, #1f1f1f)' : 'var(--border-subtle, #1f1f1f)'}`,
                  borderRadius: 8, padding: '16px 20px',
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                  opacity: isObserved ? 0.75 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: statusColor, flexShrink: 0,
                        boxShadow: entry.status === 'operational' ? `0 0 5px ${statusColor}` : 'none',
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{entry.name}</span>
                      {/* Badge */}
                      {entry.source === 'monitored' && entry.tier && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                          color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.25)',
                          borderRadius: 3, padding: '1px 6px',
                        }}>
                          {TIER_LABEL[entry.tier] ?? ''} HOLDER
                        </span>
                      )}
                      {entry.source === 'seed' && entry.is_verified && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                          color: '#22c55e', background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          borderRadius: 3, padding: '1px 6px',
                        }}>
                          CORTX VERIFIED
                        </span>
                      )}
                      {isObserved && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                          color: 'var(--text-muted, #6b7280)',
                          border: '1px solid var(--border-subtle, #2a2a2a)',
                          borderRadius: 3, padding: '1px 6px',
                        }}>
                          OBSERVED
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--text-muted, #6b7280)',
                      fontFamily: 'ui-monospace, monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: entry.description ? 4 : 0,
                    }}>
                      {entry.endpoint_url}
                    </div>
                    {entry.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 2 }}>
                        {entry.description}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: statusColor, marginBottom: 4 }}>
                      {STATUS_LABEL[entry.status] ?? 'Unknown'}
                    </div>
                    {entry.last_checked_at ? (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
                          checked {timeAgo(entry.last_checked_at)}
                        </div>
                        {entry.check_interval_minutes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
                            every {entry.check_interval_minutes}m
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
                        Not yet monitored
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Get listed CTA */}
        <div style={{
          marginTop: 40,
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 10, padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Get your service listed</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              Hold 500K $CORTX on Base and add your x402 endpoint to CORTX.
              Your service gets real on-chain checks and a public uptime history.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            <a
              href="https://bankr.bot/terminal/trade?out=0x23ec691cf7f9a3166fa663c73f6f5a0c26a5aba3&chain=base"
              target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 13, fontWeight: 500, padding: '8px 16px',
                color: '#d97706', background: 'rgba(217,119,6,0.1)',
                border: '1px solid rgba(217,119,6,0.3)',
                borderRadius: 6, textDecoration: 'none',
              }}
            >
              Buy $CORTX
            </a>
            <a
              href="/signup"
              style={{
                fontSize: 13, fontWeight: 500, padding: '8px 16px',
                color: '#000', background: '#fff',
                border: 'none', borderRadius: 6, textDecoration: 'none',
              }}
            >
              Monitor a Service →
            </a>
          </div>
        </div>

        <div style={{
          marginTop: 32, paddingTop: 20,
          borderTop: '1px solid var(--border-subtle, #1f1f1f)',
          fontSize: 12, color: 'var(--text-muted, #6b7280)',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span>Refreshes every 2 minutes · Powered by CORTX · Real USDC checks on Base mainnet</span>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>usecortx.dev</Link>
        </div>
      </div>
    </div>
  );
}
