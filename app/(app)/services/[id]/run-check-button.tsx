'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RunCheckButton({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; failure_stage: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/checks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Check failed');
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  const color = result?.status === 'passed' ? 'var(--status-operational)' : result?.status === 'failed' ? 'var(--status-critical)' : 'var(--status-degraded)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--status-critical)', fontWeight: 500 }}>{error}</span>
      )}
      {result && !error && (
        <span style={{ fontSize: 12, color, fontWeight: 500 }}>
          {result.status}{result.failure_stage ? ` — ${result.failure_stage}` : ''}
        </span>
      )}
      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: '7px 14px',
          background: 'var(--bg-elevated)',
          color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 6, fontSize: 13,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 400,
        }}
      >
        {loading ? 'Running…' : 'Run check'}
      </button>
    </div>
  );
}
