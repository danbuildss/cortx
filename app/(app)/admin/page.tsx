import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { CopyButton } from '@/components/copy-button';
import { getWalletAddress, getWalletBalance } from '@/lib/check-runner/payment';

const ADMIN_USER_ID = 'e9374851-ac6f-4f1e-a131-6747fc37184a';

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== ADMIN_USER_ID) redirect('/overview');

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const fetchWalletBalance = async (): Promise<string | null> => {
    try { return await getWalletBalance(getWalletAddress()); } catch { return null; }
  };

  const [
    authResult,
    { data: allServices },
    { data: checks24h },
    { data: inviteCodes },
    { data: recentIncidents },
    { data: telegramConns },
    { data: todaySpendRows },
    { data: monthSpendRows },
    walletBalance,
  ] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 100 }),
    service.from('services').select('id, user_id, name, endpoint_url, status, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
    service.from('checks').select('service_id, status, failure_stage, observed_price').gte('started_at', since24h),
    service.from('invite_codes').select('id, code, used_by, used_at').order('used_at', { ascending: false, nullsFirst: false }),
    service.from('incidents').select('id, service_id, status, created_at').order('created_at', { ascending: false }).limit(20),
    service.from('telegram_connections').select('user_id').eq('active', true),
    service.from('checks').select('observed_price').gte('started_at', todayStart.toISOString()).in('status', ['passed', 'success']),
    service.from('checks').select('observed_price').gte('started_at', monthStart.toISOString()).in('status', ['passed', 'success']),
    fetchWalletBalance(),
  ]);

  const authUsers = authResult.data?.users ?? [];
  const services = allServices ?? [];
  const codes = inviteCodes ?? [];
  const incidents = recentIncidents ?? [];

  // Core metrics
  const betaUsers = authUsers.filter(u => u.id !== ADMIN_USER_ID);
  const totalChecks = checks24h?.length ?? 0;
  const successChecks = checks24h?.filter(c => c.status === 'success' || c.status === 'passed').length ?? 0;
  const avgUptime = totalChecks > 0 ? (successChecks / totalChecks * 100).toFixed(1) : null;
  const usedCodes = codes.filter(c => c.used_at);
  const freeCodes = codes.filter(c => !c.used_at);

  // Services by status
  const operationalCount = services.filter(s => s.status === 'operational').length;
  const issueCount = services.filter(s => s.status === 'degraded' || s.status === 'critical').length;

  // Inactive users (signed up, 0 services)
  const servicesByUser = new Map<string, number>();
  for (const svc of services) servicesByUser.set(svc.user_id, (servicesByUser.get(svc.user_id) ?? 0) + 1);
  const inactiveCount = betaUsers.filter(u => !servicesByUser.has(u.id)).length;

  // Telegram connections
  const telegramUserIds = new Set((telegramConns ?? []).map(t => t.user_id));
  const telegramCount = betaUsers.filter(u => telegramUserIds.has(u.id)).length;

  // Stage failure breakdown
  const stageFails = new Map<string, number>();
  for (const c of (checks24h ?? [])) {
    if (c.failure_stage) stageFails.set(c.failure_stage, (stageFails.get(c.failure_stage) ?? 0) + 1);
  }
  const stageFailList = Array.from(stageFails.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxStageFailCount = stageFailList[0]?.[1] ?? 1;

  // Spend tracking
  const dailyCap = parseFloat(process.env.CORTX_DAILY_SPEND_CAP_USDC ?? '1.00');
  const monthlyCap = parseFloat(process.env.CORTX_MONTHLY_SPEND_CAP_USDC ?? '10.00');
  const todaySpend = (todaySpendRows ?? []).reduce((s, r) => s + parseFloat(String(r.observed_price ?? '0')), 0);
  const monthSpend = (monthSpendRows ?? []).reduce((s, r) => s + parseFloat(String(r.observed_price ?? '0')), 0);

  // Top cost by service (24h)
  const spendByService = new Map<string, { total: number; count: number }>();
  for (const c of (checks24h ?? [])) {
    if (c.observed_price) {
      const prev = spendByService.get(c.service_id) ?? { total: 0, count: 0 };
      spendByService.set(c.service_id, { total: prev.total + parseFloat(String(c.observed_price)), count: prev.count + 1 });
    }
  }
  const topCostServices = Array.from(spendByService.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([svcId, { total, count }]) => {
      const svc = services.find(s => s.id === svcId);
      const u = svc ? authUsers.find(a => a.id === svc.user_id) : null;
      return { svcId, endpoint: svc?.endpoint_url ?? svcId, email: u?.email ?? '—', total, count, avg: count > 0 ? total / count : 0 };
    });
  const maxServiceCost = topCostServices[0]?.total ?? 1;

  // Code by email
  const codeByEmail = new Map<string, string>();
  for (const code of codes) {
    if (code.used_by) codeByEmail.set(code.used_by.toLowerCase(), code.code);
  }

  // Activity feed
  type FeedItem = { label: string; sub: string; ts: string; color: string; };
  const feed: FeedItem[] = [];

  for (const code of codes.filter(c => c.used_at && c.used_by)) {
    feed.push({ label: 'joined the beta', sub: code.used_by!, ts: code.used_at!, color: '#22c55e' });
  }
  for (const svc of services) {
    const u = authUsers.find(a => a.id === svc.user_id);
    if (u?.email) feed.push({ label: 'added endpoint', sub: svc.endpoint_url, ts: svc.created_at, color: '#6b7280' });
  }
  for (const inc of incidents) {
    const svc = services.find(s => s.id === inc.service_id);
    const u = svc ? authUsers.find(a => a.id === svc.user_id) : null;
    if (u?.email) {
      feed.push({
        label: inc.status === 'resolved' ? 'Incident resolved' : 'Incident opened',
        sub: u.email,
        ts: inc.created_at,
        color: inc.status === 'resolved' ? '#22c55e' : '#ef4444',
      });
    }
  }
  feed.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const topFeed = feed.slice(0, 8);

  const sortedUsers = [...betaUsers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Styles
  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' };
  const cardHeader: React.CSSProperties = { padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const cardTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Admin</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Internal overview — not visible to other users</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '4px 10px', background: 'rgba(239,68,68,0.08)', color: 'var(--status-critical)', border: '1px solid rgba(239,68,68,0.18)' }}>
          Owner only
        </span>
      </div>

      {/* Metric row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        {[
          { label: 'Beta Users',          value: String(betaUsers.length),          sub: `${usedCodes.length} of ${codes.length} codes used` },
          { label: 'Endpoints Monitored', value: String(services.length),           sub: 'across all users' },
          { label: 'Checks (24h)',        value: totalChecks.toLocaleString(),       sub: totalChecks > 0 ? `~${Math.round(totalChecks / 24)}/hr` : 'no data yet' },
          { label: 'Avg Uptime',          value: avgUptime ? `${avgUptime}%` : '—', sub: 'across all services', green: avgUptime !== null && parseFloat(avgUptime) >= 95 },
        ].map(({ label, value, sub, green }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: green ? 'var(--status-ok)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Metric row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Operational',       value: String(operationalCount), sub: `of ${services.length} endpoints`,    green: issueCount === 0 },
          { label: 'Degraded / Critical', value: String(issueCount),    sub: 'need attention',                     amber: issueCount > 0 },
          { label: 'Inactive Signups',  value: String(inactiveCount),   sub: 'joined, 0 services added',           amber: inactiveCount > 0 },
          { label: 'Telegram Connected', value: String(telegramCount),  sub: `of ${betaUsers.length} users` },
        ].map(({ label, value, sub, green, amber }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4, color: green ? 'var(--status-ok)' : amber ? 'var(--status-degraded)' : 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Wallet & Spend */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          {/* USDC Balance */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>USDC Balance</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
              {walletBalance !== null ? `${parseFloat(walletBalance).toFixed(2)}` : '—'}
              {walletBalance !== null && <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}> USDC</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Base mainnet · CORTX_TEST_WALLET_KEY</div>
          </div>

          {/* Today's Spend */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Today's Spend</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8 }}>
              ${todaySpend.toFixed(4)}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> / ${dailyCap.toFixed(2)}</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-muted)', borderRadius: 2, marginBottom: 4 }}>
              <div style={{ height: 4, borderRadius: 2, background: todaySpend / dailyCap > 0.8 ? 'var(--status-critical)' : 'var(--status-ok)', width: `${Math.min((todaySpend / dailyCap) * 100, 100)}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CORTX_DAILY_SPEND_CAP_USDC</div>
          </div>

          {/* Monthly Spend */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Monthly Spend</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8 }}>
              ${monthSpend.toFixed(4)}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> / ${monthlyCap.toFixed(2)}</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-muted)', borderRadius: 2, marginBottom: 4 }}>
              <div style={{ height: 4, borderRadius: 2, background: monthSpend / monthlyCap > 0.8 ? 'var(--status-critical)' : 'var(--status-ok)', width: `${Math.min((monthSpend / monthlyCap) * 100, 100)}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CORTX_MONTHLY_SPEND_CAP_USDC</div>
          </div>
        </div>

        {/* Top cost by service */}
        {topCostServices.length > 0 && (
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Top Cost by Service (24h)</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>USDC on Base</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Endpoint', 'Owner', 'Avg / call', 'Checks', 'Total (24h)'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topCostServices.map(({ svcId, endpoint, email, total, count, avg }, i) => {
                    const isLast = i === topCostServices.length - 1;
                    const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', verticalAlign: 'middle' };
                    return (
                      <tr key={svcId}>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-geist-mono)', color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{endpoint}</div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{email}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>${avg.toFixed(4)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{count}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 56, height: 4, background: 'var(--bg-muted)', borderRadius: 2, flexShrink: 0 }}>
                              <div style={{ height: 4, borderRadius: 2, background: '#3b82f6', width: `${Math.round((total / maxServiceCost) * 100)}%` }} />
                            </div>
                            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 500 }}>${total.toFixed(4)}</span>
                          </div>
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

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Beta users table */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Beta Users</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{betaUsers.length} user{betaUsers.length !== 1 ? 's' : ''}</span>
            </div>
            {sortedUsers.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No beta users yet</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['User', 'Services', 'Telegram', 'Joined', 'Code used'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 18px', fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((u, i) => {
                      const isLast = i === sortedUsers.length - 1;
                      const code = codeByEmail.get((u.email ?? '').toLowerCase());
                      const svcCount = servicesByUser.get(u.id) ?? 0;
                      const hasTelegram = telegramUserIds.has(u.id);
                      const tdStyle: React.CSSProperties = { padding: '11px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', verticalAlign: 'middle' };
                      return (
                        <tr key={u.id}>
                          <td style={tdStyle}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{u.email}</div>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 13, color: svcCount === 0 ? 'var(--status-degraded)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{svcCount}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: hasTelegram ? 'rgba(34,197,94,0.08)' : 'rgba(107,114,128,0.1)',
                              color: hasTelegram ? 'var(--status-ok)' : 'var(--text-dim)',
                            }}>
                              {hasTelegram ? '✓' : '–'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</span>
                          </td>
                          <td style={{ ...tdStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {code
                              ? <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{code}</span>
                              : <span style={{ fontSize: 11, color: 'var(--text-dim)', flex: 1 }}>—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stage failure breakdown */}
          {stageFailList.length > 0 && (
            <div style={card}>
              <div style={cardHeader}>
                <span style={cardTitle}>Stage Failures (24h)</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>across all users</span>
              </div>
              <div style={{ padding: '8px 16px' }}>
                {stageFailList.map(([stage, count]) => (
                  <div key={stage} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, fontFamily: 'var(--font-geist-mono)' }}>{stage}</span>
                    <div style={{ width: 120, height: 4, background: 'var(--bg-muted)', borderRadius: 2, margin: '0 12px' }}>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--status-critical)', width: `${Math.round((count / maxStageFailCount) * 100)}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Invite codes — full list with copy */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Invite Codes</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{usedCodes.length} used · {freeCodes.length} left</span>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {codes.map((code, i) => {
                const isLast = i === codes.length - 1;
                return (
                  <div key={code.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{code.code}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                        {code.used_by ? `${code.used_by} · ${formatDate(code.used_at!)}` : 'Available'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: code.used_at ? 'rgba(34,197,94,0.08)' : 'rgba(107,114,128,0.1)',
                        color: code.used_at ? 'var(--status-ok)' : 'var(--text-muted)',
                      }}>
                        {code.used_at ? 'Used' : 'Free'}
                      </span>
                      <CopyButton text={code.code} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity feed */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Recent Activity</span>
            </div>
            {topFeed.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No activity yet</div>
            ) : topFeed.map((item, i) => {
              const isLast = i === topFeed.length - 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.sub}</span>{' '}
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{timeAgo(item.ts)}</div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
