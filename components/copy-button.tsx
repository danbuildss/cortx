'use client';

import { useState } from 'react';

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 5, flexShrink: 0,
        background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
        border: copied ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border-mid)',
        cursor: 'pointer',
        color: copied ? 'var(--status-ok)' : 'var(--text-muted)',
        transition: 'all 0.1s',
      }}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,7 5,10 12,3"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="8" height="8" rx="1.5"/>
          <path d="M2 10V2.5A1.5 1.5 0 0 1 3.5 1H10"/>
        </svg>
      )}
    </button>
  );
}
