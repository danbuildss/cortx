'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RunCheckButton({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; failure_stage: string | null } | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/checks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });
      const data = await res.json();
      setResult(data);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const color = result?.status === 'passed' ? 'var(--status-operational)' : result?.status === 'failed' ? 'var(--status-critical)' : 'var(--status-degraded)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {result && (
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
