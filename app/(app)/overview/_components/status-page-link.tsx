'use client';

import { useState } from 'react';

export function StatusPageLink({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/status/${userId}`
    : `/status/${userId}`;

  function copy() {
    const full = `${window.location.origin}/status/${userId}`;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      background: '#111', border: '1px solid #1f1f1f', borderRadius: 8,
      padding: '14px 18px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, marginBottom: 32,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          Your public status page
        </div>
        <span style={{
          fontSize: 13, color: '#888',
          fontFamily: 'var(--font-geist-mono)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {url}
        </span>
      </div>
      <button
        onClick={copy}
        style={{
          padding: '6px 14px', background: 'transparent',
          border: '1px solid #2a2a2a', borderRadius: 6,
          fontSize: 12, color: copied ? '#22c55e' : '#888',
          cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s',
        }}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}
