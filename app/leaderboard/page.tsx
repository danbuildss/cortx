import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const revalidate = 120;

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e',
  degraded:    '#f59e0b',
  critical:    '#ef4444',
  unknown:     '#6b7280',
};
const TIER_LABEL: Record<string, string> = {
  tier1: '500K', tier2: '1M', tier3: '5M', tier4: '10M',
};
const ALL_STAGES = [
  'availability', 'payment_terms', 'price_check',
  'payment', 'delivery', 'json_parse', 'schema_validation',
];

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

type StageResult = { stage: string; passed: boolean | null };

type DailyRate = { rate: number; hasData: boolean };

function buildSparklineSvg(dailyRates: DailyRate[]): string {
  const w = 76, h = 30;
  const barW = 8, gap = 3;
  const maxBarH = h - 4;

  const bars = dailyRates.map((d, i) => {
    const x = i * (barW + gap);
    if (!d.hasData) {
      return `<rect x="${x}" y="${h - 4}" width="${barW}" height="4" fill="#1f1f1f" rx="1"/>`;
    }
    const barH = Math.max(4, (d.rate / 100) * maxBarH);
    const y = h - barH;
    const color = d.rate >= 95 ? '#22c55e' : d.rate >= 75 ? '#f59e0b' : '#ef4444';
    return `<rect x="${x}" y="${y.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}" fill="${color}" rx="1"/>`;
  }).join('');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

type ServiceStats = {
  id: string;
  name: string;
  endpoint_url: string;
  status: string;
  last_checked_at: string | null;
  tier: string;
  reliability: number | null;
  totalChecks: number;
  dailyRates: DailyRate[];
  stagePassed: number;
  stageTotal: number;
  sparklineSvg: string;
};

export default async function LeaderboardPage() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Fetch monitored services
  const { data: monitoredRows } = await supabase
    .from('services')
    .select(`id, name, endpoint_url, status, last_checked_at, check_interval_minutes, profiles!inner(cortx_tier)`)
    .is('deleted_at', null)
    .in('profiles.cortx_tier', ['tier1', 'tier2', 'tier3', 'tier4']);

  const serviceIds = (monitoredRows ?? []).map(r => r.id);

  // 2. Fetch 7-day paid check history in one query
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

  // 3. Group checks by service_id
  const checksByService = new Map<string, CheckRow[]>();
  for (const check of checkRows) {
    if (!checksByService.has(check.service_id)) {
      checksByService.set(check.service_id, []);
    }
    checksByService.get(check.service_id)!.push(check);
  }

  // 4. Compute stats per service
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const stats: ServiceStats[] = (monitoredRows ?? []).map((row) => {
    const tier = (row.profiles as unknown as { cortx_tier: string })?.cortx_tier ?? '';
    const checks = checksByService.get(row.id) ?? [];

    // Total reliability
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
    let stageTotal = ALL_STAGES.length;
    if (checks.length > 0 && checks[0].stages) {
      const stages = checks[0].stages as StageResult[];
      stagePassed = stages.filter(s => s.passed === true).length;
      stageTotal = stages.length > 0 ? stages.length : ALL_STAGES.length;
    }

    return {
      id: row.id,
      name: row.name,
      endpoint_url: row.endpoint_url,
      status: row.status ?? 'unknown',
      last_checked_at: row.last_checked_at,
      tier,
      reliability,
      totalChecks: total,
      dailyRates,
      stagePassed,
      stageTotal,
      sparklineSvg: buildSparklineSvg(dailyRates),
    };
  });

  // 5. Sort: by reliability desc (null last), then by status
  stats.sort((a, b) => {
    if (a.reliability === null && b.reliability === null) return 0;
    if (a.reliability === null) return 1;
    if (b.reliability === null) return -1;
    return b.reliability - a.reliability;
  });

  const monitoredCount = stats.length;
  const withData = stats.filter(s => s.reliability !== null);
  const avgReliability = withData.length > 0
    ? Math.round(withData.reduce((sum, s) => sum + (s.reliability ?? 0), 0) / withData.length)
    : null;

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
        <span style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>Leaderboard</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <a href="/login" style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', textDecoration: 'none' }}>Sign in</a>
          <a href="/signup" style={{
            fontSize: 12, fontWeight: 500, color: '#000',
            background: '#fff', borderRadius: 5,
            padding: '4px 12px', textDecoration: 'none',
          }}>Monitor a Service →</a>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 32px' }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            color: '#22c55e', background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 4, padding: '3px 9px', marginBottom: 14,
          }}>
            CORTX MONITORED
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>
            x402 Reliability Leaderboard
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted, #6b7280)', maxWidth: 560, lineHeight: 1.6 }}>
            Endpoints ranked by verified reliability — real USDC checks on Base mainnet, not self-reported uptime.
            Updated every 2 minutes.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 28, marginTop: 22, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #f5f5f5)', display: 'block', letterSpacing: '-0.01em' }}>
                {monitoredCount}
              </span>
              Monitored endpoints
            </div>
            {avgReliability !== null && (
              <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#22c55e', display: 'block', letterSpacing: '-0.01em' }}>
                  {avgReliability}%
                </span>
                Avg reliability · 7 days
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #f5f5f5)', display: 'block', letterSpacing: '-0.01em' }}>
                {stats.filter(s => s.status === 'operational').length}
              </span>
              Operational now
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 24,
          borderBottom: '1px solid var(--border-subtle, #1f1f1f)',
        }}>
          <Link href="/registry" style={{
            fontSize: 13, fontWeight: 500, padding: '8px 16px',
            color: 'var(--text-muted, #6b7280)', textDecoration: 'none',
            borderBottom: '2px solid transparent',
            marginBottom: -1,
          }}>
            All Services
          </Link>
          <span style={{
            fontSize: 13, fontWeight: 600, padding: '8px 16px',
            color: 'var(--text-primary, #f5f5f5)',
            borderBottom: '2px solid #22c55e',
            marginBottom: -1,
          }}>
            Leaderboard
          </span>
        </div>

        {/* Leaderboard entries */}
        {stats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted, #6b7280)', fontSize: 14 }}>
            No monitored endpoints yet.{' '}
            <a href="/signup" style={{ color: '#22c55e' }}>Add yours →</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.map((entry, idx) => {
              const statusColor = STATUS_COLOR[entry.status] ?? STATUS_COLOR.unknown;
              const rank = idx + 1;
              const reliabilityColor = entry.reliability === null
                ? '#6b7280'
                : entry.reliability >= 95 ? '#22c55e'
                : entry.reliability >= 75 ? '#f59e0b'
                : '#ef4444';

              return (
                <div key={entry.id} style={{
                  background: 'var(--bg-surface, #111)',
                  border: `1px solid ${rank === 1 ? 'rgba(34,197,94,0.25)' : 'var(--border-subtle, #1f1f1f)'}`,
                  borderRadius: 8,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  flexWrap: 'wrap',
                }}>
                  {/* Rank */}
                  <div style={{
                    width: 32, flexShrink: 0,
                    fontSize: rank <= 3 ? 15 : 13,
                    fontWeight: rank <= 3 ? 700 : 500,
                    color: rank === 1 ? '#22c55e' : rank === 2 ? '#f59e0b' : rank === 3 ? '#f59e0b' : 'var(--text-muted, #6b7280)',
                    textAlign: 'center',
                  }}>
                    #{rank}
                  </div>

                  {/* Status dot + Name + Badges */}
                  <div style={{ flex: 1, minWidth: 160 }}>
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
                    <div style={{
                      fontSize: 11, color: 'var(--text-muted, #6b7280)',
                      fontFamily: 'ui-monospace, monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 340,
                    }}>
                      {entry.endpoint_url}
                    </div>
                  </div>

                  {/* Reliability + Sparkline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 22, fontWeight: 700, color: reliabilityColor,
                        letterSpacing: '-0.01em', lineHeight: 1,
                      }}>
                        {entry.reliability !== null ? `${entry.reliability}%` : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', marginTop: 2 }}>
                        {entry.totalChecks > 0
                          ? `${entry.totalChecks} check${entry.totalChecks !== 1 ? 's' : ''} · 7d`
                          : 'no data yet'}
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div
                      style={{ flexShrink: 0 }}
                      dangerouslySetInnerHTML={{ __html: entry.sparklineSvg }}
                      title="7-day reliability (left = 6 days ago, right = today)"
                    />
                  </div>

                  {/* Stage score + Status */}
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                    {entry.totalChecks > 0 && (
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: entry.stagePassed === entry.stageTotal ? '#22c55e' : '#f59e0b',
                        marginBottom: 3,
                      }}>
                        {entry.stagePassed}/{entry.stageTotal} stages
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 500, color: statusColor }}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', marginTop: 1 }}>
                      {timeAgo(entry.last_checked_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Get listed CTA */}
        <div style={{
          marginTop: 40,
          background: 'rgba(34,197,94,0.05)',
          border: '1px solid rgba(34,197,94,0.15)',
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
                color: '#16a34a', background: 'rgba(22,163,74,0.1)',
                border: '1px solid rgba(22,163,74,0.3)',
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
