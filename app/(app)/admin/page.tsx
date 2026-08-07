import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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

  const [
    authResult,
    { data: allServices },
    { data: checks24h },
    { data: inviteCodes },
    { data: recentIncidents },
  ] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 100 }),
    service.from('services').select('id, user_id, name, endpoint_url, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
    service.from('checks').select('service_id, status').gte('started_at', since24h),
    service.from('invite_codes').select('id, code, used_by, used_at').order('used_at', { ascending: false, nullsFirst: false }),
    service.from('incidents').select('id, service_id, status, created_at').order('created_at', { ascending: false }).limit(20),
  ]);

  const authUsers = authResult.data?.users ?? [];
  const services = allServices ?? [];
  const codes = inviteCodes ?? [];
  const incidents = recentIncidents ?? [];

  // Metrics
  const betaUsers = authUsers.filter(u => u.id !== ADMIN_USER_ID);
  const totalChecks = checks24h?.length ?? 0;
  const successChecks = checks24h?.filter(c => c.status === 'success').length ?? 0;
  const avgUptime = totalChecks > 0 ? (successChecks / totalChecks * 100).toFixed(1) : null;
  const usedCodes = codes.filter(c => c.used_at);

  // Per-user service count
  const servicesByUser = new Map<string, number>();
  for (const svc of services) {
    servicesByUser.set(svc.user_id, (servicesByUser.get(svc.user_id) ?? 0) + 1);
  }

  // Code by email
  const codeByEmail = new Map<string, string>();
  for (const code of codes) {
    if (code.used_by) codeByEmail.set(code.used_by.toLowerCase(), code.code);
  }

  // Activity feed — combine signups, service additions, incidents
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

  const metrics = [
    { label: 'Beta Users',          value: String(betaUsers.length),            sub: `${usedCodes.length} of ${codes.length} codes used` },
    { label: 'Endpoints Monitored', value: String(services.length),             sub: 'across all users' },
    { label: 'Checks (24h)',        value: totalChecks.toLocaleString(),         sub: totalChecks > 0 ? `~${Math.round(totalChecks / 24)}/hr` : 'no data yet' },
    { label: 'Avg Uptime',          value: avgUptime ? `${avgUptime}%` : '—',   sub: 'across all services', green: avgUptime !== null && parseFloat(avgUptime) >= 95 },
  ];

  const cardStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' as const };
  const cardHeaderStyle = { padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const cardTitleStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' };
  const cardCountStyle = { fontSize: 11, color: 'var(--text-dim)' };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Admin</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Internal overview — not visible to other users</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '4px 10px',
          background: 'rgba(239,68,68,0.08)', color: 'var(--status-critical)',
          border: '1px solid rgba(239,68,68,0.18)',
        }}>
          Owner only
        </span>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {metrics.map(({ label, value, sub, green }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: green ? 'var(--status-ok)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* Beta users table */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Beta Users</span>
            <span style={cardCountStyle}>{betaUsers.length} user{betaUsers.length !== 1 ? 's' : ''}</span>
          </div>
          {sortedUsers.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No beta users yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['User', 'Services', 'Joined', 'Code used'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 18px', fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u, i) => {
                    const isLast = i === sortedUsers.length - 1;
                    const code = codeByEmail.get((u.email ?? '').toLowerCase());
                    const svcCount = servicesByUser.get(u.id) ?? 0;
                    return (
                      <tr key={u.id}>
                        <td style={{ padding: '11px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '11px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{svcCount}</span>
                        </td>
                        <td style={{ padding: '11px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</span>
                        </td>
                        <td style={{ padding: '11px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                          {code
                            ? <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{code}</span>
                            : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
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

        {/* Right column */}
        <div>

          {/* Invite codes */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Invite Codes</span>
              <span style={cardCountStyle}>{usedCodes.length} used · {codes.length - usedCodes.length} left</span>
            </div>
            {codes.slice(0, 6).map((code, i) => {
              const isLast = i === Math.min(codes.length, 6) - 1 && codes.length <= 6;
              return (
                <div key={code.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{code.code}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                      {code.used_by ? `${code.used_by} · ${formatDate(code.used_at!)}` : 'Available'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: code.used_at ? 'rgba(34,197,94,0.08)' : 'rgba(107,114,128,0.1)',
                    color: code.used_at ? 'var(--status-ok)' : 'var(--text-muted)',
                  }}>
                    {code.used_at ? 'Used' : 'Free'}
                  </span>
                </div>
              );
            })}
            {codes.length > 6 && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>+ {codes.length - 6} more codes</span>
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={cardTitleStyle}>Recent Activity</span>
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
