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
const ALL_STAGES = 7;

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

type StageResult = { stage: string; passed: boolean | null };

type DailyRate = { rate: number; hasData: boolean };

function buildSparklineSvg(dailyRates: DailyRate[]): string {
  const w = 76, h = 28;
  const barW = 8, gap = 3;
  const maxBarH = h - 4;

  const bars = dailyRates.map((d, i) => {
    const x = i * (barW + gap);
    if (!d.hasData) {
      return `<rect x="${x}" y="${h - 4}" width="${barW}" height="4" fill="#1f1f1f" rx="1"/>`;
    }
    const barH = Math.max(4, (d.rate / 100) * maxBarH);
    const y = (h - barH).toFixed(1);
    const color = d.rate >= 95 ? '#22c55e' : d.rate >= 75 ? '#f59e0b' : '#ef4444';
    return `<rect x="${x}" y="${y}" width="${barW}" height="${barH.toFixed(1)}" fill="${color}" rx="1"/>`;
  }).join('');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

type MonitoredEntry = {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  last_checked_at: string | null;
  check_interval_minutes: number | null;
  tier: string;
  reliability: number | null;
  totalChecks: number;
  dailyRates: DailyRate[];
  stagePassed: number;
  stageTotal: number;
  sparklineSvg: string;
};

type SeedEntry = {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  is_verified: boolean;
  description: string | null;
};

export default async function RegistryPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch monitored services and seeds in parallel
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

  const serviceIds = (monitoredRows ?? []).map(r => r.id);

  // Fetch 7-day paid check history for all monitored services
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  type CheckRow = {
    service_id: string;
    started_at: string;
    status: string;
    stages: StageResult[] | null;
    check_type: string;
  };

  let checkRows: CheckRow[] = [];
  if (serviceIds.length > 0) {
    const { data } = await supabase
      .from('checks')
      .select('service_id, started_at, status, stages, check_type')
      .in('service_id', serviceIds)
      .in('check_type', ['canary', 'full'])
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false });
    checkRows = (data ?? []) as CheckRow[];
  }

  // Group checks by service_id
  const checksByService = new Map<string, CheckRow[]>();
  for (const check of checkRows) {
    if (!checksByService.has(check.service_id)) checksByService.set(check.service_id, []);
    checksByService.get(check.service_id)!.push(check);
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Build monitored entries with reliability stats
  const monitored: MonitoredEntry[] = (monitoredRows ?? []).map((row) => {
    const tier = (row.profiles as unknown as { cortx_tier: string })?.cortx_tier ?? '';
    const checks = checksByService.get(row.id) ?? [];

    const total = checks.length;
    const passed = checks.filter(c => c.status === 'passed').length;
    const reliability = total > 0 ? Math.round((passed / total) * 100) : null;

    // Daily breakdown: index 0 = 6 days ago, index 6 = today
    const dailyRates: DailyRate[] = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * dayMs;
      const dayEnd = dayStart + dayMs;
      const dayChecks = checks.filter(c => {
        const t = new Date(c.started_at).getTime();
        return t >= dayStart && t < dayEnd;
      });
      if (dayChecks.length === 0) return { rate: 0, hasData: false };
      const dayPassed = dayChecks.filter(c => c.status === 'passed').length;
      return { rate: Math.round((dayPassed / dayChecks.length) * 100), hasData: true };
    });

    // Stage score from most recent check
    let stagePassed = 0;
    let stageTotal = ALL_STAGES;
    if (checks.length > 0 && checks[0].stages) {
      const stages = checks[0].stages as StageResult[];
      stagePassed = stages.filter(s => s.passed === true).length;
      stageTotal = stages.length > 0 ? stages.length : ALL_STAGES;
    }

    return {
      id: row.id,
      name: row.name,
      endpoint_url: row.endpoint_url,
      status: row.status ?? 'unknown',
      last_checked_at: row.last_checked_at,
      check_interval_minutes: row.check_interval_minutes,
      tier,
      reliability,
      totalChecks: total,
      dailyRates,
      stagePassed,
      stageTotal,
      sparklineSvg: buildSparklineSvg(dailyRates),
    };
  });

  // Sort monitored by reliability desc (null last), then by status
  monitored.sort((a, b) => {
    if (a.reliability === null && b.reliability === null) return 0;
    if (a.reliability === null) return 1;
    if (b.reliability === null) return -1;
    return b.reliability - a.reliability;
  });

  // Seeds: verified first, then unverified
  const seeds: SeedEntry[] = (seedRows ?? []).map(r => ({
    id: r.id,
    name: r.name,
    endpoint_url: r.endpoint_url,
    status: r.status ?? 'unknown',
    is_verified: r.is_verified,
    description: r.description,
  }));
  const verifiedSeeds = seeds.filter(s => s.is_verified);
  const unverifiedSeeds = seeds.filter(s => !s.is_verified);
  const allSeeds = [...verifiedSeeds, ...unverifiedSeeds];

  const totalEntries = monitored.length + seeds.length;
  const operationalCount = monitored.filter(e => e.status === 'operational').length;
  const withData = monitored.filter(m => m.reliability !== null);
  const avgReliability = withData.length > 0
    ? Math.round(withData.reduce((s, m) => s + (m.reliability ?? 0), 0) / withData.length)
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #0a0a0a)', color: 'var(--text-primary, #f5f5f5)' }}>
      <style>{`
        @media (max-width: 600px) {
          .reg-nav { padding: 0 16px !important; }
          .reg-nav-sub { display: none !important; }
          .reg-content { padding: 28px 16px !important; }
          .reg-h1 { font-size: 22px !important; }
          .reg-card { padding: 12px 14px !important; }
          .reg-card-stats { width: 100% !important; justify-content: space-between !important; margin-top: 8px !important; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px !important; }
          .reg-url { max-width: 100% !important; }
          .reg-cta-btn-label { display: none !important; }
        }
      `}</style>

      {/* Nav */}
      <div className="reg-nav" style={{
        borderBottom: '1px solid var(--border-subtle, #1f1f1f)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', height: 52, gap: 16,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
          <svg width="22" height="17" viewBox="0 0 80 60" fill="none">
            <circle cx="23" cy="30" r="18" stroke="currentColor" strokeWidth="3" />
            <circle cx="57" cy="30" r="18" stroke="currentColor" strokeWidth="3" />
            <line x1="7" y1="30" x2="33" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 23 A7 7 0 0 1 40 37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="40" cy="30" r="5" fill="currentColor" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600 }}>CORTX</span>
        </Link>
        <span className="reg-nav-sub" style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>Public Registry</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexShrink: 0 }}>
          <a href="/login" style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', textDecoration: 'none' }}>Sign in</a>
          <a href="/signup" style={{
            fontSize: 12, fontWeight: 500, color: '#000',
            background: '#fff', borderRadius: 5,
            padding: '4px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            Monitor →
          </a>
        </div>
      </div>

      <div className="reg-content" style={{ maxWidth: 860, margin: '0 auto', padding: '48px 32px' }}>
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
          <h1 className="reg-h1" style={{ fontSize: 30, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>
            x402 Service Registry
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted, #6b7280)', maxWidth: 560, lineHeight: 1.6 }}>
            x402 endpoints checked by CORTX with real USDC on Base mainnet.
            Monitored services are ranked by verified reliability — not self-reported uptime.
          </p>
          <div style={{ display: 'flex', gap: 28, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #f5f5f5)', display: 'block' }}>
                {totalEntries}
              </span>
              Listed services
            </div>
            {monitored.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: operationalCount > 0 ? '#22c55e' : 'var(--text-muted, #6b7280)', display: 'block' }}>
                  {operationalCount}
                </span>
                Operational now
              </div>
            )}
            {avgReliability !== null && (
              <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', display: 'block' }}>
                  {avgReliability}%
                </span>
                Avg reliability · 7d
              </div>
            )}
          </div>
        </div>

        {totalEntries === 0 ? (
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

            {/* ── Monitored entries (ranked by reliability) ── */}
            {monitored.length > 0 && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
                  color: 'var(--text-muted, #6b7280)', marginBottom: 4, marginTop: 4,
                }}>
                  CORTX MONITORED — RANKED BY RELIABILITY
                </div>
                {monitored.map((entry, idx) => {
                  const rank = idx + 1;
                  const statusColor = STATUS_COLOR[entry.status] ?? STATUS_COLOR.unknown;
                  const reliabilityColor = entry.reliability === null
                    ? '#6b7280'
                    : entry.reliability >= 95 ? '#22c55e'
                    : entry.reliability >= 75 ? '#f59e0b'
                    : '#ef4444';

                  return (
                    <div key={entry.id} className="reg-card" style={{
                      background: 'var(--bg-surface, #111)',
                      border: `1px solid ${rank === 1 ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle, #1f1f1f)'}`,
                      borderRadius: 8, padding: '14px 18px',
                    }}>
                      {/* Top row: rank + name block */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {/* Rank */}
                        <div style={{
                          width: 28, flexShrink: 0, textAlign: 'center', paddingTop: 2,
                          fontSize: rank <= 3 ? 14 : 12,
                          fontWeight: rank <= 3 ? 700 : 500,
                          color: rank === 1 ? '#22c55e' : rank <= 3 ? '#f59e0b' : 'var(--text-muted, #6b7280)',
                        }}>
                          #{rank}
                        </div>

                        {/* Name + badges + URL */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: statusColor, flexShrink: 0,
                              boxShadow: entry.status === 'operational' ? `0 0 5px ${statusColor}` : 'none',
                            }} />
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{entry.name}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                              color: '#22c55e', background: 'rgba(34,197,94,0.1)',
                              border: '1px solid rgba(34,197,94,0.2)',
                              borderRadius: 3, padding: '1px 5px',
                            }}>
                              MONITORED
                            </span>
                            {entry.tier && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                                color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
                                border: '1px solid rgba(245,158,11,0.2)',
                                borderRadius: 3, padding: '1px 5px',
                              }}>
                                {TIER_LABEL[entry.tier] ?? ''} $CORTX
                              </span>
                            )}
                          </div>
                          <div className="reg-url" style={{
                            fontSize: 11, color: 'var(--text-muted, #6b7280)',
                            fontFamily: 'ui-monospace, monospace',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 360,
                          }}>
                            {entry.endpoint_url}
                          </div>
                        </div>
                      </div>

                      {/* Stats row: reliability + sparkline (left) · stage + status (right) */}
                      <div className="reg-card-stats" style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 12, paddingLeft: 40,
                      }}>
                        {/* Reliability + sparkline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div>
                            <div style={{
                              fontSize: 20, fontWeight: 700, color: reliabilityColor,
                              letterSpacing: '-0.01em', lineHeight: 1,
                            }}>
                              {entry.reliability !== null ? `${entry.reliability}%` : '—'}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', marginTop: 2 }}>
                              {entry.totalChecks > 0 ? `${entry.totalChecks} checks · 7d` : 'no data yet'}
                            </div>
                          </div>
                          <div
                            dangerouslySetInnerHTML={{ __html: entry.sparklineSvg }}
                            title="7-day reliability (left = 6 days ago, right = today)"
                          />
                        </div>

                        {/* Stage score + status + time */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {entry.totalChecks > 0 && (
                            <div style={{
                              fontSize: 11, fontWeight: 600, marginBottom: 2,
                              color: entry.stagePassed === entry.stageTotal ? '#22c55e' : '#f59e0b',
                            }}>
                              {entry.stagePassed}/{entry.stageTotal} stages
                            </div>
                          )}
                          <div style={{ fontSize: 12, fontWeight: 500, color: statusColor }}>
                            {STATUS_LABEL[entry.status] ?? 'Unknown'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', marginTop: 1 }}>
                            {timeAgo(entry.last_checked_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Seeds section ── */}
            {allSeeds.length > 0 && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
                  color: 'var(--text-muted, #6b7280)',
                  marginTop: monitored.length > 0 ? 20 : 4, marginBottom: 4,
                }}>
                  VERIFIED DIRECTORY
                </div>
                {allSeeds.map((entry) => {
                  const isObserved = !entry.is_verified;
                  return (
                    <div key={entry.id} style={{
                      background: 'var(--bg-surface, #111)',
                      border: '1px solid var(--border-subtle, #1f1f1f)',
                      borderRadius: 8, padding: '14px 18px',
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                      opacity: isObserved ? 0.7 : 1,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{entry.name}</span>
                          {entry.is_verified && (
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
                        <a href="/signup" style={{
                          fontSize: 11, fontWeight: 600,
                          color: '#f59e0b', textDecoration: 'none',
                          display: 'inline-block', marginBottom: 4,
                        }}>
                          Get monitored →
                        </a>
                        <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)' }}>
                          Listed · not yet ranked
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
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
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Get ranked on the leaderboard</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              Hold 500K $CORTX on Base and add your x402 endpoint. CORTX runs real paid checks
              and ranks you by verified reliability — not self-reported uptime.
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
          <span>Ranked by verified reliability · Real USDC checks on Base mainnet · Refreshes every 2 minutes</span>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>usecortx.dev</Link>
        </div>
      </div>
    </div>
  );
}
