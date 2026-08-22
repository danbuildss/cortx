'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ActionState = 'idle' | 'loading' | 'rejecting';

export function SubmissionActions({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function patch(action: 'approve' | 'reject', rejection_reason?: string) {
    setState('loading');
    setError('');
    const res = await fetch('/api/admin/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, rejection_reason }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Request failed');
      setState(action === 'reject' ? 'rejecting' : 'idle');
      return;
    }
    router.refresh();
  }

  const btnBase: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, border: 'none',
    borderRadius: 5, padding: '4px 10px', cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  if (state === 'rejecting') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
        <input
          autoFocus
          placeholder="Rejection reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') patch('reject', reason || undefined); if (e.key === 'Escape') { setState('idle'); setReason(''); } }}
          style={{
            fontSize: 11, padding: '5px 8px', borderRadius: 5,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#f5f5f5', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ fontSize: 10, color: '#ef4444' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => patch('reject', reason || undefined)} style={{ ...btnBase, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            Confirm reject
          </button>
          <button onClick={() => { setState('idle'); setReason(''); setError(''); }} style={{ ...btnBase, background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {error && <span style={{ fontSize: 10, color: '#ef4444', marginRight: 4 }}>{error}</span>}
      <button
        disabled={state === 'loading'}
        onClick={() => patch('approve')}
        style={{ ...btnBase, background: 'rgba(34,197,94,0.12)', color: '#4ade80', opacity: state === 'loading' ? 0.5 : 1 }}
      >
        Approve
      </button>
      <button
        disabled={state === 'loading'}
        onClick={() => setState('rejecting')}
        style={{ ...btnBase, background: 'rgba(239,68,68,0.10)', color: '#f87171', opacity: state === 'loading' ? 0.5 : 1 }}
      >
        Reject
      </button>
    </div>
  );
}
