import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RunCheckButton } from './run-check-button';

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    .order('started_at', { ascending: false })
    .limit(20);

  const { data: openIncident } = await supabase
    .from('incidents')
    .select('id, severity, opened_at, failure_stage')
    .eq('service_id', id)
    .in('status', ['open', 'acknowledged'])
    .maybeSingle();

  const STATUS_COLOR: Record<string, string> = {
    operational: '#22c55e',
    degraded: '#f59e0b',
    critical: '#ef4444',
    unknown: '#555',
  };

  const CHECK_COLOR: Record<string, string> = {
    passed: '#22c55e',
    failed: '#ef4444',
    error: '#f59e0b',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/overview" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>← Overview</Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>{service.name}</h1>
          <span style={{ fontSize: 12, color: '#555', fontFamily: 'var(--font-geist-mono)' }}>{service.endpoint_url}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: STATUS_COLOR[service.status ?? 'unknown'], fontWeight: 500 }}>
            ● {service.status ?? 'unknown'}
          </span>
          <RunCheckButton serviceId={service.id} />
        </div>
      </div>

      {/* Open incident banner */}
      {openIncident && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>
              Open incident — {openIncident.severity}
            </span>
            <span style={{ fontSize: 12, color: '#888', marginLeft: 12 }}>
              {openIncident.failure_stage} · opened {formatRelative(openIncident.opened_at)}
            </span>
          </div>
          <Link href="/incidents" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>View →</Link>
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        <MetaCard label="Network" value={service.environment === 'mainnet' ? 'Base Mainnet' : 'Base Sepolia'} />
        <MetaCard label="Check interval" value={`Every ${service.check_interval_minutes}m`} />
        <MetaCard label="Last checked" value={service.last_checked_at ? formatRelative(service.last_checked_at) : 'Never'} />
      </div>

      {/* Recent checks */}
      <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Recent checks
      </h2>

      {!recentChecks?.length ? (
        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#555' }}>No checks yet. Use &ldquo;Run check&rdquo; above or wait for the next scheduled run.</p>
        </div>
      ) : (
        <>
          <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {['Time', 'Status', 'Latency', 'Failed stage'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentChecks.map((chk, i) => {
                  const isLast = i === recentChecks.length - 1;
                  return (
                    <tr key={chk.id} style={{ borderBottom: isLast ? 'none' : '1px solid #1a1a1a' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>
                        {new Date(chk.started_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: CHECK_COLOR[chk.status] ?? '#555', fontWeight: 500 }}>
                          {chk.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#888' }}>
                        {chk.latency_ms != null ? `${chk.latency_ms}ms` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#ef4444', fontFamily: 'var(--font-geist-mono)' }}>
                        {chk.failure_stage ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stage breakdown for most recent check */}
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

  const STAGE_COLOR: Record<string, string> = {
    true: '#22c55e',
    false: '#ef4444',
    null: '#555',
  };

  return (
    <div>
      <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Latest check — stage detail
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stages.map((s) => {
          const color = STAGE_COLOR[String(s.passed)] ?? '#555';
          const icon = s.passed === true ? '✓' : s.passed === false ? '✗' : '·';
          return (
            <div key={s.stage} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: s.evidence ? 8 : 0 }}>
                <span style={{ fontSize: 13, color, fontWeight: 600, width: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, color: '#f0f0f0', fontFamily: 'var(--font-geist-mono)' }}>{s.stage}</span>
                {s.error && <span style={{ fontSize: 12, color: '#ef4444', marginLeft: 8 }}>{s.error}</span>}
                {s.duration_ms != null && <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{s.duration_ms}ms</span>}
              </div>
              {s.evidence && (
                <pre style={{
                  fontSize: 11, color: '#888', fontFamily: 'var(--font-geist-mono)',
                  background: '#0a0a0a', padding: '8px 10px', borderRadius: 4,
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
    <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#f0f0f0' }}>{value}</div>
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
