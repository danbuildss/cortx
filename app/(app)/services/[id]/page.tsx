import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('deleted_at', null)
    .single();

  if (!service) notFound();

  const { data: recentChecks } = await supabase
    .from('checks')
    .select('id, status, latency_ms, checked_at, stages')
    .eq('service_id', id)
    .order('checked_at', { ascending: false })
    .limit(10);

  const STATUS_COLOR: Record<string, string> = {
    pass: '#22c55e',
    fail: '#ef4444',
    error: '#f59e0b',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/overview" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>← Overview</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>{service.name}</h1>
          <span style={{ fontSize: 12, color: '#555', fontFamily: 'var(--font-geist-mono)' }}>{service.endpoint_url}</span>
        </div>
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent checks</h2>

      {!recentChecks?.length ? (
        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#555' }}>No checks yet. Checks run automatically on schedule.</p>
        </div>
      ) : (
        <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, overflow: 'hidden' }}>
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
                const stages = chk.stages as Array<{ name: string; passed: boolean }> | null;
                const failedStage = stages?.find(s => !s.passed);
                const isLast = i === recentChecks.length - 1;
                return (
                  <tr key={chk.id} style={{ borderBottom: isLast ? 'none' : '1px solid #1a1a1a' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>
                      {new Date(chk.checked_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: STATUS_COLOR[chk.status] ?? '#555', fontWeight: 500 }}>
                        {chk.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#888' }}>
                      {chk.latency_ms != null ? `${chk.latency_ms}ms` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#ef4444', fontFamily: 'var(--font-geist-mono)' }}>
                      {failedStage?.name ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
